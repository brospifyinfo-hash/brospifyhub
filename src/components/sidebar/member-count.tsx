"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users } from "lucide-react";

export function MemberCount() {
  const [count, setCount] = useState<number | null>(null);
  const [bonus, setBonus] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();
    const t = setTimeout(() => {
      fetchData();
    }, 300);
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: userCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      if (userCount !== null) {
        setCount(userCount);
      }

      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "fake_member_bonus")
        .single();

      if (settingsData?.value) {
        setBonus(parseInt(settingsData.value) || 0);
      }
    }

    const channel = supabase
      .channel("member-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, fetchData);

    channel.subscribe();

    return () => {
      clearTimeout(t);
      channel.unsubscribe();
    };
  }, []);

  const displayCount = (count ?? 0) + bonus;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Users className="w-3 h-3" />
      <span>{count === null ? "…" : displayCount.toLocaleString()} Members</span>
    </div>
  );
}
