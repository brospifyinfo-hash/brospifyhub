import { createClient } from "@/lib/supabase/server";
import { ChannelManager } from "@/components/admin/channel-manager";
import type { Channel } from "@/types/database";

export default async function ChannelsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("channels").select("*").order("created_at", { ascending: false }).returns<Channel[]>();
  return <ChannelManager channels={data || []} />;
}