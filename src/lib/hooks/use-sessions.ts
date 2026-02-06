"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SessionGame {
  name: string;
  headerImageUrl: string | null;
}

export interface Session {
  id: string;
  userId: string;
  steamAppId: number;
  startTime: string;
  endTime: string;
  completed: boolean;
  notes: string | null;
  createdAt: string;
  game: SessionGame | null;
}

export function useSessions(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  return useQuery<Session[]>({
    queryKey: ["sessions", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/sessions${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      steamAppId: number;
      startTime: string;
      endTime: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create session");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      ...data
    }: {
      sessionId: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
      completed?: boolean;
    }) => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update session");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete session");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useAutoGenerateSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      startDate: string;
      weeks: number;
      clearExisting?: boolean;
    }) => {
      const res = await fetch("/api/sessions/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate sessions");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
