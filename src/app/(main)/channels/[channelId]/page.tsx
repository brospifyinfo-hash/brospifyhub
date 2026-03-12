import { createClient } from "@/lib/supabase/server";
import { ChannelContentDynamic } from "@/components/channel/channel-content-dynamic";
import type { Channel } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ channelId: string }>; }

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params;
  const supabase = await createClient();
  const { data: channel } = await supabase.from("channels").select("type").eq("id", channelId).single<Channel>();
  return <ChannelContentDynamic channelId={channelId} channelType={channel?.type || "standard"} />;
}