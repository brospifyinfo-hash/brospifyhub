import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ProductShowcase } from "@/components/product/product-showcase";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const adminClient = createAdminClient();
  const { data: product } = await adminClient
    .from("products")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!product) {
    redirect("/dashboard");
  }

  return <ProductShowcase productSlug={slug} />;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("products")
    .select("name, short_description")
    .eq("slug", slug)
    .single();
  const product = data as { name?: string; short_description?: string | null } | null;

  return {
    title: product?.name ? `${product.name} - Brospify Hub` : "Produkt - Brospify Hub",
    description: product?.short_description || "Exklusives Produkt",
  };
}
