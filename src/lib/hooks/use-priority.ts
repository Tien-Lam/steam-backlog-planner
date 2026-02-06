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
      const results = await Promise.all(
        updates.map(({ steamAppId, priority }) =>
          fetch("/api/games", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ steamAppId, priority }),
          })
        )
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(`Failed to update ${failed.length} game(s)`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });
}
