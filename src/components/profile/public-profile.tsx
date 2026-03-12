"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, MapPin, Globe, Calendar, Award, Flame, TrendingUp, Star,
  MessageSquare, Clock, ExternalLink, Crown, Shield, ShieldCheck, Headphones, Eye, Zap,
  ArrowLeft, Heart, Sparkles
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User as UserType, UserProfile, UserStats, Achievement, Role } from "@/types/database";

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

const ACHIEVEMENT_ICONS: Record<string, string> = {
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

interface Props {
  userId: string;
}

interface ExtendedUser extends UserType {
  profile: UserProfile | null;
  stats: UserStats | null;
  roles: Role[];
  highestRole: Role | null;
  achievements: Achievement[];
}

export function PublicProfile({ userId }: Props) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // Fetch user
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError || !userData) {
        setError("Benutzer nicht gefunden");
        setLoading(false);
        return;
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Check privacy settings
      if (profileData?.privacy_profile_visibility === "private") {
        setError("Dieses Profil ist privat");
        setLoading(false);
        return;
      }

      // Fetch stats
      const { data: statsData } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Fetch roles
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select(`
          role_id,
          roles:role_id (*)
        `)
        .eq("user_id", userId);

      const roles: Role[] = (userRolesData || [])
        .map((ur: any) => ur.roles)
        .filter((r: Role | null) => r !== null);

      const highestRole = roles.length > 0
        ? roles.reduce((prev, curr) =>
            curr.hierarchy_level > prev.hierarchy_level ? curr : prev
          )
        : null;

      // Fetch achievements
      const { data: userAchievements } = await supabase
        .from("user_achievements")
        .select(`
          achievement_id,
          achievements:achievement_id (*)
        `)
        .eq("user_id", userId);

      const achievements: Achievement[] = (userAchievements || [])
        .map((ua: any) => ua.achievements)
        .filter((a: Achievement | null) => a !== null);

      // Increment profile views
      await supabase
        .from("users")
        .update({ profile_views: (userData.profile_views || 0) + 1 })
        .eq("id", userId);

      setUser({
        ...userData,
        profile: profileData,
        stats: statsData,
        roles,
        highestRole,
        achievements,
      });
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Fehler beim Laden des Profils");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("de-DE", {
      month: "long",
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

  if (error || !user) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="content-card text-center py-12">
          <User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {error || "Benutzer nicht gefunden"}
          </h2>
          <p className="text-muted-foreground mb-6">
            Das Profil ist möglicherweise privat oder existiert nicht.
          </p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  const profile = user.profile;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück
      </button>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden mb-6"
      >
        {/* Banner */}
        <div
          className="h-32 md:h-48 bg-gradient-to-r from-primary/20 to-purple-500/20"
          style={
            profile?.banner_url
              ? {
                  backgroundImage: `url(${profile.banner_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <Avatar
              className="w-20 h-20 md:w-28 md:h-28 border-4 border-background"
              style={{
                boxShadow:
                  profile?.profile_effect === "glow"
                    ? `0 0 30px ${profile?.accent_color || "#95BF47"}50`
                    : undefined,
              }}
            >
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} />
              ) : null}
              <AvatarFallback
                className="text-2xl md:text-3xl font-bold"
                style={{
                  backgroundColor: (profile?.accent_color || "#95BF47") + "20",
                  color: profile?.accent_color || "#95BF47",
                }}
              >
                {getInitials(user.display_name)}
              </AvatarFallback>
            </Avatar>

            {/* Name & Info */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
                  {user.display_name || "Unbenannt"}
                </h1>
                {user.is_verified && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs flex items-center gap-1">
                    ✓ Verifiziert
                  </span>
                )}
              </div>

              {/* Roles */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {user.roles.slice(0, 3).map((role) => (
                  <span
                    key={role.id}
                    className="px-2 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1"
                    style={{
                      backgroundColor: role.color + "20",
                      color: role.color,
                    }}
                  >
                    <RoleIcon icon={role.icon} />
                    {role.display_name}
                  </span>
                ))}
              </div>

              {/* Custom Status */}
              {profile?.custom_status && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  {profile.custom_status_emoji && (
                    <span>{profile.custom_status_emoji}</span>
                  )}
                  {profile.custom_status}
                </p>
              )}
            </div>

            {/* Stats (Desktop) */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {user.stats?.total_messages || 0}
                </p>
                <p className="text-xs text-muted-foreground">Nachrichten</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {user.achievements.length}
                </p>
                <p className="text-xs text-muted-foreground">Achievements</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {(profile?.bio || profile?.about_me) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="content-card"
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Über mich
              </h2>
              {profile?.bio && (
                <p className="text-muted-foreground mb-4">{profile.bio}</p>
              )}
              {profile?.about_me && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {profile.about_me}
                </p>
              )}
            </motion.div>
          )}

          {/* Achievements */}
          {user.achievements.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="content-card"
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Achievements ({user.achievements.length})
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {user.achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="p-3 rounded-xl bg-muted/50 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: achievement.color + "20" }}
                    >
                      {ACHIEVEMENT_ICONS[achievement.icon] || "🏆"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {achievement.display_name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: achievement.color }}
                      >
                        +{achievement.points} XP
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="content-card"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Statistiken
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <MessageSquare className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xl font-bold">
                  {user.stats?.total_messages || 0}
                </p>
                <p className="text-xs text-muted-foreground">Nachrichten</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-xl font-bold">
                  Level {user.stats?.level || 1}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.stats?.experience_points || 0} XP
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Clock className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-xl font-bold">
                  {user.stats?.total_login_days || 0}
                </p>
                <p className="text-xs text-muted-foreground">Tage aktiv</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="content-card"
          >
            <h2 className="text-lg font-semibold mb-4">Informationen</h2>

            <div className="space-y-3">
              {profile?.location && profile?.show_location && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.location}</span>
                </div>
              )}

              {profile?.website && (
                <a
                  href={
                    profile.website.startsWith("http")
                      ? profile.website
                      : `https://${profile.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-primary hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm truncate">{profile.website}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              )}

              {profile?.birthday && profile?.show_birthday && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {new Date(profile.birthday).toLocaleDateString("de-DE", {
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  Dabei seit {formatDate(user.created_at)}
                </span>
              </div>

              {profile?.pronouns && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{profile.pronouns}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Interests */}
          {profile?.interests && profile.interests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="content-card"
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Interessen
              </h2>

              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
