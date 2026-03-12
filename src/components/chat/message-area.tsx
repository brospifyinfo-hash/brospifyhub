"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Copy, Check, ExternalLink, FileText, Trash2, MoreVertical } from "lucide-react";
import Link from "next/link";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { Message, User, Channel } from "@/types/database";

interface MessageWithUser extends Message {
  users?: Pick<User, "id" | "role" | "display_name"> | null;
}

const MESSAGE_PAGE_SIZE = 5;

interface MessageAreaProps {
  channelId: string;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      // 1) Schnell: Nur Channel + letzte Nachrichten (limit), sofort anzeigen
      const [channelRes, messagesRes] = await Promise.all([
        supabase.from("channels").select("id, show_download_button, show_copy_button").eq("id", channelId).single<Channel>(),
        supabase
          .from("messages")
          .select(`id, channel_id, user_id, content, attachment_url, attachment_type, image_bg_color, cta_button_text, cta_button_url, created_at, users(display_name)`)
          .eq("channel_id", channelId)
          .order("created_at", { ascending: false })
          .limit(MESSAGE_PAGE_SIZE)
          .returns<MessageWithUser[]>(),
      ]);

      setChannel((channelRes.data ?? null) as Channel | null);
      if (!messagesRes.error && messagesRes.data) {
        setMessages([...messagesRes.data].reverse());
      }
      setLoading(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      apiFetch("/api/user/profile").then((response) => {
        if (response.ok) return response.json();
        return null;
      }).then((data) => {
        if (data?.profile?.role === "admin") setIsAdmin(true);
      }).catch(() => {});
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
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, users: null }];
          });
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

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary/60 animate-pulse flex-shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="h-3 w-20 bg-secondary/60 animate-pulse rounded" />
              <div className="h-4 w-3/4 bg-secondary/60 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <p className="text-foreground font-medium">Noch keine Nachrichten</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="p-2 md:p-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
              <div key={message.id}>
                <div
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
                      {/* Header – nur Name, keine Uhrzeit/Rollen */}
                      <div className={`flex items-center gap-1 mb-0.5 ${message.user_id === currentUserId ? "justify-end" : ""}`}>
                        <Link href={`/user/${message.user_id}`} className="font-medium text-xs truncate hover:underline">
                          {message.users?.display_name || "Unbekannt"}
                        </Link>
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

                      {/* Nur Kopieren wenn Channel es erlaubt */}
                      {hasRealContent(message.content) && channel?.show_copy_button && (
                        <div className="mt-2">
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === message.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedId === message.id ? "Kopiert" : "Kopieren"}
                          </button>
                        </div>
                      )}
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
                </div>
              </div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
