"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  return Object.keys(localStorage).some(
    (k) => k.startsWith("sb-") && k.includes("auth")
  );
}

/**
 * Zeigt die App sofort, wenn eine Session im localStorage liegt (schnell).
 * Prüft getSession() im Hintergrund und leitet bei ungültiger Session zur Login-Seite um.
 */
export function AuthReady({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => hasStoredSession());
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (session) setReady(true);
        else router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
