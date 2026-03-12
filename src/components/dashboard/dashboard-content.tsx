"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, ArrowRight, Package, Ticket, CreditCard } from "lucide-react";
import Link from "next/link";
import type { User, Product } from "@/types/database";
import { createClient, apiFetch } from "@/lib/supabase/client";

interface Props {
  profile: User | null;
}

export function DashboardContent({ profile: initialProfile }: Props) {
  const [profile, setProfile] = useState<User | null>(initialProfile);
  const [profileLoading, setProfileLoading] = useState(!initialProfile);
  const [products, setProducts] = useState<Product[]>([]);
  const [welcomeTitle, setWelcomeTitle] = useState("Willkommen zurück!");
  const [welcomeText, setWelcomeText] = useState("Schön, dass du da bist.");
  const [openTickets, setOpenTickets] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (initialProfile) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/user/profile");
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile);
        if (!data.profile.display_name) {
          router.replace("/welcome");
          return;
        }
      }
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [initialProfile, router]);

  useEffect(() => {
    const supabase = createClient();
    const pid = profile?.id;

    const load = async () => {
      const [settingsRes, prodRes, ticketsRes] = await Promise.all([
        supabase.from("app_settings").select("key, value").in("key", ["welcome_title", "welcome_text"]),
        supabase.from("products").select("*").eq("is_active", true).eq("show_in_menu", true).order("order_index").limit(6),
        pid ? supabase.from("tickets").select("*", { count: "exact", head: true }).eq("user_id", pid).in("status", ["open", "in_progress"]) : Promise.resolve({ count: 0 }),
      ]);
      settingsRes.data?.forEach((s) => {
        if (s.key === "welcome_title" && s.value) setWelcomeTitle(s.value);
        if (s.key === "welcome_text" && s.value) setWelcomeText(s.value);
      });
      setProducts(prodRes.data || []);
      const count = (ticketsRes as { count?: number } | null)?.count;
      if (typeof count === "number") setOpenTickets(count);
    };

    load();
  }, [profile?.id]);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero */}
        <section className="relative rounded-3xl overflow-hidden border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-10">
          <div className="relative z-10">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
              {welcomeTitle}
            </h1>
            <p className="mt-2 text-muted-foreground text-base md:text-lg max-w-xl">
              {welcomeText.replace("{name}", profile?.display_name || "User")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-background/80 px-4 py-2.5 border border-border/60">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">{profile?.credits ?? 0}</span>
                <span className="text-sm text-muted-foreground">Credits</span>
              </div>
              {openTickets > 0 && (
                <Link href="/tickets" className="flex items-center gap-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2.5 border border-amber-500/20">
                  <Ticket className="w-5 h-5" />
                  <span className="font-semibold">{openTickets}</span>
                  <span className="text-sm">offene Tickets</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Schnellzugriff
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/support">
              <div className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Headphones className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Support</h3>
                  <p className="text-sm text-muted-foreground">Hilfe & Anfragen</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </Link>
            <Link href="/tickets">
              <div className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Ticket className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Tickets</h3>
                  <p className="text-sm text-muted-foreground">Deine Support-Tickets</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </Link>
          </div>
        </section>

        {/* Produkte */}
        {products.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Produkte
              </h2>
              <Link href="/products" className="text-sm text-primary hover:underline font-medium">
                Alle anzeigen
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`}>
                  <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
                    <div className="aspect-video bg-muted/50 flex items-center justify-center relative">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-12 h-12 text-muted-foreground/50" style={{ color: p.badge_color }} />
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
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {p.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {p.short_description || p.description || "Mehr erfahren"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
