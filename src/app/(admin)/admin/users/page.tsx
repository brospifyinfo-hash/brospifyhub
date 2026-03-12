import { createClient } from "@/lib/supabase/server";
import { UserManagement } from "@/components/admin/user-management";
import type { User, Channel } from "@/types/database";

export default async function UsersPage() {
  const supabase = await createClient();
  const [usersRes, channelsRes] = await Promise.all([
    supabase.from("users").select("*").order("created_at", { ascending: false }).returns<User[]>(),
    supabase.from("channels").select("*").returns<Channel[]>(),
  ]);
  return <UserManagement users={usersRes.data || []} channels={channelsRes.data || []} />;
}