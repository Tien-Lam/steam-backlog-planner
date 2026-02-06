"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

interface PriorityUpdate {
  steamAppId: number;
  priority: number;
}

export function useBatchUpdatePriorities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: PriorityUpdate[]) => {
      if (updates.length === 0) return;

      const res = await fetch("/api/games/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update priorities");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}
