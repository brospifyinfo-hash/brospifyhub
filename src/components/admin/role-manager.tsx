"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Shield, ShieldCheck, Star, User, Eye, Headphones,
  Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight,
  Check, AlertTriangle, Palette, Hash, Users, Lock, Unlock,
  FileText, MessageSquare, Settings, HelpCircle, Award,
  Zap, Clock, Upload, AtSign, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSION_LABELS, PERMISSION_CATEGORIES } from "@/lib/permissions";
import type { Role, Permission, RoleWithPermissions, PermissionCategory } from "@/types/database";

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

const AVAILABLE_ICONS = [
  { value: "crown", label: "Krone", Icon: Crown },
  { value: "shield", label: "Schild", Icon: Shield },
  { value: "shield-check", label: "Schild (Check)", Icon: ShieldCheck },
  { value: "star", label: "Stern", Icon: Star },
  { value: "user", label: "Person", Icon: User },
  { value: "eye", label: "Auge", Icon: Eye },
  { value: "headphones", label: "Kopfhörer", Icon: Headphones },
  { value: "award", label: "Auszeichnung", Icon: Award },
  { value: "zap", label: "Blitz", Icon: Zap },
];

const PRESET_COLORS = [
  "#FFD700", "#FF4444", "#9B59B6", "#3498DB", "#F39C12",
  "#95BF47", "#808080", "#E91E63", "#00BCD4", "#4CAF50",
  "#FF5722", "#607D8B", "#8BC34A", "#FFEB3B", "#673AB7",
];

interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  color: string;
  icon: string;
  hierarchy_level: number;
  is_assignable: boolean;
  permissions: string[];
  max_file_size_mb: number;
  daily_message_limit: number | null;
  can_use_custom_emojis: boolean;
  can_mention_everyone: boolean;
  priority_support: boolean;
  custom_badge_text: string;
  custom_badge_color: string;
}

const defaultFormData: RoleFormData = {
  name: "",
  display_name: "",
  description: "",
  color: "#95BF47",
  icon: "user",
  hierarchy_level: 20,
  is_assignable: true,
  permissions: [],
  max_file_size_mb: 10,
  daily_message_limit: null,
  can_use_custom_emojis: true,
  can_mention_everyone: false,
  priority_support: false,
  custom_badge_text: "",
  custom_badge_color: "",
};

