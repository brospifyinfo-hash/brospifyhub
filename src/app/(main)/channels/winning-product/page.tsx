import { createAdminClient } from "@/lib/supabase/admin";
import { WinningProductView } from "@/components/channels/winning-product-view";
import type { Channel } from "@/types/database";

export default async function WinningProductPage() {
  const adminClient = createAdminClient();
  const { data: channel } = await adminClient
    .from("channels")
    .select("*")
    .eq("type", "winning_product")
    .single<Channel>();

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Winning Product nicht verfügbar</p>
      </div>
    );
  }

  return <WinningProductView channel={channel} />;
}
