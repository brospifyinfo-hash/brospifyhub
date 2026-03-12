"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Key, Loader2, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithLicenseKey } from "@/app/actions/auth";
import { generateDeviceFingerprint, getDeviceName, getBrowserName } from "@/lib/device-fingerprint";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(loginWithLicenseKey, null);
  const [deviceInfo, setDeviceInfo] = useState({ fingerprint: "", deviceName: "", userAgent: "" });
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [appName, setAppName] = useState("Brospify Hub");

  useEffect(() => {
    setDeviceInfo({
      fingerprint: generateDeviceFingerprint(),
      deviceName: `${getDeviceName()} - ${getBrowserName()}`,
      userAgent: navigator.userAgent,
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("app_settings").select("key, value").in("key", ["app_logo_url", "app_name"]).then(({ data }) => {
      data?.forEach((row) => {
        if (row.key === "app_logo_url" && row.value) setAppLogo(row.value);
        if (row.key === "app_name" && row.value) setAppName(row.value);
      });
    });
  }, []);

  useEffect(() => {
    if (!state?.success) return;
    const supabase = createClient();
    if (state.session) {
      supabase.auth.setSession({ access_token: state.session.access_token, refresh_token: state.session.refresh_token }).then(() => {
        router.push(state.isNewUser ? "/welcome" : "/dashboard");
        router.refresh();
      });
    } else {
      router.push(state.isNewUser ? "/welcome" : "/dashboard");
      router.refresh();
    }
  }, [state?.success, state?.isNewUser, state?.session, router]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex bg-background">
      {/* Desktop: linke Seite – Branding (volle Höhe, großer Bereich) */}
      <div className="hidden lg:flex lg:flex-1 lg:min-w-0 lg:max-w-[55%] flex-col justify-center px-12 xl:px-24 py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_40%,rgba(149,191,71,0.18),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_70%_60%,rgba(149,191,71,0.08),transparent_50%)]" />
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-xl"
        >
          {appLogo ? (
            <img src={appLogo} alt={appName} className="h-14 xl:h-16 w-auto object-contain mb-12" />
          ) : (
            <div
              className="w-16 h-16 xl:w-20 xl:h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-12"
              style={{ backgroundColor: "#95BF47" }}
            >
              {appName.charAt(0)}
            </div>
          )}
          <h1 className="text-3xl xl:text-5xl font-bold text-foreground tracking-tight">
            Willkommen bei {appName}
          </h1>
          <p className="text-lg xl:text-xl text-muted-foreground mt-5 leading-relaxed max-w-md">
            Melde dich mit deinem Lizenz-Key an, um auf alle Inhalte und deine Community zuzugreifen.
          </p>
          <div className="flex items-center gap-3 mt-10 text-sm text-muted-foreground">
            <Shield className="w-5 h-5 text-primary flex-shrink-0" />
            <span>Sichere Anmeldung · Deine Daten bleiben geschützt</span>
          </div>
        </motion.div>
      </div>

      {/* Rechte Seite (Desktop) / Vollbreite (Mobile): Formular */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 xl:p-20 relative min-w-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-border/50" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-[400px] lg:max-w-[440px]"
        >
          {/* Mobile: Logo oben */}
          <div className="lg:hidden text-center mb-8">
            {appLogo ? (
              <img src={appLogo} alt={appName} className="h-10 w-auto mx-auto object-contain mb-4" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white mx-auto mb-4"
                style={{ backgroundColor: "#95BF47" }}
              >
                {appName.charAt(0)}
              </div>
            )}
            <p className="text-sm text-muted-foreground">{appName}</p>
          </div>

          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Anmelden
          </h2>
          <p className="text-muted-foreground mt-1 mb-6 sm:mb-8">
            Gib deinen Lizenz-Key ein.
          </p>

          <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 sm:p-8">
            <form action={formAction} className="space-y-5">
              <input type="hidden" name="deviceFingerprint" value={deviceInfo.fingerprint} />
              <input type="hidden" name="deviceName" value={deviceInfo.deviceName} />
              <input type="hidden" name="userAgent" value={deviceInfo.userAgent} />

              <div>
                <label htmlFor="licenseKey" className="block text-sm font-medium text-foreground mb-2">
                  Lizenz-Key
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="licenseKey"
                    name="licenseKey"
                    type="text"
                    placeholder="XXXX-XXXX-XXXX"
                    className="pl-12 h-12 rounded-xl border-border bg-background text-base font-mono placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                    autoComplete="off"
                    autoFocus
                    disabled={isPending}
                  />
                </div>
              </div>

              {state?.error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3"
                >
                  <p className="text-sm text-destructive">{state.error}</p>
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Wird geprüft…
                  </>
                ) : (
                  <>
                    Anmelden
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {appName} · Lizenz-Anmeldung
          </p>
        </motion.div>
      </div>
    </div>
  );
}
