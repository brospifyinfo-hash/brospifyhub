"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Laptop, Smartphone, Monitor, Globe, MapPin, Clock, Ban, Unlock,
  Search, Filter, Trash2, ChevronDown, AlertTriangle, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { UserDevice, User } from "@/types/database";

interface DeviceWithUser extends UserDevice {
  user?: Pick<User, "id" | "display_name" | "license_key">;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<DeviceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_devices")
      .select(`
        *,
        user:users!user_id(id, display_name, license_key)
      `)
      .order("last_active", { ascending: false });

    if (data) setDevices(data as unknown as DeviceWithUser[]);
    setLoading(false);
  };

  const toggleBlock = async (device: DeviceWithUser) => {
    const supabase = createClient();
    const newStatus = !device.is_blocked;
    
    await supabase
      .from("user_devices")
      .update({ is_blocked: newStatus })
      .eq("id", device.id);

    setDevices(devices.map(d => d.id === device.id ? { ...d, is_blocked: newStatus } : d));
  };

  const deleteDevice = async (deviceId: string) => {
    if (!confirm("Gerät wirklich entfernen?")) return;

    const supabase = createClient();
    await supabase.from("user_devices").delete().eq("id", deviceId);
    setDevices(devices.filter(d => d.id !== deviceId));
  };

  const getDeviceIcon = (deviceName: string | null) => {
    if (!deviceName) return Monitor;
    const name = deviceName.toLowerCase();
    if (name.includes("iphone") || name.includes("android phone")) return Smartphone;
    if (name.includes("ipad") || name.includes("android tablet")) return Smartphone;
    return Monitor;
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return "Gerade aktiv";
    if (diffMins < 60) return `Vor ${diffMins} Minuten`;
    if (diffHours < 24) return `Vor ${diffHours} Stunden`;
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString("de-DE");
  };

  const filteredDevices = devices.filter(d => {
    const matchesSearch = 
      d.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.ip_address?.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase()) ||
      d.license_key?.toLowerCase().includes(search.toLowerCase()) ||
      d.user?.display_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = 
      filter === "all" ||
      (filter === "blocked" && d.is_blocked) ||
      (filter === "active" && !d.is_blocked);
    
    return matchesSearch && matchesFilter;
  });

  const groupedByKey = filteredDevices.reduce((acc, device) => {
    const key = device.license_key;
    if (!acc[key]) {
      acc[key] = {
        user: device.user,
        devices: []
      };
    }
    acc[key].devices.push(device);
    return acc;
  }, {} as Record<string, { user?: DeviceWithUser["user"]; devices: DeviceWithUser[] }>);

  const stats = {
    total: devices.length,
    blocked: devices.filter(d => d.is_blocked).length,
    uniqueUsers: Object.keys(groupedByKey).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Laptop className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Geräte-Manager</h1>
            <p className="text-sm text-muted-foreground">
              Übersicht aller eingeloggten Geräte
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="content-card p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Geräte gesamt</p>
        </div>
        <div className="content-card p-4 text-center">
          <p className="text-3xl font-bold text-foreground">{stats.uniqueUsers}</p>
          <p className="text-sm text-muted-foreground">Aktive Keys</p>
        </div>
        <div className="content-card p-4 text-center">
          <p className="text-3xl font-bold text-destructive">{stats.blocked}</p>
          <p className="text-sm text-muted-foreground">Gesperrt</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name, IP, Key, Ort..."
            className="pl-9 input-modern"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="h-10 px-3 rounded-xl bg-secondary border-0"
        >
          <option value="all">Alle Geräte</option>
          <option value="active">Nur aktive</option>
          <option value="blocked">Nur gesperrt</option>
        </select>
      </div>

      {/* Device List by License Key */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : Object.keys(groupedByKey).length === 0 ? (
        <div className="content-card p-8 text-center">
          <Laptop className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Keine Geräte gefunden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByKey).map(([key, { user, devices: keyDevices }]) => {
            const isExpanded = expandedKey === key;
            const blockedCount = keyDevices.filter(d => d.is_blocked).length;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="content-card overflow-hidden"
              >
                {/* Key Header */}
                <button
                  onClick={() => setExpandedKey(isExpanded ? null : key)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {user?.display_name || "Unbekannt"}
                      </p>
                      {blockedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive">
                          {blockedCount} gesperrt
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono truncate">
                      {key}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {keyDevices.length} Gerät{keyDevices.length !== 1 ? "e" : ""}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Devices */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-border"
                    >
                      {keyDevices.map((device) => {
                        const DeviceIcon = getDeviceIcon(device.device_name);
                        
                        return (
                          <div
                            key={device.id}
                            className={`p-4 pl-8 border-b border-border last:border-b-0 ${
                              device.is_blocked ? "bg-destructive/5" : ""
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                device.is_blocked ? "bg-destructive/10" : "bg-secondary"
                              }`}>
                                <DeviceIcon className={`w-5 h-5 ${device.is_blocked ? "text-destructive" : "text-muted-foreground"}`} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-foreground">
                                    {device.device_name || "Unbekanntes Gerät"}
                                  </p>
                                  {device.is_blocked && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive">
                                      <Ban className="w-3 h-3" />
                                      Gesperrt
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {device.ip_address || "Unbekannt"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {device.city}, {device.country}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatLastActive(device.last_active)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={device.is_blocked ? "default" : "outline"}
                                  onClick={() => toggleBlock(device)}
                                  className={device.is_blocked ? "bg-green-600 hover:bg-green-700" : ""}
                                >
                                  {device.is_blocked ? (
                                    <>
                                      <Unlock className="w-4 h-4 mr-1" />
                                      Entsperren
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-4 h-4 mr-1" />
                                      Sperren
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteDevice(device.id)}
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
