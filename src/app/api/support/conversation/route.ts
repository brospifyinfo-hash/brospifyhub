import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/supabase/server-with-token";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getSupabaseAndUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    let { data: conversation } = await adminClient
      .from("support_conversations")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      const { data: newConversation } = await adminClient
        .from("support_conversations")
        .insert({ user_id: user.id })
        .select()
        .single();
      conversation = newConversation;
    }

    const { data: profile } = await adminClient
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      conversationId: conversation?.id ?? "",
      userId: user.id,
      userName: profile?.display_name || "User",
    });
  } catch (e) {
    console.error("Support conversation API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
