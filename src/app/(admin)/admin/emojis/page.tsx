import { createClient } from "@/lib/supabase/server";
import { EmojiManager } from "@/components/admin/emoji-manager";
import type { CustomEmoji } from "@/types/database";

export default async function EmojisPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("custom_emojis").select("*").order("created_at", { ascending: false }).returns<CustomEmoji[]>();
  return <EmojiManager emojis={data || []} />;
}