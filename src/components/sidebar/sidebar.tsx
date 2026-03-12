"use client";

import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  MessageCircle, 
  Trophy,
  Ticket,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  Heart,
  Hash,
  Star,
  FolderOpen,
  Package
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserPanel } from "./user-panel";
import { ThemeSwitcher } from "./theme-switcher";
import { MemberCount } from "./member-count";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { Channel, ChannelCategory } from "@/types/database";

const navItems = [
  { 
    href: "/dashboard", 
    icon: LayoutDashboard, 
    label: "Dashboard" 
  },
  { 
    href: "/favorites", 
    icon: Heart, 
    label: "Gespeichert" 
  },
  { 
    href: "/tickets", 
    icon: Ticket, 
    label: "Support-Tickets" 
  },
  { 
    href: "/channels/winning-product", 
    icon: Trophy, 
    label: "Winning Product" 
  },
  { 
    href: "/products", 
    icon: Package, 
    label: "Produkte" 
  },
  { 
    href: "/settings", 
    icon: Settings, 
    label: "Einstellungen" 
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [appName, setAppName] = useState("Brospify Hub");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("app_settings").select("key, value").in("key", ["app_logo_url", "app_name"]).then(({ data }) => {
      data?.forEach((row) => {
        if (row.key === "app_logo_url" && row.value) setAppLogo(row.value);
        if (row.key === "app_name" && row.value) setAppName(row.value);
      });
    });
  }, []);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 glass-sidebar flex flex-col z-40">
      {/* Logo Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-sidebar-border">
        {appLogo ? (
          <img src={appLogo} alt={appName} className="h-9 w-auto max-w-[140px] object-contain object-left" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <span className="text-primary-foreground font-bold text-lg">{appName.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sidebar-accent-foreground truncate">
            {appName}
          </h1>
          <MemberCount />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            
            return (
              <Link key={item.href} href={item.href}>
                <div className={`nav-item ${isActive ? "active" : ""}`}>
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Channels Section */}
        <div className="mt-6">
          <div className="section-header">Channels</div>
          <ChannelList />
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border">
        <ThemeSwitcher />
        <UserPanel />
      </div>
    </aside>
  );
}

function ChannelList() {
  return (
    <div className="px-1 space-y-1">
      <ChannelListContent />
    </div>
  );
}

interface ChannelWithCategory extends Channel {
  category?: ChannelCategory | null;
}

function ChannelListContent() {
  const [channels, setChannels] = useState<ChannelWithCategory[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    const fetchData = async () => {
      try {
        const [res, catRes] = await Promise.all([
          apiFetch("/api/channels"),
          supabase.from("channel_categories").select("*").order("order_index"),
        ]);
        if (catRes.data) setCategories(catRes.data);
        const json = (await res.json()) as { channels?: ChannelWithCategory[] };
        if (res.ok && Array.isArray(json.channels)) {
          const list = json.channels;
          const visible = list.filter((c) => c.is_visible !== false);
          const forSidebar = visible.filter((c) => c.type !== "winning_product" && c.type !== "support");
          setChannels(forSidebar.length > 0 ? forSidebar : list.filter((c) => c.type !== "winning_product" && c.type !== "support"));
        }
      } catch {
        const [channelsRes, catRes] = await Promise.all([
          supabase.from("channels").select("*").order("created_at", { ascending: true }),
          supabase.from("channel_categories").select("*").order("order_index"),
        ]);
        if (catRes.data) setCategories(catRes.data);
        if (channelsRes.data) {
          const list = (channelsRes.data as ChannelWithCategory[]).filter((c) => c.type !== "winning_product" && c.type !== "support");
          setChannels(list);
        }
      }
    };

    fetchData();

    const subscription = supabase
      .channel("channels-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_categories" }, fetchData)
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "success_stories":
        return Star;
      default:
        return Hash;
    }
  };

  if (channels.length === 0 && categories.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-4 py-2">
        Keine Channels
      </p>
    );
  }

  const uncategorizedChannels = channels.filter(c => !c.category_id);
  const categorizedChannels = categories.map(cat => ({
    category: cat,
    channels: channels.filter(c => c.category_id === cat.id)
  })).filter(g => g.channels.length > 0);

  return (
    <>
      {/* Categorized Channels */}
      {categorizedChannels.map(({ category, channels: catChannels }) => {
        const isCollapsed = collapsedCategories.has(category.id);
        
        return (
          <div key={category.id} className="mb-2">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <FolderOpen className="w-3 h-3" />
              <span className="uppercase tracking-wider">{category.name}</span>
              <span className="ml-auto text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                {catChannels.length}
              </span>
            </button>
            
            {!isCollapsed && (
              <div className="overflow-hidden">
                {catChannels.map((channel) => {
                  const Icon = getChannelIcon(channel.type);
                  const isActive = pathname === `/channels/${channel.id}`;
                  return (
                    <Link key={channel.id} href={`/channels/${channel.id}`}>
                      <div className={`nav-item ml-4 ${isActive ? "active" : ""}`}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Uncategorized Channels */}
      {uncategorizedChannels.length > 0 && (
        <>
          {categorizedChannels.length > 0 && (
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sonstige
            </div>
          )}
          {uncategorizedChannels.map((channel) => {
            const Icon = getChannelIcon(channel.type);
            const isActive = pathname === `/channels/${channel.id}`;
            
            return (
              <Link key={channel.id} href={`/channels/${channel.id}`}>
                <div className={`nav-item ${isActive ? "active" : ""}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </div>
              </Link>
            );
          })}
        </>
      )}
    </>
  );
}
