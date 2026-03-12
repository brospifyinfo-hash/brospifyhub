"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Ticket as TicketIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Ticket, TicketCategory } from "@/types/database";

interface Props {
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

export function CreateTicketModal({ onClose, onCreated }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ticket_categories")
      .select("*")
      .order("order_index", { ascending: true })
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Nicht eingeloggt");
      setSaving(false);
      return;
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        category_id: categoryId || null,
      })
      .select()
      .single<Ticket>();

    if (ticketError || !ticket) {
      setError(ticketError?.message || "Fehler beim Erstellen");
      setSaving(false);
      return;
    }

    // Create first message
    const { error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        content: message.trim(),
      });

    if (msgError) {
      setError(msgError.message);
      setSaving(false);
      return;
    }

    onCreated(ticket);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="content-card w-full max-w-lg"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TicketIcon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Neues Ticket</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Kategorie (optional)
            </label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="input-modern h-12 w-full bg-background border border-input rounded-lg px-3 text-foreground"
            >
              <option value="">Keine Kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Betreff
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Worum geht es?"
              className="input-modern h-12"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Nachricht
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Beschreibe dein Anliegen..."
              className="input-modern min-h-[120px] resize-none"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={saving || !subject.trim() || !message.trim()}
              className="btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Erstellen...
                </>
              ) : (
                "Ticket erstellen"
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
