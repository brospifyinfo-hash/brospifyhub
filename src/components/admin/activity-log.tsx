"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, Search, Filter, Calendar, User, Shield, MessageSquare,
  FileText, Settings, AlertTriangle, Check, X, LogIn, LogOut,
  Edit2, Trash2, Plus, Eye, Download, Upload, ChevronDown, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { ActivityLog, User as UserType } from "@/types/database";

const ACTION_ICONS: Record<string, any> = {
  login: LogIn,
  logout: LogOut,
  create: Plus,
  update: Edit2,
  delete: Trash2,
  view: Eye,
  download: Download,
  upload: Upload,
  approve: Check,
  reject: X,
  ban: AlertTriangle,
  unban: Check,
  role_assign: Shield,
  role_remove: Shield,
  message: MessageSquare,
  settings: Settings,
  default: Activity,
};

const ACTION_COLORS: Record<string, string> = {
  login: "text-green-500 bg-green-500/10",
  logout: "text-gray-500 bg-gray-500/10",
  create: "text-blue-500 bg-blue-500/10",
  update: "text-yellow-500 bg-yellow-500/10",
  delete: "text-red-500 bg-red-500/10",
  view: "text-purple-500 bg-purple-500/10",
  approve: "text-green-500 bg-green-500/10",
  reject: "text-red-500 bg-red-500/10",
  ban: "text-red-500 bg-red-500/10",
  unban: "text-green-500 bg-green-500/10",
  role_assign: "text-blue-500 bg-blue-500/10",
  role_remove: "text-orange-500 bg-orange-500/10",
  message: "text-primary bg-primary/10",
  settings: "text-gray-500 bg-gray-500/10",
  default: "text-muted-foreground bg-muted",
};

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Authentifizierung",
  user: "Benutzer",
  channel: "Channel",
  message: "Nachricht",
  role: "Rolle",
  ticket: "Support",
  content: "Inhalt",
  system: "System",
  general: "Allgemein",
};

interface ExtendedActivityLog extends ActivityLog {
  user?: UserType | null;
}

export function ActivityLogViewer() {
  const [logs, setLogs] = useState<ExtendedActivityLog[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    fetchData();
  }, [categoryFilter, dateFilter, userFilter, page]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Fetch users for mapping
    if (users.length === 0) {
      const { data: usersData } = await supabase.from("users").select("*");
      if (usersData) setUsers(usersData);
    }

    // Build query
    let query = supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    // Apply filters
    if (categoryFilter !== "all") {
      query = query.eq("action_category", categoryFilter);
    }

    if (userFilter !== "all") {
      query = query.eq("user_id", userFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: logsData, error } = await query;

    if (error) {
      console.error("Error fetching activity log:", error);
    }

    if (logsData) {
      const logsWithUsers = logsData.map((log) => ({
        ...log,
        user: users.find((u) => u.id === log.user_id) || null,
      }));

      if (page === 0) {
        setLogs(logsWithUsers);
      } else {
        setLogs((prev) => [...prev, ...logsWithUsers]);
      }

      setHasMore(logsData.length === ITEMS_PER_PAGE);
    }

    setLoading(false);
  };

  // Filter logs by search
  const filteredLogs = useMemo(() => {
    if (!search) return logs;

    const searchLower = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.action_type.toLowerCase().includes(searchLower) ||
        log.action_category.toLowerCase().includes(searchLower) ||
        log.user?.display_name?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower)
    );
  }, [logs, search]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;

    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatActionType = (action: string) => {
    const labels: Record<string, string> = {
      login: "Anmeldung",
      logout: "Abmeldung",
      create: "Erstellt",
      update: "Aktualisiert",
      delete: "Gelöscht",
      view: "Angesehen",
      download: "Heruntergeladen",
      upload: "Hochgeladen",
      approve: "Freigegeben",
      reject: "Abgelehnt",
      ban: "Gesperrt",
      unban: "Entsperrt",
      role_assign: "Rolle zugewiesen",
      role_remove: "Rolle entfernt",
      message_send: "Nachricht gesendet",
      message_delete: "Nachricht gelöscht",
      channel_create: "Channel erstellt",
      channel_update: "Channel aktualisiert",
      channel_delete: "Channel gelöscht",
      settings_update: "Einstellungen geändert",
    };

    return labels[action] || action.replace(/_/g, " ");
  };

  const getActionIcon = (action: string) => {
    const baseAction = action.split("_")[0];
    return ACTION_ICONS[baseAction] || ACTION_ICONS.default;
  };

  const getActionColor = (action: string) => {
    const baseAction = action.split("_")[0];
    return ACTION_COLORS[baseAction] || ACTION_COLORS.default;
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Aktivitätsprotokoll</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verfolge alle Aktionen im System
          </p>
        </div>

        <Button onClick={() => { setPage(0); fetchData(); }} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Aktualisieren
        </Button>
      </div>

      {/* Filters */}
      <div className="content-card">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="pl-10 input-modern"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
            className="input-modern"
          >
            <option value="all">Alle Kategorien</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(0); }}
            className="input-modern"
          >
            <option value="all">Alle Zeiträume</option>
            <option value="today">Heute</option>
            <option value="week">Letzte 7 Tage</option>
            <option value="month">Letzter Monat</option>
          </select>

          {/* User Filter */}
          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(0); }}
            className="input-modern"
          >
            <option value="all">Alle Benutzer</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name || user.license_key || "Unbekannt"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="content-card">
          <p className="text-2xl font-bold text-foreground">{filteredLogs.length}</p>
          <p className="text-sm text-muted-foreground">Einträge geladen</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-green-500">
            {filteredLogs.filter((l) => l.action_type.includes("create") || l.action_type.includes("login")).length}
          </p>
          <p className="text-sm text-muted-foreground">Erstellungen/Logins</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-yellow-500">
            {filteredLogs.filter((l) => l.action_type.includes("update")).length}
          </p>
          <p className="text-sm text-muted-foreground">Aktualisierungen</p>
        </div>
        <div className="content-card">
          <p className="text-2xl font-bold text-red-500">
            {filteredLogs.filter((l) => l.action_type.includes("delete") || l.action_type.includes("ban")).length}
          </p>
          <p className="text-sm text-muted-foreground">Löschungen/Sperren</p>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        {loading && page === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="content-card text-center py-12">
            <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Keine Aktivitäten gefunden</p>
          </div>
        ) : (
          <>
            {filteredLogs.map((log, index) => {
              const ActionIcon = getActionIcon(log.action_type);
              const colorClass = getActionColor(log.action_type);

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="content-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Action Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}
                    >
                      <ActionIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {formatActionType(log.action_type)}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                        >
                          {CATEGORY_LABELS[log.action_category] || log.action_category}
                        </span>
                      </div>

                      {/* Details */}
                      {log.details && Object.keys(log.details as object).length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {JSON.stringify(log.details)
                            .replace(/[{}"]/g, "")
                            .replace(/,/g, ", ")
                            .slice(0, 100)}
                        </p>
                      )}

                      {/* Target Info */}
                      {log.target_type && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ziel: {log.target_type}
                          {log.target_id && ` (${log.target_id.slice(0, 8)}...)`}
                        </p>
                      )}
                    </div>

                    {/* User & Time */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {log.user && (
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(log.user.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm hidden sm:block">
                            {log.user.display_name || "Unbekannt"}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Laden...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Mehr laden
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
