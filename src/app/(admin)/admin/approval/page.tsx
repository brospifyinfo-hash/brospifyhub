import { createClient } from "@/lib/supabase/server";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import type { Message, User, Channel } from "@/types/database";

interface MessageWithDetails extends Message { users: Pick<User, "id" | "display_name"> | null; channels: Pick<Channel, "id" | "name"> | null; }

export default async function ApprovalPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select("*, users(id, display_name), channels(id, name)").eq("is_approved", false).order("created_at", { ascending: false }).returns<MessageWithDetails[]>();
  return <ApprovalQueue messages={data || []} />;
}