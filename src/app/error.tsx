"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-lg w-full rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
        <h1 className="text-lg font-semibold text-destructive mb-2">Fehler</h1>
        <p className="text-sm font-mono break-all mb-4">{error?.message ?? "Unbekannter Fehler"}</p>
        <p className="text-xs text-muted-foreground mb-6">
          Terminal prüfen (npm run dev). DB: IN_DATENBANK_EINFUEGEN.sql ausführen.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset} variant="outline" size="sm">
            Erneut versuchen
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-transparent hover:bg-accent hover:text-accent-foreground h-9 px-4"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
