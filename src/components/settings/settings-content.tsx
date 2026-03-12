"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Save, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/supabase/client";
import type { User as UserProfile } from "@/types/database";

interface Props { 
  profile: UserProfile | null; 
}

const containerVariants = { 
  hidden: { opacity: 0 }, 
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } } 
};

const itemVariants = { 
  hidden: { opacity: 0, y: 20 }, 
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } } 
};

export function SettingsContent({ profile: initialProfile }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [profileLoading, setProfileLoading] = useState(!initialProfile);
  const [profileError, setProfileError] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (initialProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/user/profile");
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data?.profile) {
          setProfile(data.profile);
          setDisplayName(data.profile.display_name || "");
        }
      } catch {
        if (!cancelled) setProfileError(true);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialProfile, router]);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name || "");
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) { 
      setError("Anzeigename darf nicht leer sein"); 
      return; 
    }
    
    setSaving(true); 
    setError(null); 
    setSuccess(false);
    
    try {
      const response = await apiFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Fehler beim Speichern");
      }
    } catch {
      setError("Fehler beim Speichern");
    }
    
    setSaving(false);
  };

  const retryProfile = () => {
    setProfileError(false);
    setProfileLoading(true);
    apiFetch("/api/user/profile")
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (data?.profile) {
          setProfile(data.profile);
          setDisplayName(data.profile.display_name || "");
        }
      })
      .finally(() => setProfileLoading(false));
  };

  if (profileLoading && !profileError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Profil wird geladen…</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center max-w-md">
          <p className="font-medium text-destructive mb-2">Profil konnte nicht geladen werden</p>
          <p className="text-sm text-muted-foreground mb-4">Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button variant="outline" onClick={retryProfile} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible" 
        className="max-w-2xl mx-auto p-8 space-y-6"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Verwalte dein Profil</p>
        </motion.div>

        {/* Status Message */}
        {(error || success) && (
          <motion.div 
            variants={itemVariants} 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 p-4 rounded-2xl ${
              success ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
            }`}
          >
            {success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">
              {success ? "Erfolgreich gespeichert!" : error}
            </span>
          </motion.div>
        )}

        {/* Profile Section */}
        <motion.div 
          variants={itemVariants} 
          className="content-card"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profil
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Anzeigename
              </label>
              <Input 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                placeholder="Dein Name" 
                className="input-modern h-12" 
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Lizenz-Key
              </label>
              <Input 
                value={profile?.license_key || ""} 
                disabled 
                className="input-modern h-12 font-mono opacity-60" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dein Lizenz-Key kann nicht geändert werden
              </p>
            </div>
            
            <motion.div 
              whileHover={{ scale: 1.01 }} 
              whileTap={{ scale: 0.98 }}
              className="pt-2"
            >
              <Button 
                onClick={handleSaveProfile} 
                disabled={saving} 
                className="w-full h-12 btn-primary"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Wird gespeichert..." : "Profil speichern"}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div 
          variants={itemVariants} 
          className="content-card bg-primary/5 border-primary/10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {profile?.display_name?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {profile?.display_name || "Unbekannt"}
              </p>
              <p className="text-sm text-muted-foreground">
                Premium Mitglied seit {profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString("de-DE", { 
                      month: "long", 
                      year: "numeric" 
                    }) 
                  : "unbekannt"
                }
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
