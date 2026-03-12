"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getUserPermissions,
  getChannelPermissions,
  hasPermission as checkPermission,
  hasRole as checkRole,
  clearPermissionCache,
  logActivity,
  updatePresence,
  type UserPermissions,
  type ChannelPermissions,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type { OnlineStatus } from "@/types/database";

// =============================================
// MAIN PERMISSIONS HOOK
// =============================================
export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const perms = await getUserPermissions();
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Berechtigungen");
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    // Subscribe to realtime updates on user_roles
    const supabase = createClient();
    
    const channel = supabase
      .channel("user-permissions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
        },
        (payload) => {
          // Refresh permissions when roles change
          if (permissions?.userId && 
              (payload.new as any)?.user_id === permissions.userId ||
              (payload.old as any)?.user_id === permissions.userId) {
            clearPermissionCache(permissions.userId);
            fetchPermissions();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPermissions, permissions?.userId]);

  // Helper functions
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return checkPermission(permissions, permission);
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      if (permissions.isOwner) return true;
      return perms.some((p) => permissions.permissions.includes(p));
    },
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      if (permissions.isOwner) return true;
      return perms.every((p) => permissions.permissions.includes(p));
    },
    [permissions]
  );

  const hasRole = useCallback(
    (roleName: string): boolean => {
      return checkRole(permissions, roleName);
    },
    [permissions]
  );

  const hasMinimumRole = useCallback(
    (minLevel: number): boolean => {
      if (!permissions) return false;
      return permissions.hierarchyLevel >= minLevel;
    },
    [permissions]
  );

  const refresh = useCallback(() => {
    if (permissions?.userId) {
      clearPermissionCache(permissions.userId);
    }
    fetchPermissions();
  }, [permissions?.userId, fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasMinimumRole,
    isOwner: permissions?.isOwner || false,
    isAdmin: permissions?.isAdmin || false,
    isModerator: permissions?.isModerator || false,
    isSupport: permissions?.isSupport || false,
    isVIP: permissions?.isVIP || false,
    highestRole: permissions?.highestRole || null,
    profile: permissions?.profile || null,
    stats: permissions?.stats || null,
    achievements: permissions?.achievements || [],
    refresh,
  };
}

// =============================================
// CHANNEL PERMISSIONS HOOK
// =============================================
export function useChannelPermissions(channelId: string | null) {
  const [permissions, setPermissions] = useState<ChannelPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { permissions: userPermissions } = usePermissions();

  useEffect(() => {
    if (!channelId || !userPermissions?.userId) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const fetchChannelPermissions = async () => {
      try {
        setLoading(true);
        setError(null);
        const perms = await getChannelPermissions(userPermissions.userId, channelId);
        setPermissions(perms);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden der Channel-Berechtigungen");
        console.error("Error fetching channel permissions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelPermissions();
  }, [channelId, userPermissions?.userId]);

  return {
    permissions,
    loading,
    error,
    canView: permissions?.canView || false,
    canSendMessages: permissions?.canSendMessages || false,
    canSendImages: permissions?.canSendImages || false,
    canSendFiles: permissions?.canSendFiles || false,
    canDeleteMessages: permissions?.canDeleteMessages || false,
    canPinMessages: permissions?.canPinMessages || false,
    canManageChannel: permissions?.canManageChannel || false,
  };
}

// =============================================
// PRESENCE HOOK
// =============================================
export function usePresence(autoUpdate: boolean = true) {
  const [status, setStatus] = useState<OnlineStatus>("online");

  useEffect(() => {
    if (!autoUpdate) return;

    // Initial presence update
    updatePresence("online");

    // Heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      updatePresence(status);
    }, 30000);

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updatePresence("online");
        setStatus("online");
      } else {
        updatePresence("away");
        setStatus("away");
      }
    };

    // Handle before unload
    const handleBeforeUnload = () => {
      updatePresence("offline");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updatePresence("offline");
    };
  }, [autoUpdate, status]);

  const setCustomStatus = useCallback(async (newStatus: OnlineStatus) => {
    setStatus(newStatus);
    await updatePresence(newStatus);
  }, []);

  return {
    status,
    setStatus: setCustomStatus,
  };
}

// =============================================
// ACTIVITY LOGGING HOOK
// =============================================
export function useActivityLog() {
  const log = useCallback(
    async (
      actionType: string,
      actionCategory: string = "general",
      targetType?: string,
      targetId?: string,
      details: Record<string, any> = {}
    ) => {
      await logActivity(actionType, actionCategory, targetType, targetId, details);
    },
    []
  );

  return { log };
}

// =============================================
// ROLE DISPLAY HOOK
// =============================================
export function useRoleDisplay() {
  const { permissions } = usePermissions();

  const roleInfo = useMemo(() => {
    if (!permissions?.highestRole) {
      return {
        name: "Gast",
        displayName: "Gast",
        color: "#808080",
        icon: "eye",
        level: 0,
      };
    }

    return {
      name: permissions.highestRole.name,
      displayName: permissions.highestRole.display_name,
      color: permissions.highestRole.color,
      icon: permissions.highestRole.icon,
      level: permissions.highestRole.hierarchy_level,
    };
  }, [permissions?.highestRole]);

  const getRoleBadge = useMemo(() => {
    if (!permissions?.highestRole) return null;
    
    return {
      text: permissions.highestRole.custom_badge_text || permissions.highestRole.display_name,
      color: permissions.highestRole.custom_badge_color || permissions.highestRole.color,
    };
  }, [permissions?.highestRole]);

  return {
    roleInfo,
    roleBadge: getRoleBadge,
    allRoles: permissions?.roles || [],
  };
}

// =============================================
// ADMIN CHECK HOOK (Quick access)
// =============================================
export function useIsAdmin() {
  const { isAdmin, isOwner, loading } = usePermissions();
  return { isAdmin: isAdmin || isOwner, loading };
}

// =============================================
// MODERATOR CHECK HOOK
// =============================================
export function useIsModerator() {
  const { isModerator, isAdmin, isOwner, loading } = usePermissions();
  return { isModerator: isModerator || isAdmin || isOwner, loading };
}

// =============================================
// VIP CHECK HOOK
// =============================================
export function useIsVIP() {
  const { isVIP, isAdmin, isOwner, loading } = usePermissions();
  return { isVIP: isVIP || isAdmin || isOwner, loading };
}
