"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Camera, MapPin, Globe, Calendar, Mail, Bell, Lock, Eye, Palette,
  Twitter, Instagram, Youtube, Github, Linkedin, MessageCircle, Save, X,
  ChevronRight, Check, Sparkles, Award, Flame, TrendingUp, Heart, Star,
  Clock, Zap, Shield, Crown, Upload, Trash2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { usePermissions, useRoleDisplay } from "@/hooks/use-permissions";
import type { UserProfile, Achievement, UserStats, Gender, ProfileVisibility } from "@/types/database";

const ACCENT_COLORS = [
  "#95BF47", "#3498DB", "#E91E63", "#9B59B6", "#F39C12",
  "#1ABC9C", "#E74C3C", "#2ECC71", "#00BCD4", "#FF5722",
];

const PROFILE_EFFECTS = [
  { id: null, name: "Kein Effekt", preview: null },
  { id: "glow", name: "Leuchten", preview: "shadow-lg shadow-primary/50" },
  { id: "pulse", name: "Pulsieren", preview: "animate-pulse" },
  { id: "gradient", name: "Gradient", preview: "bg-gradient-to-r from-primary to-purple-500" },
];

const GENDER_OPTIONS: { value: Gender | ""; label: string }[] = [
  { value: "", label: "Nicht angeben" },
  { value: "male", label: "Männlich" },
  { value: "female", label: "Weiblich" },
  { value: "other", label: "Andere" },
  { value: "prefer_not_to_say", label: "Keine Angabe" },
];

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; description: string }[] = [
  { value: "public", label: "Öffentlich", description: "Jeder kann dein Profil sehen" },
  { value: "members", label: "Nur Mitglieder", description: "Nur eingeloggte Mitglieder" },
  { value: "private", label: "Privat", description: "Niemand kann dein Profil sehen" },
];

interface Props {
  userId?: string;
}

