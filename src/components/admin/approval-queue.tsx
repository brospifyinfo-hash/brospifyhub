"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, MessageSquare, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Message, User, Channel } from "@/types/database";

interface MessageWithDetails extends Message { users: Pick<User, "id" | "display_name"> | null; channels: Pick<Channel, "id" | "name"> | null; }
interface Props { messages: MessageWithDetails[]; }

export function ApprovalQueue({ messages: initial }: Props) {
  const [messages, setMessages] = useState(initial);
  const [processing, setProcessing] = useState<string | null>(null);

  const approve = async (id: string) => {
    setProcessing(id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("messages").update({ is_approved: true, approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
    if (!error) setMessages(messages.filter(m => m.id !== id));
    setProcessing(null);
  };

  const reject = async (id: string) => {
    setProcessing(id);
    const supabase = createClient();
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (!error) setMessages(messages.filter(m => m.id !== id));
    setProcessing(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Freigabe-Warteschlange</h1>
          <p className="text-muted-foreground">{messages.length} ausstehende Nachrichten</p>
        </div>

        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-12 text-center">
            <Check className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold text-foreground">Alles erledigt!</h2>
            <p className="text-muted-foreground mt-1">Keine Nachrichten warten auf Freigabe</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div key={msg.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} className="glass rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">{msg.users?.display_name?.slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">{msg.users?.display_name || "Unbekannt"}</span>
                        <span className="text-sm text-muted-foreground">in #{msg.channels?.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(msg.created_at)}</span>
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button size="sm" variant="secondary" onClick={() => reject(msg.id)} disabled={processing === msg.id} className="text-destructive hover:bg-destructive/10">
                          <X className="w-4 h-4 mr-1" />Ablehnen
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button size="sm" onClick={() => approve(msg.id)} disabled={processing === msg.id}>
                          <Check className="w-4 h-4 mr-1" />Freigeben
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}