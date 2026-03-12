"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, Zap, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { QuickReply } from "@/types/database";

interface Props { replies: QuickReply[]; }

const categories = ["general", "support", "billing", "technical"];

export function QuickRepliesManager({ replies: initial }: Props) {
  const [replies, setReplies] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editReply, setEditReply] = useState<QuickReply | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const deleteReply = async (id: string) => {
    if (!confirm("Vorlage wirklich löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("quick_replies").delete().eq("id", id);
    if (!error) setReplies(replies.filter(r => r.id !== id));
  };

  const copyToClipboard = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = replies.filter(r => r.category === cat);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quick-Replies</h1>
            <p className="text-muted-foreground">Vorlagen für schnelle Antworten</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Neue Vorlage</Button>
        </div>

        {replies.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <Zap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Noch keine Quick-Replies erstellt</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => grouped[cat]?.length > 0 && (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 capitalize">{cat}</h2>
                <div className="space-y-2">
                  {grouped[cat].map((reply) => (
                    <motion.div key={reply.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground">{reply.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{reply.content}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => copyToClipboard(reply.id, reply.content)} className="p-2 rounded-lg hover:bg-accent">
                            {copied === reply.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setEditReply(reply)} className="p-2 rounded-lg hover:bg-accent">
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteReply(reply.id)} className="p-2 rounded-lg hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {(showCreate || editReply) && (
            <ReplyModal reply={editReply} onClose={() => { setShowCreate(false); setEditReply(null); }} onSave={(r) => {
              if (editReply) setReplies(replies.map(rp => rp.id === r.id ? r : rp));
              else setReplies([r, ...replies]);
              setShowCreate(false); setEditReply(null);
            }} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReplyModal({ reply, onClose, onSave }: { reply: QuickReply | null; onClose: () => void; onSave: (r: QuickReply) => void }) {
  const [form, setForm] = useState({ title: reply?.title || "", content: reply?.content || "", category: reply?.category || "general" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const data = { title: form.title.trim(), content: form.content.trim(), category: form.category, created_by: user?.id };

    if (reply) {
      const { data: updated, error } = await supabase.from("quick_replies").update(data).eq("id", reply.id).select().single<QuickReply>();
      if (!error && updated) onSave(updated);
    } else {
      const { data: created, error } = await supabase.from("quick_replies").insert(data).select().single<QuickReply>();
      if (!error && created) onSave(created);
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{reply ? "Vorlage bearbeiten" : "Neue Vorlage"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Titel</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Willkommensnachricht" className="glass border-0 rounded-xl h-12" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Kategorie</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setForm({ ...form, category: cat })} className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${form.category === cat ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/80"}`}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Inhalt</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Die Nachricht, die gesendet wird..." className="w-full h-32 p-3 glass border-0 rounded-xl resize-none text-foreground placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>{saving ? "Speichern..." : "Speichern"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}