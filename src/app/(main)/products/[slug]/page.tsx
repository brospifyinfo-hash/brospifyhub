import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductSlugPage({ params }: Props) {
  await params;
  redirect("/dashboard");
}
