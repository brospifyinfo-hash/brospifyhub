import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { User } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let profile: User | null = null;
    if (user) {
      const adminClient = createAdminClient();
      const { data } = await adminClient.from("users").select("*").eq("id", user.id).single<User>();
      profile = data ?? null;
      if (profile && !profile.display_name) {
        const { redirect } = await import("next/navigation");
        redirect("/welcome");
      }
    }
    return <DashboardContent profile={profile} />;
  } catch (err) {
    console.error("Dashboard page error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div className="p-8 max-w-lg mx-auto">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
          <h1 className="text-lg font-semibold text-destructive mb-2">Fehler beim Laden</h1>
          <p className="text-sm text-muted-foreground font-mono break-all">{message}</p>
          <p className="text-xs text-muted-foreground mt-4">
            Prüfe die Konsole (Terminal wo &quot;npm run dev&quot; läuft) und .env.local (SUPABASE_SERVICE_ROLE_KEY).
          </p>
        </div>
      </div>
    );
  }
}
