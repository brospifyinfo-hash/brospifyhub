import { createClient } from "@/lib/supabase/server";
import { ChannelContent } from "@/components/channel/channel-content";
import type { Channel } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ channelId: string }>; }

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params;
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).single<Channel>();
  return <ChannelContent channelId={channelId} channelType={channel?.type || "standard"} />;
}