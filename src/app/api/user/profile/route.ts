import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/supabase/server-with-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getSupabaseAndUser(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: profile, error } = await adminClient
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single<User>();

    if (error) {
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getSupabaseAndUser(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { display_name } = body;

    if (!display_name || typeof display_name !== "string") {
      return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
    }

    if (display_name.length < 2 || display_name.length > 32) {
      return NextResponse.json({ error: "Name muss zwischen 2 und 32 Zeichen lang sein" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("users")
      .update({ display_name })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
