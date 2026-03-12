"use client";
import { motion } from "framer-motion";
import { Users, MessageSquare, Hash, CheckSquare, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";

interface Props {
  stats: { totalUsers: number; totalChannels: number; totalMessages: number; pendingApprovals: number; };
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } } };

export function AdminDashboard({ stats }: Props) {
  const statCards = [
    { icon: Users, label: "Gesamt User", value: stats.totalUsers, color: "bg-blue-500/10 text-blue-500", href: "/admin/users" },
    { icon: Hash, label: "Channels", value: stats.totalChannels, color: "bg-green-500/10 text-green-500", href: "/admin/channels" },
    { icon: MessageSquare, label: "Nachrichten", value: stats.totalMessages, color: "bg-purple-500/10 text-purple-500" },
    { icon: CheckSquare, label: "Ausstehende Freigaben", value: stats.pendingApprovals, color: "bg-yellow-500/10 text-yellow-500", href: "/admin/approval", highlight: stats.pendingApprovals > 0 },
  ];

  const quickActions = [
    { icon: Users, label: "User verwalten", href: "/admin/users" },
    { icon: Hash, label: "Channel erstellen", href: "/admin/channels" },
    { icon: CheckSquare, label: "Freigaben prüfen", href: "/admin/approval" },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Admin Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Verwalte deine Community</p>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((stat) => (
            <Link key={stat.label} href={stat.href || "#"}>
              <motion.div whileHover={{ scale: 1.02, y: -2 }} className={`glass rounded-xl md:rounded-2xl p-3 md:p-5 hover:shadow-lg transition-shadow h-full ${stat.highlight ? "ring-2 ring-yellow-500/50" : ""}`}>
                <div className="flex flex-col sm:flex-row items-start gap-2 md:gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl ${stat.color} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>

        <motion.div variants={itemVariants}>
          <h2 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">Schnellzugriff</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="glass rounded-xl md:rounded-2xl p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                      <action.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <span className="font-medium text-sm md:text-base text-foreground">{action.label}</span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}