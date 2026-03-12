import { createClient } from "@/lib/supabase/client";
import type { UserStats, Achievement } from "@/types/database";

export interface UserStatsData {
  stats: UserStats | null;
  achievements: { achievement: Achievement; earned_at: string }[];
  level: number;
  experienceToNextLevel: number;
  currentLevelProgress: number;
}

// Calculate level from experience (exponential curve)
export function calculateLevel(experience: number): number {
  return Math.floor(Math.sqrt(experience / 100)) + 1;
}

// Calculate experience needed for next level
export function experienceForLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

// Fetch user stats
export async function getUserStats(userId: string): Promise<UserStatsData | null> {
  const supabase = createClient();

  // Fetch or create stats
  let { data: stats, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code === "PGRST116") {
    // Stats don't exist, create them
    const { data: newStats } = await supabase
      .from("user_stats")
      .insert({ user_id: userId })
      .select()
      .single();
    stats = newStats;
  }

  if (!stats) return null;

  // Fetch achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select(`
      earned_at,
      achievement:achievements(*)
    `)
    .eq("user_id", userId);

  const level = calculateLevel(stats.experience_points || 0);
  const currentLevelExp = experienceForLevel(level - 1);
  const nextLevelExp = experienceForLevel(level);
  const currentLevelProgress = nextLevelExp > currentLevelExp
    ? ((stats.experience_points || 0) - currentLevelExp) / (nextLevelExp - currentLevelExp) * 100
    : 0;

  return {
    stats,
    achievements: (userAchievements || []).map((ua: any) => ({
      achievement: ua.achievement,
      earned_at: ua.earned_at,
    })),
    level,
    experienceToNextLevel: nextLevelExp - (stats.experience_points || 0),
    currentLevelProgress,
  };
}

// Update streak on login
export async function updateLoginStreak(userId: string): Promise<void> {
  const supabase = createClient();

  // Get current stats
  let { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!stats) {
    // Create stats if they don't exist
    await supabase.from("user_stats").insert({ user_id: userId });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const lastActive = stats.last_active_date;

  if (lastActive === today) {
    // Already logged in today
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = 1;
  if (lastActive === yesterdayStr) {
    // Consecutive day
    newStreak = (stats.current_streak || 0) + 1;
  }

  const longestStreak = Math.max(stats.longest_streak || 0, newStreak);

  await supabase
    .from("user_stats")
    .update({
      last_active_date: today,
      current_streak: newStreak,
      longest_streak: longestStreak,
      total_login_days: (stats.total_login_days || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Check streak achievements
  await checkAndGrantAchievements(userId);
}

// Grant experience points
export async function grantExperience(userId: string, amount: number): Promise<void> {
  const supabase = createClient();

  const { data: stats } = await supabase
    .from("user_stats")
    .select("experience_points, level")
    .eq("user_id", userId)
    .single();

  if (!stats) return;

  const newExp = (stats.experience_points || 0) + amount;
  const newLevel = calculateLevel(newExp);

  await supabase
    .from("user_stats")
    .update({
      experience_points: newExp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// Check and grant achievements
export async function checkAndGrantAchievements(userId: string): Promise<string[]> {
  const supabase = createClient();
  const grantedAchievements: string[] = [];

  // Get user stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!stats) return [];

  // Get all achievements
  const { data: achievements } = await supabase
    .from("achievements")
    .select("*");

  if (!achievements) return [];

  // Get user's existing achievements
  const { data: existingAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const existingIds = new Set((existingAchievements || []).map((a) => a.achievement_id));

  for (const achievement of achievements) {
    if (existingIds.has(achievement.id)) continue;

    const requirements = achievement.requirements as Record<string, any> || {};
    let earned = false;

    // Check message achievements
    if (requirements.messages && stats.total_messages >= requirements.messages) {
      earned = true;
    }

    // Check streak achievements
    if (requirements.streak && stats.current_streak >= requirements.streak) {
      earned = true;
    }

    // Check login achievements
    if (requirements.login_days && stats.total_login_days >= requirements.login_days) {
      earned = true;
    }

    // Check level achievements
    if (requirements.level && stats.level >= requirements.level) {
      earned = true;
    }

    if (earned) {
      await supabase
        .from("user_achievements")
        .insert({ user_id: userId, achievement_id: achievement.id });
      grantedAchievements.push(achievement.name);
    }
  }

  return grantedAchievements;
}

// Increment a stat
export async function incrementStat(
  userId: string,
  statType: "messages" | "reactions_given" | "reactions_received" | "files_uploaded"
): Promise<void> {
  const supabase = createClient();

  const columnMap: Record<string, string> = {
    messages: "total_messages",
    reactions_given: "total_reactions_given",
    reactions_received: "total_reactions_received",
    files_uploaded: "total_files_uploaded",
  };

  const column = columnMap[statType];
  if (!column) return;

  // Get current value
  const { data: stats } = await supabase
    .from("user_stats")
    .select(column)
    .eq("user_id", userId)
    .single();

  const currentValue = stats ? (stats as any)[column] || 0 : 0;

  await supabase
    .from("user_stats")
    .upsert({
      user_id: userId,
      [column]: currentValue + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  // Grant experience for the action
  const expRewards: Record<string, number> = {
    messages: 5,
    reactions_given: 1,
    reactions_received: 2,
    files_uploaded: 10,
  };

  await grantExperience(userId, expRewards[statType] || 1);

  // Check achievements
  await checkAndGrantAchievements(userId);
}
