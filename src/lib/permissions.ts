// =============================================
// BROSPIFY HUB - PERMISSION SYSTEM LIBRARY
// =============================================
// Zentrale Bibliothek für alle Berechtigungs-Checks

import { createClient } from "@/lib/supabase/client";
import type {
  Role,
  Permission,
  UserProfile,
  UserStats,
  Achievement,
  UserPresence,
  PermissionCategory,
  SystemRole,
  OnlineStatus,
} from "@/types/database";

// =============================================
// TYPES & INTERFACES
// =============================================
export interface UserPermissions {
  userId: string;
  roles: Role[];
  permissions: string[];
  highestRole: Role | null;
  profile: UserProfile | null;
  stats: UserStats | null;
  achievements: Achievement[];
  presence: UserPresence | null;
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isSupport: boolean;
  isVIP: boolean;
  hierarchyLevel: number;
}

export interface ChannelPermissions {
  canView: boolean;
  canSendMessages: boolean;
  canSendImages: boolean;
  canSendFiles: boolean;
  canDeleteMessages: boolean;
  canPinMessages: boolean;
  canManageChannel: boolean;
}

// =============================================
// CACHE MANAGEMENT
// =============================================
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten
const permissionCache = new Map<string, { data: UserPermissions; timestamp: number }>();
const channelPermissionCache = new Map<string, { data: ChannelPermissions; timestamp: number }>();

function getCacheKey(userId: string): string {
  return `user_${userId}`;
}

function getChannelCacheKey(userId: string, channelId: string): string {
  return `channel_${userId}_${channelId}`;
}

export function clearPermissionCache(userId?: string): void {
  if (userId) {
    permissionCache.delete(getCacheKey(userId));
    // Clear all channel caches for this user
    for (const key of channelPermissionCache.keys()) {
      if (key.startsWith(`channel_${userId}_`)) {
        channelPermissionCache.delete(key);
      }
    }
  } else {
    permissionCache.clear();
    channelPermissionCache.clear();
  }
}

// =============================================
// FETCH USER PERMISSIONS
// =============================================
export async function getUserPermissions(userId?: string): Promise<UserPermissions | null> {
  const supabase = createClient();

  // Get current user if no userId provided
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  // Check cache
  const cacheKey = getCacheKey(userId);
  const cached = permissionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Fetch user roles with role details
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select(`
        role_id,
        expires_at,
        roles:role_id (*)
      `)
      .eq("user_id", userId)
      .or("expires_at.is.null,expires_at.gt.now()");

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError);
      return null;
    }

    // Extract roles
    const roles: Role[] = (userRoles || [])
      .map((ur: any) => ur.roles)
      .filter((r: Role | null) => r !== null);

    // Get all permissions for these roles
    const roleIds = roles.map((r) => r.id);
    const { data: rolePermissions, error: permError } = await supabase
      .from("role_permissions")
      .select(`
        permission_id,
        permissions:permission_id (name)
      `)
      .in("role_id", roleIds.length > 0 ? roleIds : ["00000000-0000-0000-0000-000000000000"]);

    if (permError) {
      console.error("Error fetching permissions:", permError);
    }

    // Extract unique permission names
    const permissions = [...new Set(
      (rolePermissions || [])
        .map((rp: any) => rp.permissions?.name)
        .filter((name: string | undefined) => name)
    )];

    // Find highest role
    const highestRole = roles.length > 0
      ? roles.reduce((prev, curr) =>
          curr.hierarchy_level > prev.hierarchy_level ? curr : prev
        )
      : null;

    // Fetch profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Fetch stats
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Fetch achievements
    const { data: userAchievements } = await supabase
      .from("user_achievements")
      .select(`
        achievement_id,
        earned_at,
        achievements:achievement_id (*)
      `)
      .eq("user_id", userId);

    const achievements: Achievement[] = (userAchievements || [])
      .map((ua: any) => ua.achievements)
      .filter((a: Achievement | null) => a !== null);

    // Fetch presence
    const { data: presence } = await supabase
      .from("user_presence")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Determine role booleans
    const roleNames = roles.map((r) => r.name.toLowerCase());
    const isOwner = roleNames.includes("owner");
    const isAdmin = isOwner || roleNames.includes("admin");
    const isModerator = isAdmin || roleNames.includes("moderator");
    const isSupport = roleNames.includes("support");
    const isVIP = roleNames.includes("vip");

    const result: UserPermissions = {
      userId,
      roles,
      permissions,
      highestRole,
      profile,
      stats,
      achievements,
      presence,
      isOwner,
      isAdmin,
      isModerator,
      isSupport,
      hierarchyLevel: highestRole?.hierarchy_level || 0,
      isVIP,
    };

    // Cache result
    permissionCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error("Error in getUserPermissions:", error);
    return null;
  }
}

