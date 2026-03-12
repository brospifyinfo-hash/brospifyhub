"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { SupportMessage } from "@/types/database";

interface Props {
  conversationId?: string;
  userId?: string;
  userName?: string;
}

interface MessageWithSender extends SupportMessage {
  sender?: {
    display_name: string | null;
    role: string;
  };
}

export function SupportChat({ conversationId: initialConvId, userId: initialUserId, userName: initialUserName }: Props) {
  const [conversationId, setConversationId] = useState(initialConvId ?? "");
  const [userId, setUserId] = useState(initialUserId ?? "");
  const [userName, setUserName] = useState(initialUserName ?? "");
  const [convLoading, setConvLoading] = useState(!initialConvId);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  if (convLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  useEffect(() => {
    if (initialConvId) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/support/conversation");
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data?.conversationId) {
        setConversationId(data.conversationId);
        setUserId(data.userId ?? "");
        setUserName(data.userName ?? "User");
      }
      setConvLoading(false);
    })();
    return () => { cancelled = true; };
  }, [initialConvId, router]);

  useEffect(() => {
    if (!conversationId) return;
    
    const supabase = createClient();

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("support_messages")
        .select(`
          *,
          sender:users!sender_id(display_name, role)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data as unknown as MessageWithSender[]);
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`support-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch the new message with sender info
          const { data } = await supabase
            .from("support_messages")
            .select(`
              *,
              sender:users!sender_id(display_name, role)
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [
              ...prev,
              data as unknown as MessageWithSender,
            ]);
            setTimeout(scrollToBottom, 100);
          }
        }
      );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !conversationId) return;

    setIsSending(true);
    const supabase = createClient();

    try {
      await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: newMessage.trim(),
      });

      // Update last_message_at
      await supabase
        .from("support_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="h-16 px-6 flex items-center gap-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Headphones className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground">Support</h1>
          <p className="text-xs text-muted-foreground">
            Wir antworten normalerweise innerhalb weniger Stunden
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Headphones className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Support Chat</h2>
            <p className="text-muted-foreground mt-1 max-w-sm">
              Hast du Fragen oder brauchst Hilfe? Schreib uns eine Nachricht und wir melden uns so schnell wie möglich!
            </p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isOwn = message.sender_id === userId;
              const isAdmin = message.sender?.role === "admin";
              const senderName = isOwn ? userName : (message.sender?.display_name || "Support");
              
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className={`text-xs font-semibold ${
                      isAdmin ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
                    }`}>
                      {getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${isOwn ? "order-2" : ""} ${
                        isAdmin ? "text-primary" : "text-foreground"
                      }`}>
                        {senderName}
                        {isAdmin && <span className="ml-1 text-primary/70">(Team)</span>}
                      </span>
                      <span className={`text-xs text-muted-foreground ${isOwn ? "order-1" : ""}`}>
                        {new Date(message.created_at).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className={`message-bubble ${isOwn ? "own ml-auto" : ""}`}>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Schreibe eine Nachricht..."
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
    </div>
  );
}
