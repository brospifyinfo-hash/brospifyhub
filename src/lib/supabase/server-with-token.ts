import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * User-ID aus JWT (Bearer-Token) holen.
 */
function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Supabase-Client für API-Routen: nutzt Cookie-Session oder Authorization-Bearer (localStorage).
 */
export async function getSupabaseAndUser(request: Request): Promise<{
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  user: { id: string } | null;
}> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    const userId = getUserIdFromToken(token);
    if (userId) {
      const client = createSupabaseClient<Database>(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      return { supabase: client as Awaited<ReturnType<typeof createServerClient>>, user: { id: userId } };
    }
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user: user ? { id: user.id } : null };
}