export function RoleManager() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(defaultFormData);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["system", "channels", "messages"]));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "permissions" | "limits">("general");

  const { isOwner, isAdmin } = usePermissions();

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("*")
      .order("hierarchy_level", { ascending: false });

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
    }

    // Fetch permissions
    const { data: permissionsData, error: permissionsError } = await supabase
      .from("permissions")
      .select("*")
      .order("category");

    if (permissionsError) {
      console.error("Error fetching permissions:", permissionsError);
    }

    // Fetch role-permission mappings
    const { data: rolePermData } = await supabase
      .from("role_permissions")
      .select(`
        role_id,
        permission_id,
        permissions:permission_id (name)
      `);

    // Map permissions to roles
    const rolesWithPerms: RoleWithPermissions[] = (rolesData || []).map((role: Role) => {
      const rolePerms = (rolePermData || [])
        .filter((rp: any) => rp.role_id === role.id)
        .map((rp: any) => rp.permissions)
        .filter((p: Permission | null) => p !== null);

      return {
        ...role,
        permissions: rolePerms,
        permissionNames: rolePerms.map((p: Permission) => p.name),
      };
    });

    setRoles(rolesWithPerms);
    setPermissions(permissionsData || []);
    setLoading(false);
  };

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      const cat = perm.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(perm);
    });
    return grouped;
  }, [permissions]);

  // Open create modal
  const handleCreate = () => {
    setEditingRole(null);
    setFormData(defaultFormData);
    setActiveTab("general");
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || "",
      color: role.color,
      icon: role.icon,
      hierarchy_level: role.hierarchy_level,
      is_assignable: role.is_assignable,
      permissions: role.permissionNames || [],
      max_file_size_mb: role.max_file_size_mb || 10,
      daily_message_limit: role.daily_message_limit,
      can_use_custom_emojis: role.can_use_custom_emojis ?? true,
      can_mention_everyone: role.can_mention_everyone ?? false,
      priority_support: role.priority_support ?? false,
      custom_badge_text: role.custom_badge_text || "",
      custom_badge_color: role.custom_badge_color || "",
    });
    setActiveTab("general");
    setShowModal(true);
  };

  // Save role
  const handleSave = async () => {
    if (!formData.name || !formData.display_name) return;

    setSaving(true);
    const supabase = createClient();

    try {
      const roleData = {
        name: formData.name.toLowerCase().replace(/\s+/g, "_"),
        display_name: formData.display_name,
        description: formData.description || null,
        color: formData.color,
        icon: formData.icon,
        hierarchy_level: formData.hierarchy_level,
        is_assignable: formData.is_assignable,
        max_file_size_mb: formData.max_file_size_mb,
        daily_message_limit: formData.daily_message_limit,
        can_use_custom_emojis: formData.can_use_custom_emojis,
        can_mention_everyone: formData.can_mention_everyone,
        priority_support: formData.priority_support,
        custom_badge_text: formData.custom_badge_text || null,
        custom_badge_color: formData.custom_badge_color || null,
        updated_at: new Date().toISOString(),
      };

      let roleId: string;

      if (editingRole) {
        // Update existing role
        const { error } = await supabase
          .from("roles")
          .update(roleData)
          .eq("id", editingRole.id);

        if (error) throw error;
        roleId = editingRole.id;
      } else {
        // Create new role
        const { data, error } = await supabase
          .from("roles")
          .insert({ ...roleData, is_system: false })
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      // Update permissions
      // First, delete all existing permissions for this role
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);

      // Then insert new permissions
      if (formData.permissions.length > 0) {
        const permissionIds = permissions
          .filter((p) => formData.permissions.includes(p.name))
          .map((p) => ({ role_id: roleId, permission_id: p.id }));

        if (permissionIds.length > 0) {
          await supabase.from("role_permissions").insert(permissionIds);
        }
      }

      await fetchData();
      setShowModal(false);
    } catch (error) {
      console.error("Error saving role:", error);
    } finally {
      setSaving(false);
    }
  };

  // Delete role
  const handleDelete = async (roleId: string) => {
    const supabase = createClient();

    try {
      await supabase.from("roles").delete().eq("id", roleId);
      await fetchData();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  // Toggle permission
  const togglePermission = (permName: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permName)
        ? prev.permissions.filter((p) => p !== permName)
        : [...prev.permissions, permName],
    }));
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Select all permissions in category
  const selectAllInCategory = (category: string) => {
    const catPerms = permissionsByCategory[category] || [];
    const allSelected = catPerms.every((p) => formData.permissions.includes(p.name));

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter(
          (p) => !catPerms.map((cp) => cp.name).includes(p)
        ),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...catPerms.map((p) => p.name)])],
      }));
    }
  };

  const RoleIcon = ({ icon }: { icon: string }) => {
    const IconComponent = ROLE_ICON_MAP[icon] || User;
    return <IconComponent className="w-5 h-5" />;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Rollen-Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Erstelle und verwalte Rollen mit individuellen Berechtigungen
          </p>
        </div>
        
        {isOwner && (
          <Button onClick={handleCreate} className="btn-primary gap-2">
            <Plus className="w-4 h-4" />
            Neue Rolle
          </Button>
        )}
      </div>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="content-card group relative"
          >
            {/* Delete Confirmation Overlay */}
            <AnimatePresence>
              {deleteConfirm === role.id && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-2xl z-10 flex flex-col items-center justify-center p-4"
                >
                  <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
                  <p className="text-sm text-center mb-4">
                    Rolle &quot;{role.display_name}&quot; wirklich löschen?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(role.id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Role Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: role.color + "20", color: role.color }}
                >
                  <RoleIcon icon={role.icon} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{role.display_name}</h3>
                  <p className="text-xs text-muted-foreground">@{role.name}</p>
                </div>
              </div>

              {/* Actions */}
              {!role.is_system && isOwner && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(role)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(role.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {role.is_system && (
                <div className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  System
                </div>
              )}
            </div>

            {/* Description */}
            {role.description && (
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {role.description}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-foreground">{role.hierarchy_level}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Level</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-foreground">
                  {role.permissionNames?.length || 0}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Rechte</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-foreground">
                  {role.is_assignable ? "Ja" : "Nein"}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Zuweisbar</p>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {role.priority_support && (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Priority
                </span>
              )}
              {role.can_mention_everyone && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs flex items-center gap-1">
                  <AtSign className="w-3 h-3" />
                  @everyone
                </span>
              )}
              {role.can_use_custom_emojis && (
                <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-500 text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Emojis
                </span>
              )}
            </div>

            {/* Edit Button for System Roles */}
            {role.is_system && isOwner && (
              <button
                onClick={() => handleEdit(role)}
                className="w-full mt-4 py-2 rounded-lg bg-muted hover:bg-accent text-sm transition-colors"
              >
                Berechtigungen bearbeiten
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-card rounded-2xl shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: formData.color + "20", color: formData.color }}
                  >
                    <RoleIcon icon={formData.icon} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {editingRole ? "Rolle bearbeiten" : "Neue Rolle erstellen"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formData.display_name || "Unbenannte Rolle"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {[
                  { id: "general", label: "Allgemein", icon: Settings },
                  { id: "permissions", label: "Berechtigungen", icon: Shield },
                  { id: "limits", label: "Limits & Features", icon: Zap },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === tab.id
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === "general" && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Anzeigename *</label>
                        <Input
                          value={formData.display_name}
                          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                          placeholder="z.B. Moderator"
                          className="input-modern"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Technischer Name *</label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="z.B. moderator"
                          disabled={editingRole?.is_system}
                          className="input-modern"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Beschreibung</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Kurze Beschreibung der Rolle..."
                        rows={3}
                        className="input-modern resize-none"
                      />
                    </div>

                    {/* Color & Icon */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">Farbe</label>
                        <div className="flex flex-wrap gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setFormData({ ...formData, color })}
                              className={`w-8 h-8 rounded-lg transition-all ${
                                formData.color === color
                                  ? "ring-2 ring-offset-2 ring-primary"
                                  : "hover:scale-110"
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          <Input
                            type="color"
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="w-8 h-8 p-0 border-0 cursor-pointer rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Icon</label>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_ICONS.map(({ value, Icon }) => (
                            <button
                              key={value}
                              onClick={() => setFormData({ ...formData, icon: value })}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                formData.icon === value
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-accent"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Hierarchy & Assignable */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Hierarchie-Level (0-100)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.hierarchy_level}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hierarchy_level: parseInt(e.target.value) || 0,
                            })
                          }
                          className="input-modern"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Höher = mehr Autorität. Owner=100, Admin=80, Member=20
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Zuweisbar</label>
                        <button
                          onClick={() =>
                            setFormData({ ...formData, is_assignable: !formData.is_assignable })
                          }
                          className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                            formData.is_assignable
                              ? "bg-green-500/10 text-green-500 border border-green-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {formData.is_assignable ? (
                            <>
                              <Unlock className="w-4 h-4" />
                              Kann zugewiesen werden
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              Nicht zuweisbar
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Custom Badge */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Eigenes Badge (optional)</label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                          value={formData.custom_badge_text}
                          onChange={(e) =>
                            setFormData({ ...formData, custom_badge_text: e.target.value })
                          }
                          placeholder="Badge-Text"
                          className="input-modern"
                        />
                        <Input
                          type="color"
                          value={formData.custom_badge_color || formData.color}
                          onChange={(e) =>
                            setFormData({ ...formData, custom_badge_color: e.target.value })
                          }
                          className="input-modern h-11"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "permissions" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {formData.permissions.length} Berechtigungen ausgewählt
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            permissions:
                              formData.permissions.length === permissions.length
                                ? []
                                : permissions.map((p) => p.name),
                          })
                        }
                      >
                        {formData.permissions.length === permissions.length
                          ? "Alle abwählen"
                          : "Alle auswählen"}
                      </Button>
                    </div>

                    {Object.entries(permissionsByCategory).map(([category, catPerms]) => {
                      const isExpanded = expandedCategories.has(category);
                      const selectedCount = catPerms.filter((p) =>
                        formData.permissions.includes(p.name)
                      ).length;
                      const allSelected = selectedCount === catPerms.length;

                      return (
                        <div
                          key={category}
                          className="border border-border rounded-xl overflow-hidden"
                        >
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <span className="font-medium">
                                {PERMISSION_CATEGORIES[category as PermissionCategory] || category}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({selectedCount}/{catPerms.length})
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllInCategory(category);
                              }}
                              className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                                allSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-accent"
                              }`}
                            >
                              {allSelected ? "Alle abwählen" : "Alle auswählen"}
                            </button>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 pt-0 grid gap-2 sm:grid-cols-2">
                                  {catPerms.map((perm) => {
                                    const isSelected = formData.permissions.includes(perm.name);
                                    return (
                                      <button
                                        key={perm.id}
                                        onClick={() => togglePermission(perm.name)}
                                        className={`p-3 rounded-xl text-left transition-all flex items-start gap-3 ${
                                          isSelected
                                            ? "bg-primary/10 border border-primary/20"
                                            : "bg-muted/50 hover:bg-muted border border-transparent"
                                        }`}
                                      >
                                        <div
                                          className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5 ${
                                            isSelected
                                              ? "bg-primary text-primary-foreground"
                                              : "bg-muted-foreground/20"
                                          }`}
                                        >
                                          {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">
                                            {PERMISSION_LABELS[perm.name] || perm.display_name}
                                          </p>
                                          {perm.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              {perm.description}
                                            </p>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "limits" && (
                  <div className="space-y-6">
                    {/* File Size Limit */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Max. Dateigröße (MB)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.max_file_size_mb}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            max_file_size_mb: parseInt(e.target.value) || 10,
                          })
                        }
                        className="input-modern"
                      />
                    </div>

                    {/* Daily Message Limit */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Tägliches Nachrichtenlimit (leer = unbegrenzt)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.daily_message_limit || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            daily_message_limit: e.target.value
                              ? parseInt(e.target.value)
                              : null,
                          })
                        }
                        placeholder="Unbegrenzt"
                        className="input-modern"
                      />
                    </div>

                    {/* Feature Toggles */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium mb-3">Spezielle Features</h3>

                      {[
                        {
                          key: "can_use_custom_emojis",
                          label: "Custom Emojis verwenden",
                          description: "Kann eigene Emojis in Nachrichten verwenden",
                          icon: Sparkles,
                        },
                        {
                          key: "can_mention_everyone",
                          label: "@everyone erwähnen",
                          description: "Kann alle Mitglieder auf einmal erwähnen",
                          icon: AtSign,
                        },
                        {
                          key: "priority_support",
                          label: "Prioritäts-Support",
                          description: "Erhält bevorzugte Bearbeitung bei Support-Anfragen",
                          icon: Zap,
                        },
                      ].map((feature) => (
                        <button
                          key={feature.key}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              [feature.key]: !formData[feature.key as keyof RoleFormData],
                            })
                          }
                          className={`w-full p-4 rounded-xl flex items-center gap-4 transition-all ${
                            formData[feature.key as keyof RoleFormData]
                              ? "bg-primary/10 border border-primary/20"
                              : "bg-muted/50 border border-transparent hover:bg-muted"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              formData[feature.key as keyof RoleFormData]
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted-foreground/20"
                            }`}
                          >
                            <feature.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{feature.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              formData[feature.key as keyof RoleFormData]
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted-foreground/20"
                            }`}
                          >
                            {formData[feature.key as keyof RoleFormData] && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSave} disabled={saving || !formData.name || !formData.display_name}>
                  {saving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Speichern...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