// =============================================
// PERMISSION CHECK HELPERS
// =============================================
export function hasPermission(
  userPermissions: UserPermissions | null,
  permission: string
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.isOwner) return true; // Owner has all permissions
  return userPermissions.permissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: UserPermissions | null,
  permissions: string[]
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.isOwner) return true;
  return permissions.some((p) => userPermissions.permissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: UserPermissions | null,
  permissions: string[]
): boolean {
  if (!userPermissions) return false;
  if (userPermissions.isOwner) return true;
  return permissions.every((p) => userPermissions.permissions.includes(p));
}

export function hasRole(
  userPermissions: UserPermissions | null,
  roleName: string
): boolean {
  if (!userPermissions) return false;
  return userPermissions.roles.some(
    (r) => r.name.toLowerCase() === roleName.toLowerCase()
  );
}

export function hasMinimumRole(
  userPermissions: UserPermissions | null,
  minLevel: number
): boolean {
  if (!userPermissions) return false;
  return userPermissions.hierarchyLevel >= minLevel;
}

export function isOwner(userPermissions: UserPermissions | null): boolean {
  return userPermissions?.isOwner || false;
}

export function isAdmin(userPermissions: UserPermissions | null): boolean {
  return userPermissions?.isAdmin || false;
}

export function isModerator(userPermissions: UserPermissions | null): boolean {
  return userPermissions?.isModerator || false;
}

export function isSupport(userPermissions: UserPermissions | null): boolean {
  return userPermissions?.isSupport || false;
}

export function isVIP(userPermissions: UserPermissions | null): boolean {
  return userPermissions?.isVIP || false;
}

