"use client";

import { motion } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="px-4 py-3">
        <div className="h-10 bg-secondary/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  const themes = [
    { id: "light", icon: Sun, label: "Hell" },
    { id: "dark", icon: Moon, label: "Dunkel" },
    { id: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className="px-4 py-3">
      <div className="flex items-center bg-secondary/50 rounded-xl p-1">
        {themes.map(({ id, icon: Icon, label }) => (
          <motion.button
            key={id}
            onClick={() => setTheme(id)}
            whileTap={{ scale: 0.95 }}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium
              transition-colors duration-200
              ${theme === id 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
