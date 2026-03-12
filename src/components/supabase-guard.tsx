/**
 * Prüft Supabase-Umgebungsvariablen. Fehlen sie, wird eine klare
 * Setup-Seite angezeigt statt leerer/abstürzender App.
 */
export function SupabaseGuard({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isPlaceholder = (s: string) =>
    /DEIN-PROJEKT|ERSETZE|placeholder|your-project|xxxx/i.test(s);
  const hasUrl =
    typeof url === "string" &&
    url.length > 0 &&
    url.includes(".supabase.co") &&
    !isPlaceholder(url);
  const hasAnon =
    typeof anon === "string" && anon.length > 20 && !isPlaceholder(anon);
  const hasServiceRole =
    typeof serviceRole === "string" &&
    serviceRole.length > 20 &&
    !isPlaceholder(serviceRole);

  if (hasUrl && hasAnon) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-red-400">
          Supabase ist nicht konfiguriert
        </h1>
        <p className="text-gray-300">
          Es fehlen Umgebungsvariablen. Ohne sie kann die App keine Daten laden.
        </p>
        <div className="space-y-2 text-sm">
          {!hasUrl && (
            <p className="text-amber-300">• NEXT_PUBLIC_SUPABASE_URL fehlt</p>
          )}
          {!hasAnon && (
            <p className="text-amber-300">• NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt</p>
          )}
          {hasUrl && hasAnon && !hasServiceRole && (
            <p className="text-amber-300">
              • SUPABASE_SERVICE_ROLE_KEY fehlt (Profil/Dashboard-Daten werden sonst nicht geladen)
            </p>
          )}
        </div>
        <div className="rounded-xl bg-black/40 p-4 font-mono text-sm text-gray-300 overflow-x-auto">
          <p className="text-gray-500 mb-2">Lege im Projektordner die Datei .env.local an:</p>
          <pre className="whitespace-pre">
{`NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...`}
          </pre>
        </div>
        <p className="text-gray-400 text-sm">
          Werte: Supabase Dashboard → dein Projekt → Project Settings → API (Project URL, anon public, service_role).
          Danach Dev-Server neu starten: <code className="bg-black/30 px-1 rounded">npm run dev</code>
        </p>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
        >
          Supabase Dashboard öffnen →
        </a>
      </div>
    </div>
  );
}
