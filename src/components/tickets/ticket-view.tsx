"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Send, Clock, CheckCircle, AlertCircle, XCircle,
  Loader2, MoreVertical, Lock, Archive, ArchiveRestore
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketMessage, TicketStatus, User } from "@/types/database";

interface MessageWithSender extends TicketMessage {
  sender?: Pick<User, "id" | "display_name" | "role">;
}

interface Props {
  ticket: Ticket;
  isAdmin?: boolean;
  onBack: () => void;
}

const statusConfig: Record<TicketStatus, { label: string; icon: typeof Clock; color: string }> = {
  open: { label: "Offen", icon: AlertCircle, color: "text-blue-500 bg-blue-500/10" },
  in_progress: { label: "In Bearbeitung", icon: Clock, color: "text-amber-500 bg-amber-500/10" },
  resolved: { label: "Gelöst", icon: CheckCircle, color: "text-green-500 bg-green-500/10" },
  closed: { label: "Geschlossen", icon: XCircle, color: "text-muted-foreground bg-secondary" },
};

export function TicketView({ ticket, isAdmin, onBack }: Props) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canArchive = ["in_progress", "resolved", "closed"].includes(currentTicket.status);
  const isArchived = !!currentTicket.archived_at;

  useEffect(() => {
    const supabase = createClient();

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select(`
          *,
          sender:users!sender_id(id, display_name, role)
        `)
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as MessageWithSender[]);
      setLoading(false);
    };

    fetchMessages();

    const subscription = supabase
      .channel(`ticket-${ticket.id}`)
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "ticket_messages",
        filter: `ticket_id=eq.${ticket.id}`
      }, async (payload) => {
        const { data: newMsg } = await supabase
          .from("ticket_messages")
          .select(`*, sender:users!sender_id(id, display_name, role)`)
          .eq("id", payload.new.id)
          .single();
        if (newMsg) {
          setMessages(prev => [...prev, newMsg as MessageWithSender]);
        }
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending || currentTicket.status === "closed") return;

    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSending(false);
      return;
    }

    await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content: message.trim(),
    });

    // Update ticket timestamp
    await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticket.id);

    setMessage("");
    setSending(false);
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const updates: Partial<Ticket> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "closed" && user) {
      updates.closed_at = new Date().toISOString();
      updates.closed_by = user.id;
    }

    const { data } = await supabase
      .from("tickets")
      .update(updates)
      .eq("id", ticket.id)
      .select()
      .single<Ticket>();

    if (data) setCurrentTicket(data);
    setShowStatusMenu(false);
  };

  const handleArchive = async () => {
    setArchiving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("tickets")
      .update({
        archived_at: isArchived ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .select()
      .single<Ticket>();
    if (data) setCurrentTicket(data);
    setArchiving(false);
  };

  const groupMessagesByDate = (msgs: MessageWithSender[]) => {
    const groups: { date: string; messages: MessageWithSender[] }[] = [];
    let currentDate = "";

    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const status = statusConfig[currentTicket.status];
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
          <button onClick={onBack} className="p-2 hover:bg-secondary rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{currentTicket.ticket_number}</span>
            </div>
            <h2 className="font-semibold text-sm md:text-base text-foreground truncate">{currentTicket.subject}</h2>
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium min-h-[40px] ${status.color}`}
            >
              <StatusIcon className="w-4 h-4" />
              <span className="hidden xs:inline">{status.label}</span>
            </button>

            <AnimatePresence>
              {showStatusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 content-card p-2 shadow-xl min-w-[160px] z-10"
                >
                  {(Object.keys(statusConfig) as TicketStatus[]).map(s => {
                    const config = statusConfig[s];
                    const Icon = config.icon;
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`w-full flex items-center gap-2 px-3 py-3 min-h-[44px] rounded-lg text-sm hover:bg-secondary ${
                          currentTicket.status === s ? "bg-secondary" : ""
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${config.color.split(" ")[0]}`} />
                        {config.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-xs text-muted-foreground ml-11 md:ml-0">
          Erstellt am {new Date(currentTicket.created_at).toLocaleString("de-DE")}
          {isArchived && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Archiviert</span>
          )}
        </p>
        {canArchive && (
          <div className="mt-2 ml-11 md:ml-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={archiving}
              className="text-xs"
            >
              {archiving ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : isArchived ? (
                <ArchiveRestore className="w-3 h-3 mr-1" />
              ) : (
                <Archive className="w-3 h-3 mr-1" />
              )}
              {isArchived ? "Wiederherstellen" : "Archivieren"}
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {groupMessagesByDate(messages).map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] md:text-xs text-muted-foreground font-medium px-2 whitespace-nowrap">
                    {group.date}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3 md:space-y-4">
                  {group.messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2 md:gap-3"
                    >
                      <Avatar className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0">
                        <AvatarFallback className={`text-xs ${msg.sender?.role === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          {(msg.sender?.display_name || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-none">
                            {msg.sender?.display_name || "Unbekannt"}
                          </span>
                          {msg.sender?.role === "admin" && (
                            <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                              Admin
                            </span>
                          )}
                          <span className="text-[10px] md:text-xs text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {currentTicket.status === "closed" ? (
        <div className="p-3 md:p-4 border-t border-border">
          <div className="content-card flex items-center justify-center gap-3 text-muted-foreground py-3 md:py-4">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">
              Dieses Ticket wurde geschlossen
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-3 md:p-4 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Antwort schreiben..."
              className="input-modern min-h-[44px] max-h-[120px] resize-none text-base md:text-sm flex-1"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={!message.trim() || sending}
              className="btn-primary h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
