"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hash, Headphones, Trophy, Users, Bell, Pin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Channel, ChannelType } from "@/types/database";

const channelIcons: Record<ChannelType, React.ReactNode> = {
  standard: <Hash className="w-5 h-5" />,
  support: <Headphones className="w-5 h-5" />,
  winning_product: <Trophy className="w-5 h-5" />,
  success_stories: <Star className="w-5 h-5" />,
};

const channelDescriptions: Record<ChannelType, string> = {
  standard: "Allgemeine Diskussionen",
  support: "Hilfe und Support",
  winning_product: "Entdecke Top-Produkte",
  success_stories: "Erfolgsgeschichten der Community",
};

interface ChannelHeaderProps {
  channelId: string;
}

export function ChannelHeader({ channelId }: ChannelHeaderProps) {
  const [channel, setChannel] = useState<Channel | null>(null);

  useEffect(() => {
    const fetchChannel = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single<Channel>();

      if (data) {
        setChannel(data);
      }
    };

    fetchChannel();
  }, [channelId]);

  if (!channel) {
    return (
      <header className="h-14 md:h-16 px-3 md:px-6 flex items-center border-b border-border/50 glass">
        <div className="h-5 w-32 md:w-40 bg-muted/50 animate-pulse rounded-lg" />
      </header>
    );
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-14 md:h-16 px-3 md:px-6 flex items-center border-b border-border/50 glass shrink-0"
    >
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="text-primary flex-shrink-0"
        >
          {channelIcons[channel.type]}
        </motion.div>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground text-sm md:text-base truncate">{channel.name}</h2>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate hidden sm:block">
            {channelDescriptions[channel.type]}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5 md:gap-1">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 md:p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-accent rounded-xl transition-colors"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 md:p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-accent rounded-xl transition-colors hidden sm:flex"
        >
          <Pin className="w-4 h-4 text-muted-foreground" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 md:p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-accent rounded-xl transition-colors hidden sm:flex"
        >
          <Users className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      </div>
    </motion.header>
  );
}
