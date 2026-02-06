"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { GameStatus } from "@/lib/db/schema";

export interface LibraryGame {
  userId: string;
  steamAppId: number;
  status: GameStatus;
  priority: number;
  playtimeMinutes: number;
  lastPlayed: string | null;
  addedAt: string;
  updatedAt: string;
  cache: {
    steamAppId: number;
    name: string;
    headerImageUrl: string | null;
    hltbMainMinutes: number | null;
    hltbExtraMinutes: number | null;
    hltbCompletionistMinutes: number | null;
    totalAchievements: number | null;
  } | null;
}

export function useLibrary() {
  return useQuery<LibraryGame[]>({
    queryKey: ["library"],
    queryFn: async () => {
      const res = await fetch("/api/steam/library");
      if (!res.ok) throw new Error("Failed to fetch library");
      return res.json();
    },
  });
}

export function useUpdateGameStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      steamAppId,
      status,
    }: {
      steamAppId: number;
      status: GameStatus;
    }) => {
      const res = await fetch("/api/games", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamAppId, status }),
      });
      if (!res.ok) throw new Error("Failed to update game status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}
