import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/supabase/server-with-token";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WinningProductSettings } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getSupabaseAndUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: channel } = await adminClient
      .from("channels")
      .select("*")
      .eq("type", "winning_product")
      .single();

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const settings = channel.settings as unknown as WinningProductSettings;
    const productId = settings?.product_id || "wp-001";

    const { data: purchase } = await adminClient
      .from("user_purchases")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .single();

    return NextResponse.json({
      userId: user.id,
      hasPurchased: !!purchase,
      hasUpsell: purchase?.purchase_type === "upsell",
    });
  } catch (e) {
    console.error("Winning product API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
