"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Preferences {
  weeklyHours: number;
  sessionLengthMinutes: number;
  timezone: string;
}

export function usePreferences() {
  return useQuery<Preferences>({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res = await fetch("/api/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: Partial<Preferences>) => {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}
