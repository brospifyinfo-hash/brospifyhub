import { createClient } from "@/lib/supabase/server";
import { QuickRepliesManager } from "@/components/admin/quick-replies-manager";
import type { QuickReply } from "@/types/database";

export default async function QuickRepliesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("quick_replies").select("*").order("created_at", { ascending: false }).returns<QuickReply[]>();
  return <QuickRepliesManager replies={data || []} />;
}