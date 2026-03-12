import { createClient } from "@/lib/supabase/client";

export interface UserRole {
  id: string;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  hierarchy_level: number;
  can_send_messages: boolean;
  can_send_images: boolean;
  can_send_files: boolean;
  can_create_channels: boolean;
  can_moderate: boolean;
  can_manage_users: boolean;
  can_access_admin: boolean;
  max_file_size_mb: number;
}

export interface ChannelOverride {
  can_view?: boolean;
  can_send_messages?: boolean;
  can_send_images?: boolean;
  can_send_files?: boolean;
}

export interface UserPermissionData {
  isAdmin: boolean;
  roles: UserRole[];
  highestRole: UserRole | null;
}

const permissionCache = new Map<string, { data: UserPermissionData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function getUserPermissionData(userId?: string): Promise<UserPermissionData | null> {
  const supabase = createClient();
  
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }

  const cached = permissionCache.get(uid);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Check if user is admin in users table
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", uid)
    .single();

  const isAdmin = userData?.role === "admin";

  // Get user's roles
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select(`
      role:roles(
        id, name, display_name, color, icon, hierarchy_level,
        can_send_messages, can_send_images, can_send_files,
        can_create_channels, can_moderate, can_manage_users,
        can_access_admin, max_file_size_mb
      )
    `)
    .eq("user_id", uid)
    .or("expires_at.is.null,expires_at.gt.now()");

  const roles: UserRole[] = (userRoles || [])
    .map((ur: any) => ur.role)
    .filter(Boolean)
    .sort((a: UserRole, b: UserRole) => b.hierarchy_level - a.hierarchy_level);

  const highestRole = roles[0] || null;

  const data: UserPermissionData = {
    isAdmin,
    roles,
    highestRole,
  };

  permissionCache.set(uid, { data, timestamp: Date.now() });
  return data;
}

export async function canUserInChannel(
  userId: string,
  channelId: string,
  permission: "send_messages" | "send_images" | "send_files"
): Promise<boolean> {
  const permData = await getUserPermissionData(userId);
  if (!permData) return false;

  // Admins can always do everything
  if (permData.isAdmin) return true;

  const role = permData.highestRole;
  if (!role) return false;

  const supabase = createClient();

  // Channel-specific overrides (from Channel-Manager: "nur Text" / "nur Bilder" / Ausnahmen pro Rolle)
  const { data: channelPerm } = await supabase
    .from("channel_role_permissions")
    .select("can_send_messages, can_send_images, can_send_files")
    .eq("channel_id", channelId)
    .eq("role_id", role.id)
    .single();

  if (channelPerm) {
    switch (permission) {
      case "send_messages": return channelPerm.can_send_messages;
      case "send_images": return channelPerm.can_send_images;
      case "send_files": return channelPerm.can_send_files;
      default: return false;
    }
  }

  // Fallback: channel_role_overrides (legacy)
  const { data: override } = await supabase
    .from("channel_role_overrides")
    .select("*")
    .eq("channel_id", channelId)
    .eq("role_id", role.id)
    .single();

  if (override) {
    const overrideKey = `can_${permission}` as keyof ChannelOverride;
    if (override[overrideKey] !== null && override[overrideKey] !== undefined) {
      return override[overrideKey] as boolean;
    }
  }

  // Otherwise use role's default (Rolle ohne Recht = nirgends)
  switch (permission) {
    case "send_messages":
      return role.can_send_messages;
    case "send_images":
      return role.can_send_images;
    case "send_files":
      return role.can_send_files;
    default:
      return false;
  }
}

export async function canUserAccessAdmin(userId?: string): Promise<boolean> {
  const permData = await getUserPermissionData(userId);
  if (!permData) return false;
  if (permData.isAdmin) return true;
  return permData.highestRole?.can_access_admin || false;
}

export async function canUserModerate(userId?: string): Promise<boolean> {
  const permData = await getUserPermissionData(userId);
  if (!permData) return false;
  if (permData.isAdmin) return true;
  return permData.highestRole?.can_moderate || false;
}

export function clearPermissionCache(userId?: string) {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}