export function ProfileSettings({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "social" | "notifications" | "privacy" | "achievements">("profile");
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [displayName, setDisplayName] = useState("");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<(Achievement & { earned: boolean; earnedAt: string | null })[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const { permissions, highestRole } = usePermissions();
  const { roleInfo, roleBadge } = useRoleDisplay();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get current user if no userId provided
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      targetUserId = user.id;
    }

    // Fetch user
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", targetUserId)
      .single();

    if (userData) {
      setDisplayName(userData.display_name || "");
    }

    // Fetch profile
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (profileData) {
      setProfile(profileData);
    }

    // Fetch stats
    const { data: statsData } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (statsData) {
      setStats(statsData);
    }

    // Fetch all achievements and user's earned ones
    const { data: allAchievements } = await supabase
      .from("achievements")
      .select("*")
      .order("points", { ascending: false });

    const { data: userAchievements } = await supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", targetUserId);

    if (allAchievements) {
      const achievementsWithStatus = allAchievements.map((a) => {
        const userAch = userAchievements?.find((ua) => ua.achievement_id === a.id);
        return {
          ...a,
          earned: !!userAch,
          earnedAt: userAch?.earned_at || null,
        };
      });
      setAchievements(achievementsWithStatus);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update display name in users table
      await supabase
        .from("users")
        .update({ display_name: displayName })
        .eq("id", user.id);

      // Update profile
      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          ...profile,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;

      setSuccessMessage("Profil erfolgreich gespeichert!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setProfile({ ...profile, avatar_url: publicUrl + "?t=" + Date.now() });
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/banner.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setProfile({ ...profile, banner_url: publicUrl + "?t=" + Date.now() });
    } catch (error) {
      console.error("Error uploading banner:", error);
    } finally {
      setUploadingBanner(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-green-500 text-white shadow-lg flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Banner */}
      <div className="relative mb-8 rounded-2xl overflow-hidden">
        {/* Banner */}
        <div
          className="h-32 md:h-48 bg-gradient-to-r from-primary/20 to-purple-500/20 relative"
          style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            {uploadingBanner ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            className="hidden"
          />
        </div>

        {/* Avatar & Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <Avatar
                className="w-20 h-20 md:w-28 md:h-28 border-4 border-background"
                style={{
                  boxShadow: profile.profile_effect === "glow" 
                    ? `0 0 30px ${profile.accent_color || "#95BF47"}50` 
                    : undefined
                }}
              >
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} />
                ) : null}
                <AvatarFallback
                  className="text-2xl md:text-3xl font-bold"
                  style={{
                    backgroundColor: (profile.accent_color || "#95BF47") + "20",
                    color: profile.accent_color || "#95BF47",
                  }}
                >
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
              >
                {uploadingAvatar ? (
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Name & Role */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
                  {displayName || "Unbenannt"}
                </h1>
                {roleBadge && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: roleBadge.color + "20",
                      color: roleBadge.color,
                    }}
                  >
                    {roleBadge.text}
                  </span>
                )}
              </div>
              {profile.custom_status && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  {profile.custom_status_emoji && <span>{profile.custom_status_emoji}</span>}
                  {profile.custom_status}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{stats?.total_messages || 0}</p>
                <p className="text-xs text-muted-foreground">Nachrichten</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {achievements.filter((a) => a.earned).length}
                </p>
                <p className="text-xs text-muted-foreground">Achievements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-muted/50 rounded-xl mb-6">
        {[
          { id: "profile", label: "Profil", icon: User },
          { id: "social", label: "Social", icon: Globe },
          { id: "notifications", label: "Benachrichtigungen", icon: Bell },
          { id: "privacy", label: "Privatsphäre", icon: Lock },
          { id: "achievements", label: "Achievements", icon: Award },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Basic Info */}
            <div className="space-y-6">
              <div className="content-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Basis-Informationen
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Anzeigename</label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Dein Name"
                      className="input-modern"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Bio</label>
                    <Textarea
                      value={profile.bio || ""}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Erzähle etwas über dich..."
                      rows={3}
                      className="input-modern resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Über mich</label>
                    <Textarea
                      value={profile.about_me || ""}
                      onChange={(e) => setProfile({ ...profile, about_me: e.target.value })}
                      placeholder="Ausführlichere Beschreibung..."
                      rows={4}
                      className="input-modern resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Standort</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={profile.location || ""}
                          onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                          placeholder="Stadt, Land"
                          className="input-modern pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={profile.website || ""}
                          onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                          placeholder="https://..."
                          className="input-modern pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Geburtstag</label>
                      <Input
                        type="date"
                        value={profile.birthday || ""}
                        onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
                        className="input-modern"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Geschlecht</label>
                      <select
                        value={profile.gender || ""}
                        onChange={(e) => setProfile({ ...profile, gender: (e.target.value || null) as Gender | null })}
                        className="input-modern w-full"
                      >
                        {GENDER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Pronomen</label>
                    <Input
                      value={profile.pronouns || ""}
                      onChange={(e) => setProfile({ ...profile, pronouns: e.target.value })}
                      placeholder="z.B. er/ihn, sie/ihr"
                      className="input-modern"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Customization */}
            <div className="space-y-6">
              {/* Custom Status */}
              <div className="content-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Benutzerdefinierter Status
                </h2>

                <div className="flex gap-3">
                  <Input
                    value={profile.custom_status_emoji || ""}
                    onChange={(e) => setProfile({ ...profile, custom_status_emoji: e.target.value })}
                    placeholder="😊"
                    className="input-modern w-16 text-center text-xl"
                    maxLength={2}
                  />
                  <Input
                    value={profile.custom_status || ""}
                    onChange={(e) => setProfile({ ...profile, custom_status: e.target.value })}
                    placeholder="Was machst du gerade?"
                    className="input-modern flex-1"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="content-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  Akzentfarbe
                </h2>

                <div className="flex flex-wrap gap-3">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setProfile({ ...profile, accent_color: color })}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        profile.accent_color === color
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Input
                    type="color"
                    value={profile.accent_color || "#95BF47"}
                    onChange={(e) => setProfile({ ...profile, accent_color: e.target.value })}
                    className="w-10 h-10 p-1 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Profile Effect */}
              <div className="content-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Profil-Effekt
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {PROFILE_EFFECTS.map((effect) => (
                    <button
                      key={effect.id || "none"}
                      onClick={() => setProfile({ ...profile, profile_effect: effect.id })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        profile.profile_effect === effect.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full mx-auto mb-2 ${effect.preview || "bg-muted"}`}
                        style={{ backgroundColor: profile.accent_color || "#95BF47" }}
                      />
                      <p className="text-sm font-medium text-center">{effect.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div className="content-card">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Interessen
                </h2>

                <Input
                  value={(profile.interests || []).join(", ")}
                  onChange={(e) => setProfile({ 
                    ...profile, 
                    interests: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) 
                  })}
                  placeholder="E-Commerce, Dropshipping, Marketing..."
                  className="input-modern"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Trenne mehrere Interessen mit Kommas
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Social Tab */}
        {activeTab === "social" && (
          <div className="content-card max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Social Media Links
            </h2>

            <div className="space-y-4">
              {[
                { key: "social_twitter", label: "Twitter / X", icon: Twitter, placeholder: "@username" },
                { key: "social_instagram", label: "Instagram", icon: Instagram, placeholder: "@username" },
                { key: "social_youtube", label: "YouTube", icon: Youtube, placeholder: "Channel URL" },
                { key: "social_tiktok", label: "TikTok", icon: Sparkles, placeholder: "@username" },
                { key: "social_discord", label: "Discord", icon: MessageCircle, placeholder: "username#0000" },
                { key: "social_linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "Profil URL" },
                { key: "social_github", label: "GitHub", icon: Github, placeholder: "username" },
              ].map((social) => (
                <div key={social.key} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <social.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">{social.label}</label>
                    <Input
                      value={(profile as any)[social.key] || ""}
                      onChange={(e) => setProfile({ ...profile, [social.key]: e.target.value })}
                      placeholder={social.placeholder}
                      className="input-modern"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="content-card max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Benachrichtigungen
            </h2>

            <div className="space-y-3">
              {[
                { key: "notification_email", label: "E-Mail Benachrichtigungen", description: "Erhalte Updates per E-Mail" },
                { key: "notification_push", label: "Push-Benachrichtigungen", description: "Browser-Benachrichtigungen" },
                { key: "notification_sound", label: "Töne", description: "Benachrichtigungstöne abspielen" },
                { key: "notification_mentions", label: "Erwähnungen", description: "Wenn du erwähnt wirst" },
                { key: "notification_replies", label: "Antworten", description: "Auf deine Nachrichten" },
                { key: "notification_new_content", label: "Neue Inhalte", description: "Bei neuem Content in Channels" },
              ].map((setting) => (
                <label
                  key={setting.key}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-medium">{setting.label}</p>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={(profile as any)[setting.key] ?? true}
                      onChange={(e) => setProfile({ ...profile, [setting.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted-foreground/30 peer-checked:bg-primary rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Privacy Tab */}
        {activeTab === "privacy" && (
          <div className="content-card max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Privatsphäre-Einstellungen
            </h2>

            {/* Profile Visibility */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">Profil-Sichtbarkeit</label>
              <div className="grid gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile({ ...profile, privacy_profile_visibility: opt.value })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      profile.privacy_profile_visibility === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: "privacy_show_online", label: "Online-Status anzeigen", description: "Andere sehen, wann du online bist" },
                { key: "privacy_show_activity", label: "Aktivität anzeigen", description: "Deine Aktivität ist für andere sichtbar" },
                { key: "privacy_allow_dms", label: "Direktnachrichten erlauben", description: "Andere können dir Nachrichten senden" },
                { key: "show_birthday", label: "Geburtstag anzeigen", description: "Dein Geburtstag ist sichtbar" },
                { key: "show_location", label: "Standort anzeigen", description: "Dein Standort ist sichtbar" },
              ].map((setting) => (
                <label
                  key={setting.key}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-medium">{setting.label}</p>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={(profile as any)[setting.key] ?? true}
                      onChange={(e) => setProfile({ ...profile, [setting.key]: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted-foreground/30 peer-checked:bg-primary rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === "achievements" && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="content-card text-center">
                <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.level || 1}</p>
                <p className="text-sm text-muted-foreground">Level</p>
              </div>
              <div className="content-card text-center">
                <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.experience_points || 0}</p>
                <p className="text-sm text-muted-foreground">XP</p>
              </div>
              <div className="content-card text-center">
                <Award className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">
                  {achievements.filter((a) => a.earned).length}/{achievements.length}
                </p>
                <p className="text-sm text-muted-foreground">Achievements</p>
              </div>
            </div>

            {/* Achievements Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`content-card relative overflow-hidden ${
                    !achievement.earned ? "opacity-50 grayscale" : ""
                  }`}
                >
                  {achievement.earned && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-5 h-5 text-green-500" />
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: achievement.color + "20",
                      }}
                    >
                      {achievement.icon === "message-circle" && "💬"}
                      {achievement.icon === "messages-square" && "📝"}
                      {achievement.icon === "crown" && "👑"}
                      {achievement.icon === "flame" && "🔥"}
                      {achievement.icon === "zap" && "⚡"}
                      {achievement.icon === "rocket" && "🚀"}
                      {achievement.icon === "shopping-bag" && "🛒"}
                      {achievement.icon === "star" && "⭐"}
                      {achievement.icon === "heart" && "❤️"}
                      {achievement.icon === "award" && "🏆"}
                      {achievement.icon === "badge-check" && "✅"}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold">{achievement.display_name}</h3>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: achievement.color + "20",
                            color: achievement.color,
                          }}
                        >
                          +{achievement.points} XP
                        </span>
                        {achievement.is_secret && !achievement.earned && (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                            🔒 Geheim
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {achievement.earned && achievement.earnedAt && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      Erhalten am {new Date(achievement.earnedAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {activeTab !== "achievements" && (
        <div className="mt-8 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="btn-primary min-w-[200px]">
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Speichern...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Änderungen speichern
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
