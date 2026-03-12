"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Slash, ChevronDown, ChevronUp, Loader2, X, HelpCircle, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { SlashCommand } from "@/types/database";

const CATEGORY_ORDER = [
  "Navigation (App)",
  "Navigation (Admin)",
  "User & Nutzer",
  "Tickets",
  "Produkte",
  "Channels",
  "Einstellungen",
  "Lizenzen & Geräte",
  "Inhalte",
  "Support & Hilfe",
  "Info & Logs",
];

export function AdminCommandConsole() {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [value, setValue] = useState("");
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setIsAdmin(false);
        setCommands([]);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle<{ role: string }>();
      const admin = profile?.role === "admin";
      setIsAdmin(admin);
      if (admin) {
        const { data: cmds } = await supabase
          .from("slash_commands")
          .select("*")
          .eq("is_active", true)
          .order("order_index");
        setCommands((cmds || []) as SlashCommand[]);
      } else {
        setCommands([]);
      }
      setLoading(false);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setStatus(null);
    setSelectedIndex(0);
  }, [pathname]);

  const query = value.trim().toLowerCase();
  const qStripped = query.startsWith("/") ? query.slice(1) : query;

  const suggestions = useMemo(() => {
    if (!query) return commands;
    return commands.filter((c) => {
      const trigger = (c.trigger || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      const desc = ((c.description || "") + " " + ((c as any).category || "")).toLowerCase();
      return (
        trigger.includes(qStripped) ||
        trigger.replace("/", "").startsWith(qStripped) ||
        name.includes(qStripped) ||
        desc.includes(qStripped)
      );
    });
  }, [commands, query, qStripped]);

  const groupedSuggestions = useMemo(() => {
    const map = new Map<string, SlashCommand[]>();
    for (const cmd of suggestions) {
      const cat = (cmd as any).category || "Sonstige";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(cmd);
    }
    const result: { category: string; commands: SlashCommand[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = map.get(cat);
      if (list?.length) result.push({ category: cat, commands: list });
    }
    const rest = [...map.entries()].filter(([c]) => !CATEGORY_ORDER.includes(c));
    rest.forEach(([, list]) => result.push({ category: list[0] ? (list[0] as any).category || "Sonstige" : "Sonstige", commands: list }));
    return result;
  }, [suggestions]);

  const flatSuggestions = useMemo(() => groupedSuggestions.flatMap((g) => g.commands), [groupedSuggestions]);
  const showSuggestions = !collapsed && value.length > 0 && flatSuggestions.length > 0;

  const tryNativeCommand = (input: string): boolean => {
    const trimmed = input.trim();
    const userMatch = trimmed.match(/^(?:user|nutzer|nr|nummer)\s+(\d{3,})$/i) || trimmed.match(/^#?(\d{3,})$/);
    if (userMatch) {
      const num = userMatch[1];
      router.push(`/admin/users/number/${num}`);
      setStatus(`Nutzer #${num} wird geöffnet`);
      setValue("");
      return true;
    }
    if (/^\/admin\/users\/number\/\d+$/i.test(trimmed)) {
      const num = trimmed.replace(/\D/g, "");
      if (num) {
        router.push(`/admin/users/number/${num}`);
        setStatus(`Nutzer #${num} wird geöffnet`);
        setValue("");
        return true;
      }
    }
    return false;
  };

  const buildPathWithQuery = (path: string, query?: string) => {
    if (!query?.trim()) return path;
    const params = query
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim().split("=", 2))
      .filter(([k]) => k)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? "")}`)
      .join("&");
    return `${path.replace(/\?.*$/, "")}${params ? `?${params}` : ""}`;
  };

  const execute = async (cmd: SlashCommand) => {
    const val = cmd.action_value as Record<string, unknown>;
    try {
      if (cmd.action_type === "route" && val?.path) {
        const path = buildPathWithQuery(String(val.path), val.query as string | undefined);
        if (val.openInNewTab) {
          window.open(path, "_blank", "noopener,noreferrer");
        } else if (val.replaceHistory) {
          router.replace(path);
        } else {
          router.push(path);
        }
        setStatus(`${cmd.trigger} → ${path}`);
        setValue("");
        return;
      }
      if (cmd.action_type === "url" && val?.url) {
        const url = String(val.url);
        const target = val.openInNewTab !== false ? "_blank" : "_self";
        const rel = [val.noopener !== false && "noopener", val.noreferrer !== false && "noreferrer"].filter(Boolean).join(" ");
        window.open(url, target, rel || undefined);
        setStatus(`${cmd.trigger} → URL geöffnet`);
        setValue("");
        return;
      }
      if (cmd.action_type === "text" && typeof val?.text === "string") {
        if (val.copyToClipboard !== false) await navigator.clipboard.writeText(val.text);
        const msg = (val.successMessage as string) || "In Zwischenablage kopiert.";
        setStatus(`${cmd.trigger} → ${msg}`);
        setValue("");
        return;
      }
      if (cmd.action_type === "modal" && (val?.fallbackPath || val?.modalId)) {
        const fallback = String(val.fallbackPath || "/admin");
        router.push(fallback);
        setStatus(`${cmd.trigger} → ${fallback}`);
        setValue("");
        return;
      }
      setStatus(`${cmd.trigger} → keine Aktion konfiguriert`);
    } catch (e) {
      setStatus(`Fehler: ${cmd.trigger}`);
    }
  };

  const handleSubmit = () => {
    if (tryNativeCommand(value)) return;
    const cmd = flatSuggestions[selectedIndex];
    if (cmd) {
      execute(cmd);
      return;
    }
    if (value.trim().startsWith("/")) {
      const path = value.trim().replace(/^\//, "") || "";
      const fullPath = path.startsWith("/") ? path : `/${path}`;
      router.push(fullPath);
      setStatus(`→ ${fullPath}`);
      setValue("");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[380px] max-w-[calc(100vw-2rem)]">
      <div className="content-card p-3 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Slash className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Admin-Kurzbefehle</p>
              <p className="text-[11px] text-muted-foreground">
                Jede Funktion per Befehl: Navigation, User, Tickets, Einstellungen …
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setShowHelp(!showHelp); setCollapsed(!showHelp ? false : collapsed); }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Hilfe & alle Befehle"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <a
              href="/admin/slash-commands"
              className="p-2 rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Befehle verwalten"
            >
              <Settings className="w-5 h-5" />
            </a>
            <button
              type="button"
              onClick={() => { setCollapsed((c) => !c); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={collapsed ? "Ausklappen" : "Einklappen"}
            >
              {collapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => { setValue(""); setStatus(null); setSelectedIndex(0); inputRef.current?.focus(); }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Eingabe löschen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setSelectedIndex(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && flatSuggestions.length) {
                      e.preventDefault();
                      setSelectedIndex((i) => (i + 1) % flatSuggestions.length);
                    } else if (e.key === "ArrowUp" && flatSuggestions.length) {
                      e.preventDefault();
                      setSelectedIndex((i) => (i - 1 + flatSuggestions.length) % flatSuggestions.length);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    } else if (e.key === "Escape") {
                      setValue("");
                      setSelectedIndex(0);
                      setShowHelp(false);
                    }
                  }}
                  placeholder="Befehl: /admin, user 550, /tickets, Hilfe …"
                  className="input-modern h-12"
                />

                <AnimatePresence>
                  {showSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full left-0 right-0 mb-2 content-card p-2 shadow-xl max-h-[320px] overflow-y-auto z-10"
                    >
                      {groupedSuggestions.map(({ category, commands: list }) => (
                        <div key={category} className="mb-2 last:mb-0">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                            {category}
                          </p>
                          {list.map((cmd, i) => {
                            const idx = flatSuggestions.indexOf(cmd);
                            const isSelected = idx === selectedIndex;
                            return (
                              <button
                                key={cmd.id}
                                type="button"
                                onClick={() => execute(cmd)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left min-h-[40px] text-sm ${
                                  isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                                }`}
                              >
                                <code className="font-medium shrink-0">{cmd.trigger}</code>
                                <span className="text-muted-foreground truncate">{cmd.description || cmd.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                <span>{loading ? "Lade…" : `${commands.length} Befehle`}</span>
                <span>Nutzer: user 550 · Route: /admin/users</span>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>

              <AnimatePresence>
                {showHelp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="content-card p-3 text-xs space-y-2 max-h-[280px] overflow-y-auto"
                  >
                    <p className="font-semibold text-foreground">So nutzt du die Kurzbefehle</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Einfach tippen: <code>/admin</code>, <code>/tickets</code>, <code>/admin/users</code> usw.</li>
                      <li>Nutzer nach Nummer: <code>user 550</code> oder <code>nutzer 550</code> oder <code>#550</code> öffnet Nutzer #550.</li>
                      <li>Pfeil hoch/runter wählt einen Vorschlag, Enter führt aus.</li>
                      <li>Neue Befehle anlegen: oben auf das Zahnrad → Slash-Befehle verwalten.</li>
                      <li>Jede Admin-Funktion (User, Tickets, Produkte, Einstellungen, Logs …) kann als Befehl hinterlegt werden.</li>
                    </ul>
                    <p className="font-semibold text-foreground pt-1">Kategorien</p>
                    <p className="text-muted-foreground">
                      Navigation (App/Admin), User & Nutzer, Tickets, Produkte, Channels, Einstellungen, Lizenzen & Geräte, Inhalte, Support, Info & Logs.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {status && (
                <div className="text-xs text-foreground bg-secondary/50 rounded-xl px-3 py-2">
                  {status}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
