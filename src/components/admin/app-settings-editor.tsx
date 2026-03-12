"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Settings, Users, Save, Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const SETTING_KEYS = [
  "app_logo_url",
  "app_name",
  "app_primary_color",
  "welcome_title",
  "welcome_text",
  "fake_member_bonus",
  "meta_title_suffix",
  "max_upload_size_mb",
] as const;

export function AppSettingsEditor() {
  const [settings, setSettings] = useState<Record<string, string>>({
    app_logo_url: "",
    app_name: "Brospify Hub",
    app_primary_color: "#95BF47",
    welcome_title: "Willkommen zurück!",
    welcome_text: "Schön, dass du da bist.",
    fake_member_bonus: "0",
    meta_title_suffix: " - Brospify Hub",
    max_upload_size_mb: "10",
  });
  const [realMemberCount, setRealMemberCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoDrag, setLogoDrag] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      const map: Record<string, string> = { ...settings };
      data?.forEach((row) => {
        if (row.value != null) map[row.key] = String(row.value);
      });
      setSettings(map);

      const { count } = await supabase.from("users").select("*", { count: "exact", head: true });
      if (count != null) setRealMemberCount(count);
    };
    load();
  }, []);

  const saveSetting = useCallback(
    async (key: string, value: string) => {
      await supabase.from("app_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    },
    [supabase]
  );

  const handleSave = async () => {
    setIsSaving(true);
    for (const key of SETTING_KEYS) {
      if (settings[key] != null) await saveSetting(key, settings[key]);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setIsSaving(false);
  };

  const handleLogoDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setLogoDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (!file?.type.startsWith("image/")) return;
      setLogoUploading(true);
      const ext = file.name.split(".").pop() || "png";
      const path = `app/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
        setSettings((s) => ({ ...s, app_logo_url: urlData.publicUrl }));
        await saveSetting("app_logo_url", urlData.publicUrl);
      }
      setLogoUploading(false);
    },
    [supabase, saveSetting]
  );

  const handleLogoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file?.type.startsWith("image/")) return;
      setLogoUploading(true);
      const ext = file.name.split(".").pop() || "png";
      const path = `app/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
        setSettings((s) => ({ ...s, app_logo_url: urlData.publicUrl }));
        await saveSetting("app_logo_url", urlData.publicUrl);
      }
      setLogoUploading(false);
      e.target.value = "";
    },
    [supabase, saveSetting]
  );

  const removeLogo = useCallback(async () => {
    setSettings((s) => ({ ...s, app_logo_url: "" }));
    await saveSetting("app_logo_url", "");
  }, [saveSetting]);

  const displayCount = realMemberCount + (parseInt(settings.fake_member_bonus || "0") || 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">App-Einstellungen</h1>
            <p className="text-muted-foreground text-sm">Logo, Name, Willkommenstext & Member-Anzeige</p>
          </div>
        </div>

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="content-card space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-primary" />
            App-Logo (oben links)
          </h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setLogoDrag(true); }}
            onDragLeave={() => setLogoDrag(false)}
            onDrop={handleLogoDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
              logoDrag ? "border-primary bg-primary/5" : "border-border bg-muted/30"
            }`}
          >
            {settings.app_logo_url ? (
              <div className="relative inline-block">
                <img
                  src={settings.app_logo_url}
                  alt="Logo"
                  className="max-h-24 w-auto object-contain mx-auto rounded-lg"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground hover:opacity-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="logo-upload"
                  onChange={handleLogoSelect}
                  disabled={logoUploading}
                />
                <label htmlFor="logo-upload" className="cursor-pointer block">
                  {logoUploading ? (
                    <Loader2 className="w-12 h-12 mx-auto text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Bild hierher ziehen oder klicken</p>
                    </>
                  )}
                </label>
              </>
            )}
          </div>
        </motion.div>

        {/* App-Name & Farben */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="content-card space-y-4">
          <h2 className="font-semibold text-foreground">Erscheinungsbild</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium block mb-2">App-Name</label>
              <Input
                value={settings.app_name || ""}
                onChange={(e) => setSettings((s) => ({ ...s, app_name: e.target.value }))}
                placeholder="Brospify Hub"
                className="input-modern"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Primärfarbe</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={settings.app_primary_color || "#95BF47"}
                  onChange={(e) => setSettings((s) => ({ ...s, app_primary_color: e.target.value }))}
                  className="w-14 h-10 p-1 rounded-lg cursor-pointer border border-border"
                />
                <Input
                  value={settings.app_primary_color || "#95BF47"}
                  onChange={(e) => setSettings((s) => ({ ...s, app_primary_color: e.target.value }))}
                  className="input-modern flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">SEO-Titel-Suffix</label>
            <Input
              value={settings.meta_title_suffix || ""}
              onChange={(e) => setSettings((s) => ({ ...s, meta_title_suffix: e.target.value }))}
              placeholder=" - Brospify Hub"
              className="input-modern"
            />
          </div>
        </motion.div>

        {/* Willkommenstext */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="content-card space-y-4">
          <h2 className="font-semibold text-foreground">Willkommenstext (Dashboard)</h2>
          <div>
            <label className="text-sm font-medium block mb-2">Titel</label>
            <Input
              value={settings.welcome_title || ""}
              onChange={(e) => setSettings((s) => ({ ...s, welcome_title: e.target.value }))}
              placeholder="Willkommen zurück!"
              className="input-modern"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Text</label>
            <Textarea
              value={settings.welcome_text || ""}
              onChange={(e) => setSettings((s) => ({ ...s, welcome_text: e.target.value }))}
              placeholder="Schön, dass du da bist."
              rows={2}
              className="input-modern resize-none"
            />
          </div>
        </motion.div>

        {/* Member-Anzeige */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="content-card space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Member-Anzeige</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-secondary/50 text-center">
              <p className="text-2xl font-bold text-foreground">{realMemberCount}</p>
              <p className="text-xs text-muted-foreground">Echte Member</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 text-center">
              <p className="text-2xl font-bold text-primary">+{parseInt(settings.fake_member_bonus || "0") || 0}</p>
              <p className="text-xs text-muted-foreground">Bonus</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 text-center">
              <p className="text-2xl font-bold text-green-500">{displayCount}</p>
              <p className="text-xs text-muted-foreground">Angezeigt</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Fake Member Bonus</label>
            <Input
              type="number"
              value={settings.fake_member_bonus || "0"}
              onChange={(e) => setSettings((s) => ({ ...s, fake_member_bonus: e.target.value }))}
              placeholder="0"
              className="input-modern h-12"
              min={0}
            />
          </div>
        </motion.div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="btn-primary" style={{ backgroundColor: settings.app_primary_color || "#95BF47" }}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? "Gespeichert!" : <><Save className="w-4 h-4 mr-2" />Speichern</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
