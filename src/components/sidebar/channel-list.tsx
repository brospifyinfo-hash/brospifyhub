"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Headphones, Trophy, ChevronDown, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient, apiFetch } from "@/lib/supabase/client";
import type { Channel, ChannelType } from "@/types/database";

const channelIcons: Record<ChannelType, React.ReactNode> = {
  standard: <Hash className="w-4 h-4" />,
  support: <Headphones className="w-4 h-4" />,
  winning_product: <Trophy className="w-4 h-4" />,
  success_stories: <Star className="w-4 h-4" />,
};

const channelCategories: Record<ChannelType, string> = {
  standard: "Channels",
  support: "Support",
  winning_product: "Winning Products",
  success_stories: "Success Stories",
};

interface ChannelGroup {
  type: ChannelType;
  label: string;
  channels: Channel[];
}

export function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["standard", "support", "winning_product", "success_stories"])
  );
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    const fetchChannels = async () => {
      try {
        const res = await apiFetch("/api/channels");
        const json = await res.json();
        if (res.ok && Array.isArray(json.channels)) {
          setChannels(json.channels);
          setLoading(false);
          return;
        }
      } catch {
        // API fehlgeschlagen, Fallback auf direkten Supabase-Abruf
      }

      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: true })
        .returns<Channel[]>();

      if (!error && data) {
        setChannels(data);
      }
      setLoading(false);
    };

    fetchChannels();

    const channel = supabase
      .channel("channels")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels" },
        () => fetchChannels()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const groupedChannels: ChannelGroup[] = (
    ["standard", "support", "winning_product", "success_stories"] as ChannelType[]
  ).map((type) => ({
    type,
    label: channelCategories[type],
    channels: channels.filter((c) => c.type === type),
  }));

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="h-10 bg-sidebar-accent/30 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-3 py-4">
      {groupedChannels.map((group, groupIndex) => (
        <motion.div
          key={group.type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIndex * 0.1 }}
          className="mb-5"
        >
          <button
            onClick={() => toggleGroup(group.type)}
            className="flex items-center gap-1.5 px-2 py-1.5 w-full text-xs font-semibold uppercase tracking-wider text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            <motion.div
              animate={{ rotate: expandedGroups.has(group.type) ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-3 h-3" />
            </motion.div>
            {group.label}
          </button>

          <AnimatePresence>
            {expandedGroups.has(group.type) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-0.5">
                  {group.channels.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-sidebar-foreground/50">
                      Keine Channels
                    </p>
                  ) : (
                    group.channels.map((channel, index) => {
                      const isActive = pathname === `/channels/${channel.id}`;
                      return (
                        <motion.div
                          key={channel.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <Link
                            href={`/channels/${channel.id}`}
                            className={cn(
                              "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                              isActive
                                ? "text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeChannel"
                                className="absolute inset-0 bg-sidebar-accent rounded-xl"
                                transition={{
                                  type: "spring",
                                  bounce: 0.15,
                                  duration: 0.5,
                                }}
                              />
                            )}
                            <span
                              className={cn(
                                "relative z-10 transition-colors",
                                isActive
                                  ? "text-primary"
                                  : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
                              )}
                            >
                              {channelIcons[channel.type]}
                            </span>
                            <span className="relative z-10 truncate">
                              {channel.name}
                            </span>
                          </Link>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </ScrollArea>
  );
}
