"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, ArrowLeft, Shield, Settings, FolderOpen } from "lucide-react";

const navItems = [
  { href: "/admin/channels", icon: MessageSquare, label: "Channel-Manager" },
  { href: "/admin/categories", icon: FolderOpen, label: "Kategorien" },
  { href: "/admin/settings", icon: Settings, label: "App-Einstellungen" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <motion.aside initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="w-64 glass-sidebar flex flex-col h-screen sticky top-0">
      <div className="h-16 px-5 flex items-center border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-accent-foreground tracking-tight">Admin Panel</h1>
            <p className="text-xs text-sidebar-foreground">Brospify Hub</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <motion.div whileHover={{ x: 4 }} className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"}`}>
                {isActive && <motion.div layoutId="adminActiveNav" className="absolute inset-0 bg-sidebar-accent rounded-xl" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                <item.icon className={`relative z-10 w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                <span className="relative z-10">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border/50">
        <Link href="/dashboard">
          <motion.div whileHover={{ x: 4 }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Zurück zur App</span>
          </motion.div>
        </Link>
      </div>
    </motion.aside>
  );
}