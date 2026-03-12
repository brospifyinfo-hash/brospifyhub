import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ userNumber: string }>;
}

export default async function UserByNumberPage({ params }: Props) {
  const { userNumber } = await params;
  const num = parseInt(userNumber, 10);
  if (Number.isNaN(num)) redirect("/admin/users");

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("user_number", num)
    .maybeSingle();

  if (user?.id) redirect(`/user/${user.id}`);
  redirect("/admin/users");
}
