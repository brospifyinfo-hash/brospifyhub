"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Ticket as TicketIcon, Plus, Search, Filter, Clock, CheckCircle, 
  AlertCircle, XCircle, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketStatus, User } from "@/types/database";
import { CreateTicketModal } from "./create-ticket-modal";

interface TicketWithUser extends Ticket {
  user?: Pick<User, "id" | "display_name">;
}

interface Props {
  isAdmin?: boolean;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicketId?: string;
}

const statusConfig: Record<TicketStatus, { label: string; icon: typeof Clock; color: string }> = {
  open: { label: "Offen", icon: AlertCircle, color: "text-blue-500 bg-blue-500/10" },
  in_progress: { label: "In Bearbeitung", icon: Clock, color: "text-amber-500 bg-amber-500/10" },
  resolved: { label: "Gelöst", icon: CheckCircle, color: "text-green-500 bg-green-500/10" },
  closed: { label: "Geschlossen", icon: XCircle, color: "text-muted-foreground bg-secondary" },
};

export function TicketList({ isAdmin, onSelectTicket, selectedTicketId }: Props) {
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const fetchTickets = async () => {
      let query = supabase
        .from("tickets")
        .select(`
          *,
          user:users!user_id(id, display_name)
        `)
        .order("updated_at", { ascending: false });

      if (showArchived) {
        query = query.not("archived_at", "is", null);
      } else {
        query = query.is("archived_at", null);
      }

      const { data } = await query;
      if (data) setTickets(data as TicketWithUser[]);
      setLoading(false);
    };

    fetchTickets();

    const subscription = supabase
      .channel("tickets-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, fetchTickets)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [showArchived]);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      `#${ticket.ticket_number}`.includes(search);
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const groupByDate = (tickets: TicketWithUser[]) => {
    const groups: { label: string; tickets: TicketWithUser[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayTickets: TicketWithUser[] = [];
    const yesterdayTickets: TicketWithUser[] = [];
    const lastWeekTickets: TicketWithUser[] = [];
    const olderTickets: TicketWithUser[] = [];

    tickets.forEach(ticket => {
      const date = new Date(ticket.created_at);
      if (date.toDateString() === today.toDateString()) {
        todayTickets.push(ticket);
      } else if (date.toDateString() === yesterday.toDateString()) {
        yesterdayTickets.push(ticket);
      } else if (date > lastWeek) {
        lastWeekTickets.push(ticket);
      } else {
        olderTickets.push(ticket);
      }
    });

    if (todayTickets.length) groups.push({ label: "Heute", tickets: todayTickets });
    if (yesterdayTickets.length) groups.push({ label: "Gestern", tickets: yesterdayTickets });
    if (lastWeekTickets.length) groups.push({ label: "Letzte 7 Tage", tickets: lastWeekTickets });
    if (olderTickets.length) groups.push({ label: "Älter", tickets: olderTickets });

    return groups;
  };

  const groupedTickets = groupByDate(filteredTickets);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <TicketIcon className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="font-semibold text-foreground text-sm md:text-base truncate">
              {isAdmin ? "Alle Tickets" : "Meine Tickets"}
            </h2>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full flex-shrink-0">
              {filteredTickets.length}
            </span>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm" className="btn-primary min-h-[40px] flex-shrink-0">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Neu</span>
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="pl-9 h-10 md:h-9 input-modern text-base md:text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
            className="h-10 md:h-9 px-2 md:px-3 rounded-lg bg-secondary border-0 text-sm min-h-[40px] min-w-[100px]"
          >
            <option value="all">Alle</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearb.</option>
            <option value="resolved">Gelöst</option>
            <option value="closed">Geschl.</option>
          </select>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`h-10 md:h-9 px-2 md:px-3 rounded-lg text-sm min-h-[40px] whitespace-nowrap ${
              showArchived ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {showArchived ? "Aktiv" : "Archiv"}
          </button>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <TicketIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {search ? "Keine Tickets gefunden" : "Noch keine Tickets"}
            </p>
            {!search && (
              <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Erstes Ticket erstellen
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {groupedTickets.map(group => (
              <div key={group.label} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground px-3 py-2">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.tickets.map(ticket => {
                    const status = statusConfig[ticket.status];
                    const StatusIcon = status.icon;
                    const isSelected = selectedTicketId === ticket.id;

                    return (
                      <motion.button
                        key={ticket.id}
                        onClick={() => onSelectTicket(ticket)}
                        whileHover={{ x: 2 }}
                        className={`w-full p-3 rounded-xl text-left transition-colors min-h-[72px] ${
                          isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status.color}`}>
                            <StatusIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                #{ticket.ticket_number}
                              </span>
                              {isAdmin && ticket.user && (
                                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                  • {ticket.user.display_name}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-sm text-foreground truncate">
                              {ticket.subject}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(ticket.updated_at).toLocaleString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateTicketModal 
            onClose={() => setShowCreate(false)} 
            onCreated={(ticket) => {
              setTickets([ticket, ...tickets]);
              setShowCreate(false);
              onSelectTicket(ticket);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
