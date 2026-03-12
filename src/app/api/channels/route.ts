import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/supabase/server-with-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Channel } from "@/types/database";

/**
 * GET /api/channels – Channels laden (Cookie oder Authorization: Bearer aus localStorage).
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseAndUser(request);

    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    let data: Channel[] | null = null;
    let error: Error | null = null;

    try {
      const res = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: true })
        .returns<Channel[]>();
      data = res.data ?? null;
      error = res.error ? new Error(res.error.message) : null;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }

    if (error || !data || data.length === 0) {
      try {
        const adminClient = createAdminClient();
        const res = await adminClient
          .from("channels")
          .select("*")
          .order("created_at", { ascending: true })
          .returns<Channel[]>();
        if (res.data && res.data.length > 0) {
          return NextResponse.json({ channels: res.data });
        }
      } catch (adminErr) {
        console.error("Channels API admin fallback:", adminErr);
      }
    }

    if (data) {
      return NextResponse.json({ channels: data });
    }

    return NextResponse.json({ channels: [] });
  } catch (err) {
    console.error("Channels API error:", err);
    return NextResponse.json(
      { error: "Fehler beim Laden der Channels", channels: [] },
      { status: 500 }
    );
  }
}
