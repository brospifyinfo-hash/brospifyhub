"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Headphones, 
  MessageCircle, 
  Clock, 
  CheckCircle,
  Send,
  Loader2,
  User,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { SupportConversation, SupportMessage, User as UserType } from "@/types/database";

interface ConversationWithUser extends SupportConversation {
  user?: UserType;
  unread_count?: number;
  last_message?: string;
}

interface MessageWithSender extends SupportMessage {
  sender?: {
    display_name: string | null;
    role: string;
  };
}

export function SupportInbox() {
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithUser | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };

    init();

    const fetchConversations = async () => {
      const { data } = await supabase
        .from("support_conversations")
        .select(`
          *,
          user:users!user_id(id, display_name, role, license_key)
        `)
        .order("last_message_at", { ascending: false });

      if (data) {
        // Get last message for each conversation
        const conversationsWithMessages = await Promise.all(
          data.map(async (conv) => {
            const { data: lastMsg } = await supabase
              .from("support_messages")
              .select("content")
              .eq("conversation_id", conv.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            return {
              ...conv,
              last_message: lastMsg?.content,
            } as unknown as ConversationWithUser;
          })
        );

        setConversations(conversationsWithMessages);
      }
    };

    fetchConversations();

    // Subscribe to new conversations and messages
    const subscription = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, fetchConversations)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, fetchConversations)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const supabase = createClient();

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("support_messages")
        .select(`
          *,
          sender:users!sender_id(display_name, role)
        `)
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data as unknown as MessageWithSender[]);
      }
    };

    fetchMessages();

    const subscription = supabase
      .channel(`admin-support-${selectedConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        fetchMessages
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedConversation]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !selectedConversation || !currentUserId) return;

    setIsSending(true);
    const supabase = createClient();

    try {
      await supabase.from("support_messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        content: newMessage.trim(),
      });

      await supabase
        .from("support_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return "Jetzt";
  };

  return (
    <div className="flex h-screen">
      {/* Conversation List */}
      <div className={`w-80 border-r border-border bg-card/30 flex flex-col ${selectedConversation ? "hidden lg:flex" : "flex"}`}>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-border">
          <Headphones className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-foreground">Support Inbox</h1>
          <span className="ml-auto member-badge">
            {conversations.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Keine Gespräche</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <motion.button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full p-3 rounded-xl text-left transition-colors ${
                    selectedConversation?.id === conv.id
                      ? "bg-primary/10"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-secondary text-foreground text-sm">
                        {getInitials(conv.user?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground truncate">
                          {conv.user?.display_name || "Unbekannt"}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || "Keine Nachrichten"}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedConversation ? "hidden lg:flex" : "flex"}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 flex items-center gap-4 border-b border-border bg-card/50">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-secondary text-foreground">
                  {getInitials(selectedConversation.user?.display_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">
                  {selectedConversation.user?.display_name || "Unbekannt"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Key: {selectedConversation.user?.license_key || "N/A"}
                </p>
              </div>
              {selectedConversation.is_resolved && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  Gelöst
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  const isAdmin = message.sender?.role === "admin";
                  const senderName = message.sender?.display_name || "User";

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className={`text-xs font-semibold ${
                          isAdmin ? "bg-primary/10 text-primary" : "bg-secondary"
                        }`}>
                          {getInitials(senderName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className={`max-w-[70%] ${isAdmin ? "text-right" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${isAdmin ? "order-2 text-primary" : ""}`}>
                            {senderName}
                          </span>
                          <span className={`text-xs text-muted-foreground ${isAdmin ? "order-1" : ""}`}>
                            {new Date(message.created_at).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className={`message-bubble ${isAdmin ? "own ml-auto" : ""}`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card/50">
              <div className="flex items-end gap-3">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Antworten..."
                  className="min-h-[44px] max-h-[200px] input-modern resize-none"
                  disabled={isSending}
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || isSending}
                    className="h-11 w-11 rounded-xl btn-primary p-0"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </motion.div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Support Inbox</h2>
            <p className="text-muted-foreground mt-1">
              Wähle ein Gespräch aus der Liste
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
