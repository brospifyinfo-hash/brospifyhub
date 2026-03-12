import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const supabase = await createClient();
  
  const [usersRes, channelsRes, messagesRes, pendingRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact" }),
    supabase.from("channels").select("id", { count: "exact" }),
    supabase.from("messages").select("id", { count: "exact" }),
    supabase.from("messages").select("id", { count: "exact" }).eq("is_approved", false),
  ]);

  const stats = {
    totalUsers: usersRes.count || 0,
    totalChannels: channelsRes.count || 0,
    totalMessages: messagesRes.count || 0,
    pendingApprovals: pendingRes.count || 0,
  };

  return <AdminDashboard stats={stats} />;
}