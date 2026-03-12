import { createClient } from "@/lib/supabase/server";
import { LicenseManager } from "@/components/admin/license-manager";
import type { InternalKey } from "@/types/database";

export default async function LicensesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("internal_keys").select("*").order("created_at", { ascending: false }).returns<InternalKey[]>();
  return <LicenseManager keys={data || []} />;
}