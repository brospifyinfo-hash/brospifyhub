import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScheduledPost } from "@/types/database";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("is_posted", false)
    .lte("scheduled_for", now)
    .returns<ScheduledPost[]>();

  if (error || !posts) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }

  let posted = 0;
  for (const post of posts) {
    const { error: insertError } = await supabase.from("messages").insert({
      channel_id: post.channel_id,
      user_id: post.user_id,
      content: post.attachment_url ? `${post.content}\n\n📎 ${post.attachment_url}` : post.content,
      is_approved: true,
    });

    if (!insertError) {
      await supabase.from("scheduled_posts").update({ is_posted: true, posted_at: now }).eq("id", post.id);
      posted++;
    }
  }

  return NextResponse.json({ success: true, posted, total: posts.length });
}