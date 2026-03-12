import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ userNumber: string }>;
}

export default async function AdminUserNumberPage({ params }: Props) {
  await params;
  redirect("/admin/channels");
}
