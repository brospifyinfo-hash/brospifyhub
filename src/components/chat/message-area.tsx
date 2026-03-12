"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Copy, Check, ExternalLink, FileText, Trash2, MoreVertical, Heart, Smile } from "lucide-react";
import Link from "next/link";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { Message, User, Channel } from "@/types/database";

interface MessageWithUser extends Message {
  users?: Pick<User, "id" | "role" | "display_name"> | null;
}

interface MessageAreaProps {
  channelId: string;
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Heute";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Gestern";
  }

  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function MessageArea({ channelId }: MessageAreaProps) {
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; count: number; userReacted: boolean }[]>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [userRoleNames, setUserRoleNames] = useState<Record<string, { name: string; color: string }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const quickEmojis = ["👍", "❤️", "🔥", "👏", "😂", "🎉"];
  const PRIMARY_GREEN = "#95BF47";

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Load user's favorites
        const { data: favData } = await supabase
          .from("user_favorites")
          .select("message_id")
          .eq("user_id", user.id);
        
        if (favData) {
          setFavorites(new Set(favData.map(f => f.message_id)));
        }
      }

      // Check if user is admin
      try {
        const response = await apiFetch("/api/user/profile");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.profile?.role === "admin");
        }
      } catch (e) {}

      // Fetch channel settings
      const { data: channelData } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single<Channel>();
      
      setChannel(channelData);

      // Fetch messages
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          users (
            id,
            role,
            display_name
          )
        `)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .returns<MessageWithUser[]>();

      if (!error && data) {
        setMessages(data);
        const userIds = [...new Set((data as MessageWithUser[]).map((m) => m.user_id))];
        if (userIds.length > 0) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("user_id, roles(display_name, color, hierarchy_level)")
            .in("user_id", userIds);
          const byUser: Record<string, { name: string; color: string; level: number }> = {};
          roleData?.forEach((r: any) => {
            if (!r.roles?.display_name || !r.user_id) return;
            const level = Number(r.roles.hierarchy_level) || 0;
            if (!byUser[r.user_id] || level > byUser[r.user_id].level)
              byUser[r.user_id] = { name: r.roles.display_name, color: r.roles.color || "#95BF47", level };
          });
          const map: Record<string, { name: string; color: string }> = {};
          Object.entries(byUser).forEach(([uid, v]) => { map[uid] = { name: v.name, color: v.color }; });
          setUserRoleNames(map);
        }
      }
      setLoading(false);
    };

    fetchData();

    const onMessageSent = (
      e: CustomEvent<{
        channelId: string;
        message: Message;
        user: { id: string; role?: string; display_name?: string } | null;
      }>
    ) => {
      if (e.detail.channelId !== channelId) return;
      const user = e.detail.user as unknown as
        | Pick<User, "id" | "role" | "display_name">
        | null
        | undefined;
      const newMsg: MessageWithUser = { ...e.detail.message, users: user };
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
    };
    window.addEventListener("message-sent", onMessageSent as EventListener);
    const cleanupEvent = () => window.removeEventListener("message-sent", onMessageSent as EventListener);

    // Subscribe to realtime messages
    const messageChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, users: null }];
          });
          const { data: userData } = await supabase
            .from("users")
            .select("id, role, display_name")
            .eq("id", newMsg.user_id)
            .single<Pick<User, "id" | "role" | "display_name">>();
          setMessages((prev) =>
            prev.map((m) => (m.id === newMsg.id ? { ...m, users: userData } : m))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.filter((m) => m.id !== (payload.old as Message).id)
          );
        }
      )
      .subscribe();

    return () => {
      cleanupEvent();
      supabase.removeChannel(messageChannel);
    };
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Nachricht wirklich löschen?")) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);
    
    if (!error) {
      setMessages(messages.filter(m => m.id !== messageId));
    }
    setOpenMenuId(null);
  };

  const hasRealContent = (content: string) => {
    return content && content !== "📷 Bild" && content !== "📎 Datei";
  };

  const toggleFavorite = async (messageId: string) => {
    if (!currentUserId) return;
    
    const supabase = createClient();
    const isFavorited = favorites.has(messageId);
    
    if (isFavorited) {
      await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", currentUserId)
        .eq("message_id", messageId);
      
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    } else {
      await supabase
        .from("user_favorites")
        .insert({ user_id: currentUserId, message_id: messageId });
      
      setFavorites(prev => new Set([...prev, messageId]));
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    setShowEmojiPicker(null);
    
    const supabase = createClient();
    const currentReactions = reactions[messageId] || [];
    const existingReaction = currentReactions.find(r => r.emoji === emoji);
    
    if (existingReaction?.userReacted) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);
    } else {
      await (supabase as any)
        .from("message_reactions")
        .upsert(
          { message_id: messageId, user_id: currentUserId, emoji },
          { onConflict: "message_id,user_id,emoji" }
        );
      
      try {
        const { incrementStat } = await import("@/lib/stats");
        await incrementStat(currentUserId, "reactions_given");
      } catch {}
    }
    
    await loadReactions(messageId);
  };

  const loadReactions = async (messageId: string) => {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("message_reactions")
      .select("emoji, user_id")
      .eq("message_id", messageId);
    
    if (data) {
      const grouped: Record<string, { count: number; userReacted: boolean }> = {};
      (data as Array<{ emoji: string; user_id: string }>).forEach((r) => {
        if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, userReacted: false };
        grouped[r.emoji].count++;
        if (r.user_id === currentUserId) grouped[r.emoji].userReacted = true;
      });
      
      setReactions(prev => ({
        ...prev,
        [messageId]: Object.entries(grouped).map(([emoji, info]) => ({ emoji, ...info }))
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-3 md:gap-4"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-secondary animate-pulse flex-shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-4 w-24 md:w-28 bg-secondary animate-pulse rounded-lg" />
              <div className="h-4 w-4/5 md:w-2/3 bg-secondary animate-pulse rounded-lg" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-3xl md:text-4xl">💬</span>
          </div>
          <p className="text-base md:text-lg font-medium text-foreground">
            Noch keine Nachrichten
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Hier erscheinen bald neue Inhalte!
          </p>
        </motion.div>
      </div>
    );
  }

  let lastDate = "";

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-2 md:p-4 space-y-2 md:space-y-2.5">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => {
            const messageDate = formatDate(message.created_at);
            const showDateDivider = messageDate !== lastDate;
            lastDate = messageDate;

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                {showDateDivider && (
                  <div className="flex items-center gap-2 my-2 md:my-3">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-secondary whitespace-nowrap">
                      {messageDate}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                )}

                <motion.div
                  className={`p-2 md:p-2.5 group relative rounded-xl border ${
                    message.user_id === currentUserId
                      ? "ml-6 md:ml-12 border-primary bg-card"
                      : "mr-6 md:mr-12 content-card"
                  }`}
                >
                  <div className={`flex gap-2 md:gap-2.5 ${message.user_id === currentUserId ? "flex-row-reverse" : ""}`}>
                    <Link href={`/user/${message.user_id}`} className="flex-shrink-0">
                      <Avatar className="h-6 w-6 md:h-8 md:w-8 hover:opacity-90 transition-opacity">
                        <AvatarFallback
                          className={`text-[10px] md:text-xs font-semibold ${
                            message.user_id === currentUserId ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {getInitials(message.users?.display_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>

                    <div className={`flex-1 min-w-0 ${message.user_id === currentUserId ? "text-right" : ""}`}>
                      {/* Header */}
                      <div className={`flex flex-wrap items-center gap-1 md:gap-1.5 mb-0.5 md:mb-1 ${message.user_id === currentUserId ? "justify-end" : ""}`}>
                        <Link href={`/user/${message.user_id}`} className="font-medium text-xs truncate max-w-[100px] sm:max-w-none hover:underline">
                          {message.users?.display_name || "Unbekannt"}
                        </Link>
                        {(userRoleNames[message.user_id] || message.users?.role === "admin") && (
                          <span
                            className="text-[8px] md:text-[9px] px-1 py-0.5 rounded font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor: (userRoleNames[message.user_id]?.color || "#95BF47") + "20",
                              color: userRoleNames[message.user_id]?.color || "#95BF47",
                            }}
                          >
                            {message.users?.role === "admin" ? "Team" : (userRoleNames[message.user_id]?.name || "Mitglied")}
                          </span>
                        )}
                        <span className="text-[9px] md:text-[10px] text-muted-foreground">
                          {formatTime(message.created_at)}
                        </span>
                      </div>

                      {/* Content */}
                      {hasRealContent(message.content) && (
                        <p className="break-words leading-snug whitespace-pre-wrap text-xs md:text-sm text-foreground">
                          {message.content}
                        </p>
                      )}

                      {/* Attachment */}
                      {message.attachment_url && (
                        <div className={hasRealContent(message.content) ? "mt-2 md:mt-3" : ""}>
                          {message.attachment_type === "image" ? (
                            <div className="space-y-2">
                              {/* Image - with optional background color */}
                              <div 
                                className="inline-block cursor-pointer rounded-lg overflow-hidden max-w-full"
                                style={{ backgroundColor: message.image_bg_color || "transparent" }}
                                onClick={() => window.open(message.attachment_url!, "_blank")}
                              >
                                <img
                                  src={message.attachment_url}
                                  alt="Bild"
                                  className="max-w-full sm:max-w-xs max-h-48 md:max-h-64 object-contain hover:opacity-90 transition-opacity"
                                />
                              </div>
                              {/* Download button */}
                              {channel?.show_download_button !== false && (
                                <div className="mt-1.5">
                                  <button
                                    onClick={() => handleDownload(message.attachment_url!, `bild-${message.id}.jpg`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Herunterladen</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDownload(message.attachment_url!, `datei-${message.id}`)}
                              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 border border-border"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Download</span>
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* CTA Button */}
                      {message.cta_button_text && message.cta_button_url && (
                        <div className="mt-2">
                          <a
                            href={message.cta_button_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium btn-primary"
                          >
                            {message.cta_button_text}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      {/* Reactions */}
                      {reactions[message.id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {reactions[message.id].map(r => (
                            <button
                              key={r.emoji}
                              onClick={() => addReaction(message.id, r.emoji)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                r.userReacted ? "bg-primary/20 text-primary" : "bg-muted hover:bg-muted/80"
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span>{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-2 md:mt-3 flex-wrap">
                        {/* Emoji Reaction */}
                        <div className="relative">
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                              className="inline-flex items-center gap-1 text-xs transition-colors min-h-[28px] px-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                            <Smile className="w-3.5 h-3.5" />
                          </button>
                          
                          <AnimatePresence>
                            {showEmojiPicker === message.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute bottom-full mb-1 left-0 content-card p-2 shadow-xl z-20"
                              >
                                <div className="flex gap-1">
                                  {quickEmojis.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => addReaction(message.id, emoji)}
                                      className="w-8 h-8 text-lg hover:bg-muted rounded-lg transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Copy text */}
                        {hasRealContent(message.content) && channel?.show_copy_button && (
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="inline-flex items-center gap-1 text-xs transition-colors min-h-[28px] px-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            {copiedId === message.id ? (
                              <><Check className="w-3.5 h-3.5 text-green-500" />Kopiert</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" />Kopieren</>
                            )}
                          </button>
                        )}

                        {/* Favorite */}
                        <button
                          onClick={() => toggleFavorite(message.id)}
                          className={`inline-flex items-center gap-1 text-xs transition-colors min-h-[28px] px-1.5 rounded-lg ${
                            favorites.has(message.id) ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${favorites.has(message.id) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Delete Menu (Admin only) */}
                    {isAdmin && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === message.id ? null : message.id)}
                          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg md:opacity-0 md:group-hover:opacity-100 hover:bg-secondary transition-all"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                        
                        <AnimatePresence>
                          {openMenuId === message.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-full mt-1 content-card p-1 shadow-xl z-10 min-w-[140px]"
                            >
                              <button
                                onClick={() => handleDelete(message.id)}
                                className="w-full flex items-center gap-2 px-3 py-3 min-h-[44px] rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Löschen
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
