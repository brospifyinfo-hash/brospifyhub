import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsContent } from "@/components/settings/settings-content";
import type { User } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let profile: User | null = null;
    if (user) {
      const adminClient = createAdminClient();
      const { data } = await adminClient.from("users").select("*").eq("id", user.id).single<User>();
      profile = data ?? null;
    }
    return <SettingsContent profile={profile} />;
  } catch (err) {
    console.error("Settings page error:", err);
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center max-w-md">
          <p className="font-medium text-destructive mb-2">Einstellungen konnten nicht geladen werden</p>
          <p className="text-sm text-muted-foreground">
            Bitte die Seite neu laden oder später erneut versuchen.
          </p>
        </div>
      </div>
    );
  }
}
