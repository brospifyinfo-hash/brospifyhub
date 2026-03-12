import { createClient } from "@/lib/supabase/server";
import { TutorialEditor } from "@/components/admin/tutorial-editor";
import type { TutorialStep } from "@/types/database";

export default async function TutorialsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("tutorial_steps").select("*").order("order_index", { ascending: true }).returns<TutorialStep[]>();
  return <TutorialEditor steps={data || []} />;
}