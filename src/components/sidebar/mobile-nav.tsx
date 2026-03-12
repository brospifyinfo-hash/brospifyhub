"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    const handleRouteChange = () => setIsOpen(false);
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-sidebar-accent-foreground">Brospify Hub</span>
        </div>
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={isOpen ? "Menü schließen" : "Menü öffnen"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            
            {/* Sidebar Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed top-14 left-0 bottom-0 w-[280px] z-50"
              onClick={(e) => {
                // Close menu when clicking a link
                if ((e.target as HTMLElement).closest("a")) {
                  setIsOpen(false);
                }
              }}
            >
              <MobileSidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileSidebarContent() {
  return (
    <div className="h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <MobileNavContent />
      </div>
    </div>
  );
}

import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, Heart, Ticket, Trophy, Hash, Star, Package, Settings,
  FolderOpen, ChevronDown, ChevronRight, Sun, Moon, Monitor
} from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import type { Channel, ChannelCategory } from "@/types/database";
import { UserPanel } from "./user-panel";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/favorites", icon: Heart, label: "Gespeichert" },
  { href: "/tickets", icon: Ticket, label: "Support-Tickets" },
  { href: "/channels/winning-product", icon: Trophy, label: "Winning Product" },
  { href: "/products", icon: Package, label: "Produkte" },
  { href: "/settings", icon: Settings, label: "Einstellungen" },
];

function MobileNavContent() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    
    const fetchData = async () => {
      const [channelsRes, categoriesRes] = await Promise.all([
        supabase.from("channels").select("*").eq("is_visible", true)
          .not("type", "eq", "winning_product").not("type", "eq", "support").order("order_index"),
        supabase.from("channel_categories").select("*").order("order_index")
      ]);
      
      if (channelsRes.data) setChannels(channelsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    };

    fetchData();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const getChannelIcon = (type: string) => type === "success_stories" ? Star : Hash;

  const uncategorizedChannels = channels.filter(c => !c.category_id);
  const categorizedChannels = categories.map(cat => ({
    category: cat,
    channels: channels.filter(c => c.category_id === cat.id)
  })).filter(g => g.channels.length > 0);

  return (
    <div className="py-4 px-3">
      {/* Main Nav */}
      <div className="space-y-1 mb-6">
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

      {/* Channels */}
      <div className="section-header">Channels</div>
      <div className="space-y-1">
        {categorizedChannels.map(({ category, channels: catChannels }) => {
          const isCollapsed = collapsedCategories.has(category.id);
          return (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <FolderOpen className="w-3 h-3" />
                <span className="uppercase tracking-wider">{category.name}</span>
              </button>
              {!isCollapsed && catChannels.map((channel) => {
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
          );
        })}
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
      </div>

      {/* Theme Switcher */}
      <div className="mt-6 pt-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">Theme</span>
          <div className="flex gap-1">
            {[
              { value: "light", icon: Sun },
              { value: "dark", icon: Moon },
              { value: "system", icon: Monitor },
            ].map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`p-2 rounded-lg transition-colors ${
                  theme === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Panel */}
      <div className="mt-2">
        <UserPanel />
      </div>
    </div>
  );
}
