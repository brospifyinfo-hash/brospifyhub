"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Hash, Trophy, Star, Edit2, Trash2, X, Eye, EyeOff, Clock, Check,
  MessageSquare, Image, FileText, Download, Copy, FolderOpen, Shield, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Channel, ChannelType, ChannelCategory, Role, ChannelRolePermission } from "@/types/database";

interface Props { 
  channels: Channel[]; 
}

const channelTypes: { value: ChannelType; label: string; icon: typeof Hash; description: string }[] = [
  { value: "standard", label: "Standard", icon: Hash, description: "Normaler Content-Channel" },
  { value: "success_stories", label: "Success Stories", icon: Star, description: "Erfolgsgeschichten der Community" },
];

export function ChannelManager({ channels: initial }: Props) {
  const [channels, setChannels] = useState(initial.filter(c => c.type !== "winning_product" && c.type !== "support"));
  const [showCreate, setShowCreate] = useState(false);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);

  const deleteChannel = async (id: string) => {
    if (!confirm("Channel wirklich löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("channels").delete().eq("id", id);
    if (!error) setChannels(channels.filter(c => c.id !== id));
  };

  const toggleVisibility = async (channel: Channel) => {
    const supabase = createClient();
    const { error } = await supabase.from("channels").update({ is_visible: !channel.is_visible }).eq("id", channel.id);
    if (!error) setChannels(channels.map(c => c.id === channel.id ? { ...c, is_visible: !c.is_visible } : c));
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Channel-Manager</h1>
            <p className="text-muted-foreground">{channels.length} Channels</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />Neuer Channel
          </Button>
        </div>

        {channels.length === 0 ? (
          <div className="content-card text-center py-12">
            <Hash className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Noch keine Channels erstellt</p>
            <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />Ersten Channel erstellen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => {
              const TypeIcon = channelTypes.find(t => t.value === channel.type)?.icon || Hash;
              return (
                <motion.div 
                  key={channel.id} 
                  layout 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`content-card ${!channel.is_visible ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TypeIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{channel.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{channelTypes.find(t => t.value === channel.type)?.label || channel.type}</span>
                          {channel.allow_user_text && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />Text
                            </span>
                          )}
                          {channel.allow_user_images && (
                            <span className="flex items-center gap-1">
                              <Image className="w-3 h-3" />Bilder
                            </span>
                          )}
                          {channel.requires_approval && (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" />Freigabe
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => toggleVisibility(channel)} 
                        className="p-2 rounded-lg hover:bg-accent"
                      >
                        {channel.is_visible ? (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => setEditChannel(channel)} 
                        className="p-2 rounded-lg hover:bg-accent"
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => deleteChannel(channel.id)} 
                        className="p-2 rounded-lg hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {(showCreate || editChannel) && (
            <ChannelModal 
              channel={editChannel} 
              onClose={() => { setShowCreate(false); setEditChannel(null); }} 
              onSave={(c) => {
                if (editChannel) setChannels(channels.map(ch => ch.id === c.id ? c : ch));
                else setChannels([c, ...channels]);
                setShowCreate(false); 
                setEditChannel(null);
              }} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface RolePermissionState {
  [roleId: string]: {
    can_view: boolean;
    can_send_messages: boolean;
    can_send_images: boolean;
    can_send_files: boolean;
    can_delete_messages: boolean;
    can_pin_messages: boolean;
    can_manage_channel: boolean;
  };
}

function ChannelModal({ channel, onClose, onSave }: { 
  channel: Channel | null; 
  onClose: () => void; 
  onSave: (c: Channel) => void;
}) {
  const [form, setForm] = useState({
    name: channel?.name || "",
    type: channel?.type || "standard" as ChannelType,
    description: channel?.description || "",
    requires_approval: channel?.requires_approval || false,
    rate_limit_seconds: channel?.rate_limit_seconds || 0,
    show_history_from: channel?.show_history_from ? "custom" : "all",
    allow_user_text: channel?.allow_user_text || false,
    allow_user_images: channel?.allow_user_images || false,
    allow_user_files: channel?.allow_user_files || false,
    show_download_button: channel?.show_download_button ?? true,
    show_copy_button: channel?.show_copy_button ?? true,
    category_id: channel?.category_id || null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionState>({});
  const [showRolePerms, setShowRolePerms] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Fetch categories
    supabase.from("channel_categories").select("*").order("order_index").then(({ data }) => {
      if (data) setCategories(data);
    });

    // Fetch roles – Standard aus Rollen-Tabelle (can_send_messages etc.), Channel-Ausnahmen pro Rolle
    supabase.from("roles").select("*").order("hierarchy_level", { ascending: false }).then(({ data }) => {
      if (data) {
        setRoles(data);
        const defaultPerms: RolePermissionState = {};
        data.forEach(role => {
          defaultPerms[role.id] = {
            can_view: true,
            can_send_messages: role.can_send_messages ?? false,
            can_send_images: role.can_send_images ?? false,
            can_send_files: role.can_send_files ?? false,
            can_delete_messages: role.hierarchy_level >= 60,
            can_pin_messages: role.hierarchy_level >= 60,
            can_manage_channel: role.hierarchy_level >= 80,
          };
        });
        setRolePermissions(defaultPerms);
      }
    });

    // Fetch existing channel role permissions if editing
    if (channel) {
      supabase
        .from("channel_role_permissions")
        .select("*")
        .eq("channel_id", channel.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const perms: RolePermissionState = {};
            data.forEach(perm => {
              perms[perm.role_id] = {
                can_view: perm.can_view,
                can_send_messages: perm.can_send_messages,
                can_send_images: perm.can_send_images,
                can_send_files: perm.can_send_files,
                can_delete_messages: perm.can_delete_messages,
                can_pin_messages: perm.can_pin_messages,
                can_manage_channel: perm.can_manage_channel,
              };
            });
            setRolePermissions(prev => ({ ...prev, ...perms }));
          }
        });
    }
  }, [channel]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const data = {
      name: form.name.trim(),
      type: form.type,
      description: form.description || null,
      requires_approval: form.requires_approval,
      rate_limit_seconds: form.rate_limit_seconds,
      show_history_from: form.show_history_from === "custom" ? new Date().toISOString() : null,
      allow_user_text: form.allow_user_text,
      allow_user_images: form.allow_user_images,
      allow_user_files: form.allow_user_files,
      show_download_button: form.show_download_button,
      show_copy_button: form.show_copy_button,
      is_visible: true,
      settings: { posting_enabled: true },
      category_id: form.category_id,
    };

    if (channel) {
      const { data: updated, error: updateError } = await supabase
        .from("channels")
        .update(data)
        .eq("id", channel.id)
        .select()
        .single<Channel>();
      if (updateError) {
        console.error("Update error:", updateError);
        setError(updateError.message);
      } else if (updated) {
        // Update role permissions
        await saveRolePermissions(supabase, updated.id);
        onSave(updated);
      }
    } else {
      const { data: created, error: createError } = await supabase
        .from("channels")
        .insert(data)
        .select()
        .single<Channel>();
      if (createError) {
        console.error("Create error:", createError);
        setError(createError.message);
      } else if (created) {
        // Save role permissions for new channel
        await saveRolePermissions(supabase, created.id);
        onSave(created);
      }
    }
    setSaving(false);
  };

  const saveRolePermissions = async (supabase: ReturnType<typeof createClient>, channelId: string) => {
    // Delete existing permissions
    await supabase.from("channel_role_permissions").delete().eq("channel_id", channelId);
    
    // Insert new permissions
    const permInserts = Object.entries(rolePermissions).map(([roleId, perms]) => ({
      channel_id: channelId,
      role_id: roleId,
      ...perms
    }));

    if (permInserts.length > 0) {
      await supabase.from("channel_role_permissions").insert(permInserts);
    }
  };

  const updateRolePerm = (roleId: string, key: keyof RolePermissionState[string], value: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [key]: value
      }
    }));
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
        className="content-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {channel ? "Channel bearbeiten" : "Neuer Channel"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Name</label>
            <Input 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              placeholder="Channel-Name" 
              className="input-modern h-12" 
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Typ</label>
            <div className="grid grid-cols-2 gap-2">
              {channelTypes.map((t) => (
                <button 
                  key={t.value} 
                  onClick={() => setForm({ ...form, type: t.value })} 
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    form.type === t.value 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <t.icon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Beschreibung</label>
            <Input 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder="Optional" 
              className="input-modern h-12" 
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Kategorie</label>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <select
                value={form.category_id || ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
                className="flex-1 h-12 px-4 rounded-xl bg-secondary border-0 text-foreground"
              >
                <option value="">Keine Kategorie</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              Fehler: {error}
            </div>
          )}

          {/* User Permissions */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-3">User-Berechtigungen</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <input 
                  type="checkbox" 
                  checked={form.allow_user_text} 
                  onChange={(e) => setForm({ ...form, allow_user_text: e.target.checked })} 
                  className="rounded border-border"
                />
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">User dürfen Text senden</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <input 
                  type="checkbox" 
                  checked={form.allow_user_images} 
                  onChange={(e) => setForm({ ...form, allow_user_images: e.target.checked })} 
                  className="rounded border-border"
                />
                <Image className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">User dürfen Bilder senden</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <input 
                  type="checkbox" 
                  checked={form.allow_user_files} 
                  onChange={(e) => setForm({ ...form, allow_user_files: e.target.checked })} 
                  className="rounded border-border"
                />
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">User dürfen Dateien senden</span>
              </label>
            </div>
          </div>

          {/* Content Options */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-3">Content-Optionen</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <input 
                  type="checkbox" 
                  checked={form.show_download_button} 
                  onChange={(e) => setForm({ ...form, show_download_button: e.target.checked })} 
                  className="rounded border-border"
                />
                <Download className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Download-Button bei Medien anzeigen</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
                <input 
                  type="checkbox" 
                  checked={form.show_copy_button} 
                  onChange={(e) => setForm({ ...form, show_copy_button: e.target.checked })} 
                  className="rounded border-border"
                />
                <Copy className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Kopieren-Button bei Text anzeigen</span>
              </label>
            </div>
          </div>

          {/* History Visibility */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Verlauf sichtbar</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setForm({ ...form, show_history_from: "all" })} 
                className={`flex-1 p-3 rounded-xl border text-sm transition-colors ${
                  form.show_history_from === "all" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                Alles sehen
              </button>
              <button 
                onClick={() => setForm({ ...form, show_history_from: "custom" })} 
                className={`flex-1 p-3 rounded-xl border text-sm transition-colors ${
                  form.show_history_from === "custom" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                Ab Beitritt
              </button>
            </div>
          </div>

          {/* Rate Limit */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Rate-Limit (Sekunden zwischen Posts)
            </label>
            <Input 
              type="number" 
              value={form.rate_limit_seconds} 
              onChange={(e) => setForm({ ...form, rate_limit_seconds: parseInt(e.target.value) || 0 })} 
              className="input-modern h-12" 
              min={0}
            />
          </div>

          {/* Approval Required */}
          <label className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer">
            <input 
              type="checkbox" 
              checked={form.requires_approval} 
              onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })} 
              className="rounded border-border"
            />
            <div>
              <p className="font-medium text-foreground">Freigabe erforderlich</p>
              <p className="text-sm text-muted-foreground">Posts müssen vom Admin freigegeben werden</p>
            </div>
          </label>

          {/* Role-based Permissions */}
          <div>
            <button
              type="button"
              onClick={() => setShowRolePerms(!showRolePerms)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium text-foreground">Rollen-Berechtigungen</p>
                  <p className="text-sm text-muted-foreground">Detaillierte Berechtigungen pro Rolle</p>
                </div>
              </div>
              {showRolePerms ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            <AnimatePresence>
              {showRolePerms && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {roles.map(role => (
                      <div key={role.id} className="p-3 rounded-xl bg-secondary/30 border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <div 
                            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: `${role.color}30`, color: role.color }}
                          >
                            {role.display_name[0]}
                          </div>
                          <span className="font-medium text-sm" style={{ color: role.color }}>
                            {role.display_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (Level {role.hierarchy_level})
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { key: "can_view", label: "Sehen" },
                            { key: "can_send_messages", label: "Schreiben" },
                            { key: "can_send_images", label: "Bilder" },
                            { key: "can_send_files", label: "Dateien" },
                            { key: "can_delete_messages", label: "Löschen" },
                            { key: "can_manage_channel", label: "Verwalten" },
                          ].map(({ key, label }) => (
                            <label 
                              key={key}
                              className="flex items-center gap-2 text-xs cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={rolePermissions[role.id]?.[key as keyof RolePermissionState[string]] || false}
                                onChange={(e) => updateRolePerm(role.id, key as keyof RolePermissionState[string], e.target.checked)}
                                className="rounded border-border w-4 h-4"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
