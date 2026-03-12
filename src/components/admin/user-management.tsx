"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Eye, CreditCard, Shield, Ban, MoreVertical, X, Plus, Minus, Check, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { User, Channel } from "@/types/database";

interface Props { users: User[]; channels: Channel[]; }

export function UserManagement({ users: initialUsers, channels }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState<"credits" | "permissions" | "ghost" | null>(null);

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.license_key?.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string | null) => name ? name.slice(0, 2).toUpperCase() : "?";
  const formatUserNumber = (n: number | null) => (n == null ? null : String(n).padStart(3, "0"));
  const formatDate = (d: string) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const updateCredits = async (userId: string, delta: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newCredits = Math.max(0, user.credits + delta);
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ credits: newCredits }).eq("id", userId);
    if (!error) setUsers(users.map(u => u.id === userId ? { ...u, credits: newCredits } : u));
  };

  const toggleBan = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ is_banned: !user.is_banned }).eq("id", userId);
    if (!error) setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !u.is_banned } : u));
  };

  const startGhostMode = (user: User) => {
    localStorage.setItem("ghostMode", JSON.stringify({ userId: user.id, displayName: user.display_name }));
    window.open("/dashboard", "_blank");
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User-Zentrale</h1>
            <p className="text-muted-foreground">{users.length} User insgesamt</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User suchen..." className="pl-12 h-12 glass border-0 rounded-xl" />
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Lizenz-Key</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Credits</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Rolle</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Erstellt</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`border-b border-border/30 hover:bg-accent/50 transition-colors ${user.is_banned ? "opacity-50" : ""}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{getInitials(user.display_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {user.display_name || "Unbenannt"}
                          {formatUserNumber((user as any).user_number ?? null) && (
                            <span className="ml-2 text-xs font-mono text-muted-foreground">
                              #{formatUserNumber((user as any).user_number ?? null)}
                            </span>
                          )}
                        </p>
                        {user.is_banned && <span className="text-xs text-destructive">Gesperrt</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><code className="text-sm text-muted-foreground font-mono">{user.license_key || "—"}</code></td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{user.credits}</span>
                      <div className="flex gap-1">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateCredits(user.id, -1)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Minus className="w-3 h-3" /></motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => updateCredits(user.id, 1)} className="p-1 rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-500"><Plus className="w-3 h-3" /></motion.button>
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><span className={`text-xs px-2 py-1 rounded-full ${user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{user.role}</span></td>
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(user.created_at)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startGhostMode(user)} className="p-2 rounded-lg hover:bg-accent" title="Ghost Mode"><Eye className="w-4 h-4 text-muted-foreground" /></motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setSelectedUser(user); setShowModal("permissions"); }} className="p-2 rounded-lg hover:bg-accent" title="Channel-Rechte"><Hash className="w-4 h-4 text-muted-foreground" /></motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => toggleBan(user.id)} className={`p-2 rounded-lg hover:bg-accent ${user.is_banned ? "text-green-500" : "text-destructive"}`} title={user.is_banned ? "Entsperren" : "Sperren"}><Ban className="w-4 h-4" /></motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permissions Modal */}
        <AnimatePresence>
          {showModal === "permissions" && selectedUser && (
            <PermissionsModal user={selectedUser} channels={channels} onClose={() => { setShowModal(null); setSelectedUser(null); }} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PermissionsModal({ user, channels, onClose }: { user: User; channels: Channel[]; onClose: () => void }) {
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; write: boolean; images: boolean; files: boolean }>>({});
  const [saving, setSaving] = useState(false);

  const togglePerm = (channelId: string, perm: "view" | "write" | "images" | "files") => {
    setPermissions(prev => ({
      ...prev,
      [channelId]: { ...prev[channelId], [perm]: !prev[channelId]?.[perm] }
    }));
  };

  const savePermissions = async () => {
    setSaving(true);
    const supabase = createClient();
    for (const [channelId, perms] of Object.entries(permissions)) {
      await supabase.from("user_channel_permissions").upsert({
        user_id: user.id,
        channel_id: channelId,
        can_view: perms.view ?? true,
        can_write: perms.write ?? false,
        can_upload_images: perms.images ?? false,
        can_upload_files: perms.files ?? false,
      }, { onConflict: "user_id,channel_id" });
    }
    setSaving(false);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Channel-Rechte: {user.display_name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/30">
              <span className="font-medium text-foreground"># {channel.name}</span>
              <div className="flex items-center gap-4">
                {["view", "write", "images", "files"].map((perm) => (
                  <label key={perm} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={permissions[channel.id]?.[perm as keyof typeof permissions[string]] ?? (perm === "view")} onChange={() => togglePerm(channel.id, perm as "view" | "write" | "images" | "files")} className="rounded" />
                    <span className="text-muted-foreground capitalize">{perm === "view" ? "Sehen" : perm === "write" ? "Schreiben" : perm === "images" ? "Bilder" : "Dateien"}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={savePermissions} disabled={saving}>{saving ? "Speichern..." : "Speichern"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}