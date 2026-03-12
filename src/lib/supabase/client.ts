import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "[Supabase] Fehlende Umgebungsvariablen. Bitte in .env.local setzen:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
      "  NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
  );
}

/**
 * Browser-Client mit localStorage – Session bleibt nach Reload erhalten.
 */
export const createClient = () =>
  createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

/**
 * Für Aufrufe an unsere API: Session-Token aus localStorage holen und als Bearer mitsenden.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}
