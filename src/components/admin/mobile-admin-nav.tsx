"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Shield, ArrowLeft, Users, MessageSquare, Calendar, Smile, CheckSquare, LayoutDashboard, Key, Ticket, Tag, Settings, FolderOpen, Laptop, Crown, UserCog, Activity, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Übersicht" },
  { href: "/admin/tickets", icon: Ticket, label: "Support-Tickets" },
  { href: "/admin/ticket-categories", icon: Tag, label: "Ticket-Kategorien" },
  { href: "/admin/licenses", icon: Key, label: "Lizenz-Management" },
  { href: "/admin/products", icon: Package, label: "Produkt-Manager" },
  { href: "/admin/roles", icon: Crown, label: "Rollen-Manager" },
  { href: "/admin/user-roles", icon: UserCog, label: "Benutzer & Rollen" },
  { href: "/admin/users", icon: Users, label: "User-Zentrale" },
  { href: "/admin/devices", icon: Laptop, label: "Geräte-Manager" },
  { href: "/admin/channels", icon: MessageSquare, label: "Channel-Manager" },
  { href: "/admin/categories", icon: FolderOpen, label: "Kategorien" },
  { href: "/admin/approval", icon: CheckSquare, label: "Freigaben" },
  { href: "/admin/scheduler", icon: Calendar, label: "Scheduler" },
  { href: "/admin/activity", icon: Activity, label: "Aktivitätslog" },
  { href: "/admin/settings", icon: Settings, label: "App-Einstellungen" },
  { href: "/admin/emojis", icon: Smile, label: "Emojis" },
];

export function MobileAdminNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

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
          <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/25">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sidebar-accent-foreground">Admin Panel</span>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed top-14 left-0 bottom-0 w-[280px] z-50 bg-sidebar border-r border-sidebar-border overflow-y-auto"
            >
              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={`flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                          : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                      }`}>
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
              
              <div className="p-3 border-t border-sidebar-border/50">
                <Link href="/dashboard">
                  <div className="flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-sm font-medium text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Zurück zur App</span>
                  </div>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
