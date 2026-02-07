"use client";

import { useQuery } from "@tanstack/react-query";
import { useLibrary, type LibraryGame } from "./use-library";

const STATUS_COLORS: Record<string, string> = {
  backlog: "hsl(var(--chart-1))",
  playing: "hsl(var(--chart-2))",
  completed: "hsl(var(--chart-3))",
  abandoned: "hsl(var(--chart-4))",
};

export interface StatusBreakdown {
  status: string;
  count: number;
  fill: string;
}

export interface PlaytimeEntry {
  name: string;
  hours: number;
  steamAppId: number;
}

export interface CompletionPrediction {
  steamAppId: number;
  name: string;
  hltbMinutes: number;
  playedMinutes: number;
  remainingMinutes: number;
}

export interface LibraryStats {
  statusBreakdown: StatusBreakdown[];
  topGamesByPlaytime: PlaytimeEntry[];
  completionPredictions: CompletionPrediction[];
  totalRemainingMinutes: number;
}

export function computeLibraryStats(games: LibraryGame[]): LibraryStats {
  const statusCounts: Record<string, number> = {};
  for (const g of games) {
    statusCounts[g.status] = (statusCounts[g.status] ?? 0) + 1;
  }
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    fill: STATUS_COLORS[status] ?? "hsl(var(--chart-1))",
  }));

  const topGamesByPlaytime = [...games]
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, 10)
    .filter((g) => g.playtimeMinutes > 0)
    .map((g) => ({
      name: g.cache?.name ?? `Game ${g.steamAppId}`,
      hours: Math.round((g.playtimeMinutes / 60) * 10) / 10,
      steamAppId: g.steamAppId,
    }));

  const completionPredictions = games
    .filter(
      (g) =>
        (g.status === "backlog" || g.status === "playing") &&
        g.cache?.hltbMainMinutes != null &&
        g.cache.hltbMainMinutes > 0
    )
    .map((g) => {
      const hltbMinutes = g.cache!.hltbMainMinutes!;
      const played = g.playtimeMinutes;
      const remaining = Math.max(0, hltbMinutes - played);
      return {
        steamAppId: g.steamAppId,
        name: g.cache?.name ?? `Game ${g.steamAppId}`,
        hltbMinutes,
        playedMinutes: played,
        remainingMinutes: remaining,
      };
    })
    .sort((a, b) => a.remainingMinutes - b.remainingMinutes);

  const totalRemainingMinutes = completionPredictions.reduce(
    (sum, p) => sum + p.remainingMinutes,
    0
  );

  return { statusBreakdown, topGamesByPlaytime, completionPredictions, totalRemainingMinutes };
}

export function useLibraryStats() {
  const { data: games, isLoading, error } = useLibrary();
  const stats = games ? computeLibraryStats(games) : null;
  return { stats, isLoading, error };
}

export interface AchievementStats {
  overallAchievements: {
    achieved: number;
    total: number;
    percentage: number;
  };
  perGame: {
    steamAppId: number;
    gameName: string;
    achieved: number;
    total: number;
    percentage: number;
  }[];
}

export function useAchievementStats() {
  return useQuery<AchievementStats>({
    queryKey: ["statistics"],
    queryFn: async () => {
      const res = await fetch("/api/statistics");
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json();
    },
  });
}
