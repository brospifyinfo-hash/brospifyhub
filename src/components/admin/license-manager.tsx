"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Key, Upload, Check, X, Search, Trash2, Copy, CheckCircle, XCircle, 
  Ban, Power, PowerOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { InternalKey } from "@/types/database";

interface Props { 
  keys: InternalKey[]; 
}

export function LicenseManager({ keys: initial }: Props) {
  const [keys, setKeys] = useState(initial);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "free" | "assigned" | "inactive">("all");

  const filteredKeys = keys.filter(k => {
    const matchesSearch = k.key_value.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    switch (filter) {
      case "free": return !k.is_assigned && k.is_active;
      case "assigned": return k.is_assigned && k.is_active;
      case "inactive": return !k.is_active;
      default: return true;
    }
  });

  const freeKeys = keys.filter(k => !k.is_assigned && k.is_active);
  const assignedKeys = keys.filter(k => k.is_assigned && k.is_active);
  const inactiveKeys = keys.filter(k => !k.is_active);

  const importKeys = async () => {
    const lines = importText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setImporting(true);
    const supabase = createClient();
    let added = 0;
    let skipped = 0;

    for (const keyValue of lines) {
      const { error } = await supabase.from("internal_keys").insert({ key_value: keyValue, is_active: true });
      if (error) {
        skipped++;
      } else {
        added++;
      }
    }

    const { data } = await supabase.from("internal_keys").select("*").order("created_at", { ascending: false }).returns<InternalKey[]>();
    if (data) setKeys(data);

    setImportResult({ added, skipped });
    setImporting(false);
    setImportText("");
    setTimeout(() => {
      setImportResult(null);
      setShowImport(false);
    }, 3000);
  };

  const toggleKeyStatus = async (key: InternalKey) => {
    const supabase = createClient();
    const newStatus = !key.is_active;
    
    const { error } = await supabase
      .from("internal_keys")
      .update({ is_active: newStatus })
      .eq("id", key.id);
    
    if (!error) {
      setKeys(keys.map(k => k.id === key.id ? { ...k, is_active: newStatus } : k));
    }
  };

  const deleteKey = async (id: string) => {
    const key = keys.find(k => k.id === id);
    if (key?.is_assigned) {
      if (!confirm("Dieser Key ist vergeben. Trotzdem löschen?")) return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("internal_keys").delete().eq("id", id);
    if (!error) setKeys(keys.filter(k => k.id !== id));
  };

  const copyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    setCopied(keyValue);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("de-DE", { 
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lizenz-Management</h1>
            <p className="text-muted-foreground">
              {freeKeys.length} frei • {assignedKeys.length} vergeben • {inactiveKeys.length} deaktiviert
            </p>
          </div>
          <Button onClick={() => setShowImport(!showImport)} className="btn-primary">
            <Upload className="w-4 h-4 mr-2" />Keys importieren
          </Button>
        </div>

        {/* Import Section */}
        <AnimatePresence>
          {showImport && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: "auto" }} 
              exit={{ opacity: 0, height: 0 }} 
              className="overflow-hidden"
            >
              <div className="content-card space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Keys importieren (einer pro Zeile)
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={"KEY-001-ABC\nKEY-002-DEF\nKEY-003-GHI"}
                    className="w-full h-40 p-4 input-modern resize-none font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {importText.split("\n").filter(l => l.trim()).length} Keys erkannt
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setShowImport(false); setImportText(""); }}>
                      Abbrechen
                    </Button>
                    <Button onClick={importKeys} disabled={importing || !importText.trim()} className="btn-primary">
                      {importing ? "Importiere..." : "Importieren"}
                    </Button>
                  </div>
                </div>
                {importResult && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 text-green-500"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">
                      {importResult.added} Keys hinzugefügt, {importResult.skipped} übersprungen
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter("all")}
            className={`content-card cursor-pointer transition-all ${filter === "all" ? "ring-2 ring-primary" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-bold text-foreground">{keys.length}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter("free")}
            className={`content-card cursor-pointer transition-all ${filter === "free" ? "ring-2 ring-green-500" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frei</p>
                <p className="text-2xl font-bold text-foreground">{freeKeys.length}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter("assigned")}
            className={`content-card cursor-pointer transition-all ${filter === "assigned" ? "ring-2 ring-amber-500" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <X className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vergeben</p>
                <p className="text-2xl font-bold text-foreground">{assignedKeys.length}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter("inactive")}
            className={`content-card cursor-pointer transition-all ${filter === "inactive" ? "ring-2 ring-red-500" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Ban className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deaktiviert</p>
                <p className="text-2xl font-bold text-foreground">{inactiveKeys.length}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Key suchen..." 
            className="pl-12 h-12 input-modern" 
          />
        </div>

        {/* Keys List */}
        <div className="content-card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Key</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Erstellt</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Vergeben am</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {search ? "Keine Keys gefunden" : "Noch keine Keys importiert"}
                  </td>
                </tr>
              ) : (
                filteredKeys.map((key) => (
                  <motion.tr 
                    key={key.id} 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors ${!key.is_active ? "opacity-60" : ""}`}
                  >
                    <td className="p-4">
                      <code className="text-sm font-mono text-foreground">{key.key_value}</code>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {!key.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-500">
                            <Ban className="w-3 h-3" />Deaktiviert
                          </span>
                        ) : key.is_assigned ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">
                            <XCircle className="w-3 h-3" />Vergeben
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-500">
                            <CheckCircle className="w-3 h-3" />Frei
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{formatDate(key.created_at)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{key.assigned_at ? formatDate(key.assigned_at) : "—"}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <motion.button 
                          whileHover={{ scale: 1.1 }} 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => copyKey(key.key_value)} 
                          className="p-2 rounded-lg hover:bg-secondary" 
                          title="Kopieren"
                        >
                          {copied === key.key_value ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </motion.button>
                        
                        <motion.button 
                          whileHover={{ scale: 1.1 }} 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => toggleKeyStatus(key)} 
                          className={`p-2 rounded-lg ${key.is_active ? "hover:bg-red-500/10" : "hover:bg-green-500/10"}`}
                          title={key.is_active ? "Deaktivieren" : "Aktivieren"}
                        >
                          {key.is_active ? (
                            <PowerOff className="w-4 h-4 text-red-500" />
                          ) : (
                            <Power className="w-4 h-4 text-green-500" />
                          )}
                        </motion.button>
                        
                        <motion.button 
                          whileHover={{ scale: 1.1 }} 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => deleteKey(key.id)} 
                          className="p-2 rounded-lg hover:bg-destructive/10" 
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
