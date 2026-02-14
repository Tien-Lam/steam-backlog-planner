"use client";

import { useMutation } from "@tanstack/react-query";

export function useTestDiscordWebhook() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/discord/test", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to test webhook");
      }
      return res.json();
    },
  });
}
