"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, Clock, Trash2, X, Check, Hash, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { ScheduledPost, Channel } from "@/types/database";

interface PostWithChannel extends ScheduledPost { channels: Pick<Channel, "id" | "name"> | null; }
interface Props { posts: PostWithChannel[]; channels: Channel[]; }

export function ContentScheduler({ posts: initial, channels }: Props) {
  const [posts, setPosts] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);

  const deletePost = async (id: string) => {
    if (!confirm("Geplanten Post löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
    if (!error) setPosts(posts.filter(p => p.id !== id));
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const isPast = (d: string) => new Date(d) < new Date();
  const pending = posts.filter(p => !p.is_posted);
  const posted = posts.filter(p => p.is_posted);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Content-Scheduler</h1>
            <p className="text-muted-foreground">{pending.length} geplante Posts</p>
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Post planen</Button>
        </div>

        {pending.length === 0 && posted.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Keine geplanten Posts</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Geplant</h2>
                <div className="space-y-3">
                  {pending.map((post) => (
                    <motion.div key={post.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`glass rounded-2xl p-5 ${isPast(post.scheduled_for) ? "ring-2 ring-yellow-500/50" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Hash className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">{post.channels?.name || "Unbekannt"}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                              <Clock className="w-3 h-3" />{formatDate(post.scheduled_for)}
                            </span>
                            {isPast(post.scheduled_for) && <span className="text-xs text-yellow-500">Überfällig</span>}
                          </div>
                          <p className="text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                          {post.attachment_url && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                              <Image className="w-4 h-4" /><span>Anhang vorhanden</span>
                            </div>
                          )}
                        </div>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deletePost(post.id)} className="p-2 rounded-lg hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {posted.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bereits gepostet</h2>
                <div className="space-y-3">
                  {posted.slice(0, 5).map((post) => (
                    <motion.div key={post.id} layout className="glass rounded-2xl p-4 opacity-60">
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{post.content}</p>
                          <p className="text-xs text-muted-foreground">#{post.channels?.name} • {formatDate(post.posted_at || post.scheduled_for)}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          {showCreate && <ScheduleModal channels={channels} onClose={() => setShowCreate(false)} onSave={(p) => { setPosts([p, ...posts].sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())); setShowCreate(false); }} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScheduleModal({ channels, onClose, onSave }: { channels: Channel[]; onClose: () => void; onSave: (p: PostWithChannel) => void }) {
  const [form, setForm] = useState({ channel_id: channels[0]?.id || "", content: "", scheduled_for: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.channel_id || !form.content.trim() || !form.scheduled_for) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: created, error } = await supabase.from("scheduled_posts").insert({
      channel_id: form.channel_id,
      user_id: user?.id!,
      content: form.content.trim(),
      scheduled_for: new Date(form.scheduled_for).toISOString(),
    }).select("*, channels(id, name)").single<PostWithChannel>();
    
    if (!error && created) onSave(created);
    setSaving(false);
  };

  const minDate = new Date().toISOString().slice(0, 16);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Post planen</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Channel</label>
            <select value={form.channel_id} onChange={(e) => setForm({ ...form, channel_id: e.target.value })} className="w-full h-12 px-4 glass border-0 rounded-xl bg-transparent text-foreground">
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Zeitpunkt</label>
            <Input type="datetime-local" value={form.scheduled_for} min={minDate} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} className="glass border-0 rounded-xl h-12" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Nachricht</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Deine Nachricht..." className="w-full h-32 p-3 glass border-0 rounded-xl resize-none text-foreground placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !form.channel_id || !form.content.trim() || !form.scheduled_for}>{saving ? "Planen..." : "Planen"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}