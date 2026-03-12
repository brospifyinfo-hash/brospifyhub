"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Filter, ChevronDown, ChevronRight, Plus, X, Check,
  Crown, Shield, ShieldCheck, Star, User, Eye, Headphones,
  Award, Zap, Clock, Calendar, AlertTriangle, MoreVertical,
  Ban, Trash2, Edit2, MessageSquare, FileText, Activity,
  StickyNote, AlertCircle, CheckCircle, Info, XCircle,
  Laptop, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import type { User as UserType, Role, UserProfile, UserStats, UserNote, UserWarning, UserDevice } from "@/types/database";

// Icon mapping
const ROLE_ICON_MAP: Record<string, any> = {
  crown: Crown,
  shield: Shield,
  "shield-check": ShieldCheck,
  star: Star,
  user: User,
  eye: Eye,
  headphones: Headphones,
  award: Award,
  zap: Zap,
};

const NOTE_TYPE_CONFIG = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  positive: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  negative: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

interface ExtendedUser extends UserType {
  roles: Role[];
  profile: UserProfile | null;
  stats: UserStats | null;
  notes: UserNote[];
  warnings: UserWarning[];
  devices: UserDevice[];
  highestRole: Role | null;
}

export function UserRoleManager() {
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"roles" | "notes" | "warnings" | "devices" | "stats">("roles");
  const [newNote, setNewNote] = useState({ content: "", type: "info" as const, isImportant: false });
  const [newWarning, setNewWarning] = useState({ reason: "", type: "warning" as const, expiresAt: "" });
  const [saving, setSaving] = useState(false);

  const { isOwner, isAdmin, permissions } = usePermissions();

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch users
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersError) console.error("Error fetching users:", usersError);

    // Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("*")
      .order("hierarchy_level", { ascending: false });

    if (rolesError) console.error("Error fetching roles:", rolesError);

    // Fetch user-role assignments
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        expires_at,
        roles:role_id (*)
      `);

    // Fetch profiles
    const { data: profilesData } = await supabase.from("user_profiles").select("*");

    // Fetch stats
    const { data: statsData } = await supabase.from("user_stats").select("*");

    // Fetch notes
    const { data: notesData } = await supabase
      .from("user_notes")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch warnings
    const { data: warningsData } = await supabase
      .from("user_warnings")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch devices
    const { data: devicesData } = await supabase
      .from("user_devices")
      .select("*")
      .order("last_active", { ascending: false });

    // Map all data to users
    const extendedUsers: ExtendedUser[] = (usersData || []).map((user: UserType) => {
      const userRoles = (userRolesData || [])
        .filter((ur: any) => ur.user_id === user.id)
        .map((ur: any) => ur.roles)
        .filter((r: Role | null) => r !== null);

      const highestRole = userRoles.length > 0
        ? userRoles.reduce((prev: Role, curr: Role) =>
            curr.hierarchy_level > prev.hierarchy_level ? curr : prev
          )
        : null;

      return {
        ...user,
        roles: userRoles,
        highestRole,
        profile: profilesData?.find((p: UserProfile) => p.user_id === user.id) || null,
        stats: statsData?.find((s: UserStats) => s.user_id === user.id) || null,
        notes: (notesData || []).filter((n: UserNote) => n.user_id === user.id),
        warnings: (warningsData || []).filter((w: UserWarning) => w.user_id === user.id),
        devices: (devicesData || []).filter((d: UserDevice) => d.user_id === user.id),
      };
    });

    setUsers(extendedUsers);
    setRoles(rolesData || []);
    setLoading(false);
  };

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        !search ||
        user.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        user.license_key?.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" ||
        user.roles.some((r) => r.id === roleFilter);

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  // Open user modal
  const openUserModal = (user: ExtendedUser) => {
    setSelectedUser(user);
    setActiveTab("roles");
    setShowUserModal(true);
  };

  // Toggle role for user
  const toggleUserRole = async (userId: string, roleId: string, hasRole: boolean) => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    try {
      if (hasRole) {
        // Remove role
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role_id", roleId);
      } else {
        // Add role
        await supabase.from("user_roles").insert({
          user_id: userId,
          role_id: roleId,
          assigned_by: currentUser?.id,
        });
      }

      await fetchData();
      
      // Update selected user if modal is open
      if (selectedUser?.id === userId) {
        const updatedUser = users.find((u) => u.id === userId);
        if (updatedUser) setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error("Error toggling role:", error);
    } finally {
      setSaving(false);
    }
  };

  // Add note
  const addNote = async () => {
    if (!selectedUser || !newNote.content.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    try {
      await (supabase as any).from("user_notes").insert({
        user_id: selectedUser.id,
        author_id: currentUser?.id,
        content: newNote.content,
        note_type: newNote.type,
        is_important: newNote.isImportant,
      });

      setNewNote({ content: "", type: "info", isImportant: false });
      await fetchData();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const deleteNote = async (noteId: string) => {
    const supabase = createClient();
    await (supabase as any).from("user_notes").delete().eq("id", noteId);
    await fetchData();
  };

  // Add warning
  const addWarning = async () => {
    if (!selectedUser || !newWarning.reason.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    try {
      await (supabase as any).from("user_warnings").insert({
        user_id: selectedUser.id,
        issued_by: currentUser?.id,
        reason: newWarning.reason,
        warning_type: newWarning.type,
        expires_at: newWarning.expiresAt || null,
      });

      // Increment warning count
      await supabase
        .from("users")
        .update({ total_warnings: (selectedUser.total_warnings || 0) + 1 })
        .eq("id", selectedUser.id);

      setNewWarning({ reason: "", type: "warning", expiresAt: "" });
      await fetchData();
    } catch (error) {
      console.error("Error adding warning:", error);
    } finally {
      setSaving(false);
    }
  };

  // Revoke warning
  const revokeWarning = async (warningId: string) => {
    const supabase = createClient();
    await supabase
      .from("user_warnings")
      .update({ is_active: false })
      .eq("id", warningId);
    await fetchData();
  };

  // Block device
  const toggleDeviceBlock = async (deviceId: string, isBlocked: boolean) => {
    const supabase = createClient();
    await supabase
      .from("user_devices")
      .update({ is_blocked: !isBlocked })
      .eq("id", deviceId);
    await fetchData();
  };

  // Delete device
  const deleteDevice = async (deviceId: string) => {
    const supabase = createClient();
    await supabase.from("user_devices").delete().eq("id", deviceId);
    await fetchData();
  };

  // Ban/Unban user
  const toggleBan = async (userId: string, isBanned: boolean) => {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (isBanned) {
      // Unban
      await supabase
        .from("users")
        .update({
          is_banned: false,
          ban_reason: null,
          banned_by: null,
          banned_at: null,
        })
        .eq("id", userId);
    } else {
      // Ban
      const reason = prompt("Grund für die Sperrung:");
      if (!reason) return;

      await supabase
        .from("users")
        .update({
          is_banned: true,
          ban_reason: reason,
          banned_by: currentUser?.id,
          banned_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    await fetchData();
  };

  // Get initials
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Format date
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const RoleIcon = ({ icon }: { icon: string }) => {
    const IconComponent = ROLE_ICON_MAP[icon] || User;
    return <IconComponent className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Benutzer & Rollen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verwalte Benutzer, weise Rollen zu und füge Notizen hinzu
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name oder Lizenz-Key..."
            className="pl-10 input-modern"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input-modern min-w-[180px]"
        >
          <option value="all">Alle Rollen</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.display_name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="content-card">
          <p className="text-2xl font-bold text-foreground">{users.length}</p>
          <p className="text-sm text-muted-foreground">Gesamt</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-green-500">
            {users.filter((u) => !u.is_banned).length}
          </p>
          <p className="text-sm text-muted-foreground">Aktiv</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-red-500">
            {users.filter((u) => u.is_banned).length}
          </p>
          <p className="text-sm text-muted-foreground">Gesperrt</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-primary">
            {users.filter((u) => u.is_verified).length}
          </p>
          <p className="text-sm text-muted-foreground">Verifiziert</p>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="content-card hover:border-primary/30 cursor-pointer transition-colors"
            onClick={() => openUserModal(user)}
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <Avatar className="w-12 h-12">
                <AvatarFallback
                  className="text-sm font-semibold"
                  style={{
                    backgroundColor: user.highestRole?.color
                      ? user.highestRole.color + "20"
                      : undefined,
                    color: user.highestRole?.color,
                  }}
                >
                  {getInitials(user.display_name)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">
                    {user.display_name || "Unbekannt"}
                  </h3>
                  {user.is_banned && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs flex items-center gap-1">
                      <Ban className="w-3 h-3" />
                      Gesperrt
                    </span>
                  )}
                  {user.is_verified && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verifiziert
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {user.license_key || "Kein Key"}
                </p>
              </div>

              {/* Roles */}
              <div className="hidden md:flex items-center gap-1 flex-wrap">
                {user.roles.slice(0, 3).map((role) => (
                  <span
                    key={role.id}
                    className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                    style={{
                      backgroundColor: role.color + "20",
                      color: role.color,
                    }}
                  >
                    <RoleIcon icon={role.icon} />
                    {role.display_name}
                  </span>
                ))}
                {user.roles.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{user.roles.length - 3}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {user.stats?.total_messages || 0}
                </div>
                <div className="flex items-center gap-1">
                  <StickyNote className="w-4 h-4" />
                  {user.notes.length}
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {user.warnings.filter((w) => w.is_active).length}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </motion.div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Keine Benutzer gefunden
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback
                        className="text-xl font-semibold"
                        style={{
                          backgroundColor: selectedUser.highestRole?.color
                            ? selectedUser.highestRole.color + "20"
                            : undefined,
                          color: selectedUser.highestRole?.color,
                        }}
                      >
                        {getInitials(selectedUser.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        {selectedUser.display_name || "Unbekannt"}
                        {selectedUser.highestRole && (
                          <span
                            className="px-2 py-0.5 rounded-lg text-xs"
                            style={{
                              backgroundColor: selectedUser.highestRole.color + "20",
                              color: selectedUser.highestRole.color,
                            }}
                          >
                            {selectedUser.highestRole.display_name}
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedUser.license_key || "Kein Lizenz-Key"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Dabei seit {formatDate(selectedUser.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Ban Button */}
                    <Button
                      variant={selectedUser.is_banned ? "default" : "destructive"}
                      size="sm"
                      onClick={() => toggleBan(selectedUser.id, selectedUser.is_banned)}
                    >
                      {selectedUser.is_banned ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Entsperren
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 mr-1" />
                          Sperren
                        </>
                      )}
                    </Button>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border overflow-x-auto">
                {[
                  { id: "roles", label: "Rollen", icon: Shield },
                  { id: "notes", label: "Notizen", icon: StickyNote, count: selectedUser.notes.length },
                  { id: "warnings", label: "Verwarnungen", icon: AlertTriangle, count: selectedUser.warnings.filter((w) => w.is_active).length },
                  { id: "devices", label: "Geräte", icon: Laptop, count: selectedUser.devices.length },
                  { id: "stats", label: "Statistiken", icon: Activity },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                      activeTab === tab.id
                        ? "text-primary border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Roles Tab */}
                {activeTab === "roles" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Klicke auf eine Rolle um sie zuzuweisen oder zu entfernen
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {roles
                        .filter((r) => r.is_assignable || selectedUser.roles.some((ur) => ur.id === r.id))
                        .map((role) => {
                          const hasRole = selectedUser.roles.some((r) => r.id === role.id);
                          return (
                            <button
                              key={role.id}
                              onClick={() => toggleUserRole(selectedUser.id, role.id, hasRole)}
                              disabled={saving || (!role.is_assignable && !hasRole)}
                              className={`p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                                hasRole
                                  ? "bg-primary/10 border-2 border-primary/30"
                                  : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                              } ${!role.is_assignable && !hasRole ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{
                                  backgroundColor: role.color + "20",
                                  color: role.color,
                                }}
                              >
                                <RoleIcon icon={role.icon} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{role.display_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Level {role.hierarchy_level}
                                </p>
                              </div>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  hasRole ? "bg-primary text-primary-foreground" : "bg-muted"
                                }`}
                              >
                                {hasRole && <Check className="w-4 h-4" />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    {/* Add Note Form */}
                    <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                      <Textarea
                        value={newNote.content}
                        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                        placeholder="Neue Notiz hinzufügen..."
                        rows={3}
                        className="input-modern resize-none"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-2">
                          {(["info", "warning", "positive", "negative"] as const).map((type) => {
                            const config = NOTE_TYPE_CONFIG[type];
                            return (
                              <button
                                key={type}
                                onClick={() => setNewNote({ ...newNote, type: type as any })}
                                className={`p-2 rounded-lg transition-colors ${
                                  newNote.type === type ? config.bg + " " + config.color : "bg-muted"
                                }`}
                              >
                                <config.icon className="w-4 h-4" />
                              </button>
                            );
                          })}
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newNote.isImportant}
                            onChange={(e) => setNewNote({ ...newNote, isImportant: e.target.checked })}
                            className="rounded"
                          />
                          Wichtig
                        </label>
                        <Button
                          onClick={addNote}
                          disabled={saving || !newNote.content.trim()}
                          className="ml-auto"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Hinzufügen
                        </Button>
                      </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-3">
                      {selectedUser.notes.map((note) => {
                        const config = NOTE_TYPE_CONFIG[note.note_type as keyof typeof NOTE_TYPE_CONFIG] || NOTE_TYPE_CONFIG.info;
                        return (
                          <div
                            key={note.id}
                            className={`p-4 rounded-xl ${config.bg} border border-current/10`}
                          >
                            <div className="flex items-start gap-3">
                              <config.icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                              <div className="flex-1">
                                <p className="text-sm">{note.content}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatDate(note.created_at)}
                                  {note.is_important && (
                                    <span className="ml-2 text-yellow-500">★ Wichtig</span>
                                  )}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteNote(note.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {selectedUser.notes.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Keine Notizen vorhanden
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Warnings Tab */}
                {activeTab === "warnings" && (
                  <div className="space-y-4">
                    {/* Add Warning Form */}
                    <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                      <Textarea
                        value={newWarning.reason}
                        onChange={(e) => setNewWarning({ ...newWarning, reason: e.target.value })}
                        placeholder="Grund für die Verwarnung..."
                        rows={2}
                        className="input-modern resize-none"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          value={newWarning.type}
                          onChange={(e) => setNewWarning({ ...newWarning, type: e.target.value as any })}
                          className="input-modern"
                        >
                          <option value="warning">Verwarnung</option>
                          <option value="mute">Stummschaltung</option>
                          <option value="note">Notiz</option>
                        </select>
                        <Input
                          type="date"
                          value={newWarning.expiresAt}
                          onChange={(e) => setNewWarning({ ...newWarning, expiresAt: e.target.value })}
                          placeholder="Ablaufdatum (optional)"
                          className="input-modern w-auto"
                        />
                        <Button
                          onClick={addWarning}
                          disabled={saving || !newWarning.reason.trim()}
                          variant="destructive"
                          className="ml-auto"
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Verwarnung
                        </Button>
                      </div>
                    </div>

                    {/* Warnings List */}
                    <div className="space-y-3">
                      {selectedUser.warnings.map((warning) => (
                        <div
                          key={warning.id}
                          className={`p-4 rounded-xl border ${
                            warning.is_active
                              ? "bg-red-500/5 border-red-500/20"
                              : "bg-muted/50 border-border opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle
                              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                warning.is_active ? "text-red-500" : "text-muted-foreground"
                              }`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs ${
                                    warning.warning_type === "mute"
                                      ? "bg-yellow-500/10 text-yellow-500"
                                      : warning.warning_type === "ban"
                                      ? "bg-red-500/10 text-red-500"
                                      : "bg-orange-500/10 text-orange-500"
                                  }`}
                                >
                                  {warning.warning_type === "mute"
                                    ? "Stummschaltung"
                                    : warning.warning_type === "ban"
                                    ? "Sperre"
                                    : "Verwarnung"}
                                </span>
                                {!warning.is_active && (
                                  <span className="text-xs text-muted-foreground">
                                    (Widerrufen)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{warning.reason}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDate(warning.created_at)}
                                {warning.expires_at && (
                                  <span className="ml-2">
                                    • Läuft ab: {formatDate(warning.expires_at)}
                                  </span>
                                )}
                              </p>
                            </div>
                            {warning.is_active && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => revokeWarning(warning.id)}
                              >
                                Widerrufen
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedUser.warnings.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Keine Verwarnungen vorhanden
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Devices Tab */}
                {activeTab === "devices" && (
                  <div className="space-y-3">
                    {selectedUser.devices.map((device) => (
                      <div
                        key={device.id}
                        className={`p-4 rounded-xl border ${
                          device.is_blocked
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-muted/50 border-border"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Laptop
                            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                              device.is_blocked ? "text-red-500" : "text-muted-foreground"
                            }`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">
                                {device.device_name || "Unbekanntes Gerät"}
                              </p>
                              {device.is_blocked && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs">
                                  Blockiert
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {device.city}, {device.country} • {device.ip_address}
                              </p>
                              <p>Zuletzt aktiv: {formatDate(device.last_active)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={device.is_blocked ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleDeviceBlock(device.id, device.is_blocked)}
                            >
                              {device.is_blocked ? "Freigeben" : "Blockieren"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteDevice(device.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedUser.devices.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Keine Geräte registriert
                      </p>
                    )}
                  </div>
                )}

                {/* Stats Tab */}
                {activeTab === "stats" && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.stats?.total_messages || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Nachrichten</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.stats?.total_files_uploaded || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Dateien hochgeladen</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.stats?.total_login_days || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Login-Tage</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        Level {selectedUser.stats?.level || 1}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedUser.stats?.experience_points || 0} XP
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.profile_views || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Profil-Aufrufe</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.reputation_score || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Reputation</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedUser.credits || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Credits</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
