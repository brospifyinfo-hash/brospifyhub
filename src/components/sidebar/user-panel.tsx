"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, LogOut, ChevronUp, Shield, User, Crown, Star, Award } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient, apiFetch } from "@/lib/supabase/client";
import { usePermissions, useRoleDisplay, usePresence } from "@/hooks/use-permissions";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { User as UserProfile, UserProfile as ExtendedProfile } from "@/types/database";

export function UserPanel() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [extendedProfile, setExtendedProfile] = useState<ExtendedProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  
  const { isAdmin, isOwner, highestRole } = usePermissions();
  const { roleInfo, roleBadge } = useRoleDisplay();
  usePresence(true);

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        try {
          const response = await apiFetch(`/api/user/profile`);
          if (response.ok) {
            const data = await response.json();
            setProfile(data.profile);
          }
          
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();
          
          if (profileData) {
            setExtendedProfile(profileData);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setExtendedProfile(null);
      } else {
        apiFetch(`/api/user/profile`)
          .then(res => res.ok ? res.json() : null)
          .then(data => data && setProfile(data.profile))
          .catch(console.error);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (!user) {
    return (
      <div className="p-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/login")}
          className="w-full btn-primary"
        >
          Anmelden
        </motion.button>
      </div>
    );
  }

  return (
    <div className="p-3 relative">
      {/* Dropdown Menu - Positioned above the button */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-3 right-3 mb-2 glass rounded-xl shadow-xl overflow-hidden"
          >
            {(isAdmin || isOwner) && (
              <motion.button
                whileHover={{ backgroundColor: "rgb(var(--primary) / 0.1)" }}
                onClick={() => { router.push("/admin"); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary"
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </motion.button>
            )}

            <motion.button
              whileHover={{ backgroundColor: "rgb(var(--accent))" }}
              onClick={() => { router.push("/settings"); setShowMenu(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground"
            >
              <Settings className="w-4 h-4" />
              Einstellungen
            </motion.button>

            <div className="h-px bg-border/50 mx-3" />

            <motion.button
              whileHover={{ backgroundColor: "rgb(var(--destructive) / 0.1)" }}
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Button */}
      <motion.button
        onClick={() => setShowMenu(!showMenu)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent transition-colors"
      >
        <Avatar 
          className="h-10 w-10 avatar-ring"
          style={highestRole?.color ? { borderColor: highestRole.color + "50" } : undefined}
        >
          {extendedProfile?.avatar_url && (
            <AvatarImage src={extendedProfile.avatar_url} />
          )}
          <AvatarFallback 
            className="text-sm font-semibold"
            style={{
              backgroundColor: highestRole?.color ? highestRole.color + "20" : "rgb(var(--primary) / 0.1)",
              color: highestRole?.color || "rgb(var(--primary))",
            }}
          >
            {getInitials(profile?.display_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
              {profile?.display_name || "User"}
            </p>
            {roleBadge && (
              <span 
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: roleBadge.color + "20",
                  color: roleBadge.color,
                }}
              >
                {highestRole?.name === "owner" ? "👑" : highestRole?.name === "admin" ? "🛡️" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-sidebar-foreground truncate flex items-center gap-1.5">
            <span className="status-dot" />
            {extendedProfile?.custom_status || "Online"}
          </p>
        </div>

        <motion.div
          animate={{ rotate: showMenu ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-4 h-4 text-sidebar-foreground" />
        </motion.div>
      </motion.button>
    </div>
  );
}
