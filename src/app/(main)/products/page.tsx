import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Package } from "lucide-react";
import type { Product } from "@/types/database";

export const metadata = {
  title: "Produkte",
  description: "Alle verfügbaren Produkte im Überblick.",
};

export default async function ProductsPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("show_in_menu", true)
    .order("order_index");

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Produkte
        </h1>
        <p className="text-muted-foreground mt-1 mb-8">
          Alle verfügbaren Produkte im Überblick.
        </p>

        {!products?.length ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Package className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Aktuell keine Produkte sichtbar.</p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
            >
              Zum Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(products as Product[]).map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`}>
                <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors h-full flex flex-col">
                  <div className="aspect-video bg-muted/50 flex items-center justify-center relative">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package
                        className="w-12 h-12 text-muted-foreground/50"
                        style={{ color: p.badge_color }}
                      />
                    )}
                    {p.badge_text && (
                      <span
                        className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: p.badge_color }}
                      >
                        {p.badge_text}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1 flex-1">
                      {p.short_description || p.description || "Mehr erfahren"}
                    </p>
                    <span className="text-sm text-primary font-medium mt-3 inline-flex items-center gap-1 group-hover:underline">
                      Ansehen
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
