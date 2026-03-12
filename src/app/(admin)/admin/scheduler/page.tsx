import { createClient } from "@/lib/supabase/server";
import { ContentScheduler } from "@/components/admin/content-scheduler";
import type { ScheduledPost, Channel } from "@/types/database";

interface PostWithChannel extends ScheduledPost { channels: Pick<Channel, "id" | "name"> | null; }

export default async function SchedulerPage() {
  const supabase = await createClient();
  const [postsRes, channelsRes] = await Promise.all([
    supabase.from("scheduled_posts").select("*, channels(id, name)").order("scheduled_for", { ascending: true }).returns<PostWithChannel[]>(),
    supabase.from("channels").select("*").returns<Channel[]>(),
  ]);
  return <ContentScheduler posts={postsRes.data || []} channels={channelsRes.data || []} />;
}