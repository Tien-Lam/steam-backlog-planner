"use client";

import { useQuery } from "@tanstack/react-query";
import type { HLTBData } from "@/lib/services/hltb";

export interface AchievementData {
  achievedCount: number;
  totalCount: number;
  achievements: {
    apiname: string;
    achieved: number;
    unlocktime: number;
    name?: string;
    description?: string;
    icon?: string;
    icongray?: string;
  }[];
}

export function useGameAchievements(appId: number) {
  return useQuery<AchievementData | null>({
    queryKey: ["achievements", appId],
    queryFn: async () => {
      const res = await fetch(`/api/steam/achievements/${appId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !isNaN(appId),
  });
}

export function useHLTBData(appId: number) {
  return useQuery<HLTBData | null>({
    queryKey: ["hltb", appId],
    queryFn: async () => {
      const res = await fetch(`/api/hltb/${appId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !isNaN(appId),
  });
}