// =============================================
// CHANNEL PERMISSION CHECKS
// =============================================
export async function getChannelPermissions(
  userId: string,
  channelId: string
): Promise<ChannelPermissions> {
  // Check cache
  const cacheKey = getChannelCacheKey(userId, channelId);
  const cached = channelPermissionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const supabase = createClient();

  // Default permissions (most restrictive)
  let result: ChannelPermissions = {
    canView: false,
    canSendMessages: false,
    canSendImages: false,
    canSendFiles: false,
    canDeleteMessages: false,
    canPinMessages: false,
    canManageChannel: false,
  };

  try {
    // Get user permissions first to check if admin/owner
    const userPerms = await getUserPermissions(userId);
    if (userPerms?.isOwner) {
      // Owner has all permissions
      result = {
        canView: true,
        canSendMessages: true,
        canSendImages: true,
        canSendFiles: true,
        canDeleteMessages: true,
        canPinMessages: true,
        canManageChannel: true,
      };
      channelPermissionCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // Get user's role IDs
    const roleIds = userPerms?.roles.map((r) => r.id) || [];

    if (roleIds.length === 0) {
      // No roles = guest access only
      result.canView = true;
      channelPermissionCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // Fetch channel-specific role permissions
    const { data: channelRolePerms, error } = await supabase
      .from("channel_role_permissions")
      .select("*")
      .eq("channel_id", channelId)
      .in("role_id", roleIds);

    if (error) {
      console.error("Error fetching channel permissions:", error);
    }

    // Merge permissions (most permissive wins)
    if (channelRolePerms && channelRolePerms.length > 0) {
      for (const perm of channelRolePerms) {
        if (perm.can_view) result.canView = true;
        if (perm.can_send_messages) result.canSendMessages = true;
        if (perm.can_send_images) result.canSendImages = true;
        if (perm.can_send_files) result.canSendFiles = true;
        if (perm.can_delete_messages) result.canDeleteMessages = true;
        if (perm.can_pin_messages) result.canPinMessages = true;
        if (perm.can_manage_channel) result.canManageChannel = true;
      }
    } else {
      // No channel-specific permissions, fall back to global permissions
      result.canView = true;
      result.canSendMessages = hasPermission(userPerms, "send_messages");
      result.canSendImages = hasPermission(userPerms, "send_images");
      result.canSendFiles = hasPermission(userPerms, "send_files");
      result.canDeleteMessages = hasPermission(userPerms, "delete_any_message");
      result.canPinMessages = hasPermission(userPerms, "pin_messages");
      result.canManageChannel = hasPermission(userPerms, "edit_channels");
    }

    // Admins always have elevated permissions
    if (userPerms?.isAdmin) {
      result.canView = true;
      result.canSendMessages = true;
      result.canSendImages = true;
      result.canSendFiles = true;
      result.canDeleteMessages = true;
      result.canPinMessages = true;
    }
  } catch (error) {
    console.error("Error in getChannelPermissions:", error);
  }

  channelPermissionCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function checkChannelPermission(
  userId: string,
  channelId: string,
  permissionType: keyof ChannelPermissions
): Promise<boolean> {
  const perms = await getChannelPermissions(userId, channelId);
  return perms[permissionType];
}

// =============================================
// ACTIVITY LOGGING
// =============================================
export async function logActivity(
  actionType: string,
  actionCategory: string = "general",
  targetType?: string,
  targetId?: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase.from("activity_log").insert({
      user_id: user.id,
      action_type: actionType,
      action_category: actionCategory,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// =============================================
// PRESENCE MANAGEMENT
// =============================================
export async function updatePresence(status: OnlineStatus = "online"): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    await supabase
      .from("user_presence")
      .upsert({
        user_id: user.id,
        status,
        last_heartbeat: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });

    await supabase
      .from("users")
      .update({
        last_seen_at: new Date().toISOString(),
        online_status: status,
      })
      .eq("id", user.id);
  } catch (error) {
    console.error("Error updating presence:", error);
  }
}

// =============================================
// CONSTANTS & LABELS
// =============================================
export const PERMISSION_LABELS: Record<string, string> = {
  // System
  manage_roles: "Rollen verwalten",
  assign_roles: "Rollen zuweisen",
  manage_users: "Benutzer verwalten",
  manage_licenses: "Lizenzen verwalten",
  manage_settings: "Einstellungen verwalten",
  view_analytics: "Statistiken ansehen",
  manage_emojis: "Emojis verwalten",
  manage_scheduled_posts: "Geplante Posts verwalten",
  manage_achievements: "Achievements verwalten",
  view_activity_log: "Aktivitätslog ansehen",
  manage_user_notes: "Benutzernotizen verwalten",
  impersonate_users: "Als Benutzer ausgeben",
  bypass_rate_limits: "Rate-Limits umgehen",
  export_data: "Daten exportieren",

  // Channels
  create_channels: "Channels erstellen",
  edit_channels: "Channels bearbeiten",
  delete_channels: "Channels löschen",
  manage_categories: "Kategorien verwalten",

  // Messages
  send_messages: "Nachrichten senden",
  send_images: "Bilder senden",
  send_files: "Dateien senden",
  delete_any_message: "Nachrichten löschen",
  pin_messages: "Nachrichten anpinnen",
  edit_any_message: "Nachrichten bearbeiten",

  // Support
  view_all_tickets: "Alle Tickets sehen",
  respond_tickets: "Tickets beantworten",
  close_tickets: "Tickets schließen",
  assign_tickets: "Tickets zuweisen",
  priority_ticket_access: "Prioritäts-Support",
  view_ticket_history: "Ticket-Historie einsehen",

  // Moderation
  mute_users: "Benutzer stummschalten",
  ban_users: "Benutzer sperren",
  view_audit_log: "Audit-Log sehen",
  issue_warnings: "Verwarnungen aussprechen",
  revoke_warnings: "Verwarnungen zurücknehmen",
  temporary_mute: "Temporär stummschalten",
  view_user_history: "Benutzerhistorie einsehen",

  // Content
  approve_content: "Inhalte freigeben",
  manage_winning_product: "Winning Product verwalten",
  feature_content: "Inhalte hervorheben",
  manage_announcements: "Ankündigungen verwalten",
};

export const PERMISSION_CATEGORIES: Record<PermissionCategory, string> = {
  system: "🔧 System",
  channels: "📺 Channels",
  messages: "💬 Nachrichten",
  support: "🎧 Support",
  moderation: "🛡️ Moderation",
  content: "📝 Inhalte",
};

export const ROLE_HIERARCHY_DESCRIPTIONS: Record<SystemRole, string> = {
  owner: "Volle Kontrolle über die gesamte Plattform",
  admin: "Verwaltungsrechte für die meisten Bereiche",
  moderator: "Kann Inhalte moderieren und Benutzer verwalten",
  support: "Kann Support-Tickets bearbeiten",
  vip: "Premium-Mitglied mit erweiterten Rechten",
  member: "Reguläres Community-Mitglied",
  guest: "Eingeschränkte Leserechte",
};

export const ROLE_ICONS: Record<string, string> = {
  owner: "👑",
  admin: "🛡️",
  moderator: "⚔️",
  support: "🎧",
  vip: "⭐",
  member: "👤",
  guest: "👁️",
};

export const ACHIEVEMENT_ICONS: Record<string, string> = {
  "message-circle": "💬",
  "messages-square": "📝",
  "message-square-text": "📢",
  "crown": "👑",
  "flame": "🔥",
  "zap": "⚡",
  "rocket": "🚀",
  "shopping-bag": "🛒",
  "star": "⭐",
  "heart": "❤️",
  "award": "🏆",
  "badge-check": "✅",
};
