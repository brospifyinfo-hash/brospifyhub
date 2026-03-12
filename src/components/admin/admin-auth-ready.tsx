"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/supabase/client";

export function AdminAuthReady({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await apiFetch("/api/user/profile");
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (data?.profile?.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    };

    init();
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Admin wird geladen…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
