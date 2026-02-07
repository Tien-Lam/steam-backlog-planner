import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { computeLibraryStats } from "../use-statistics";
import type { LibraryGame } from "../use-library";

function makeGame(overrides: Partial<LibraryGame> = {}): LibraryGame {
  return {
    userId: "user-1",
    steamAppId: 440,
    status: "backlog",
    priority: 0,
    playtimeMinutes: 120,
    lastPlayed: null,
    addedAt: "2025-01-01",
    updatedAt: "2025-01-01",
    cache: {
      steamAppId: 440,
      name: "TF2",
      headerImageUrl: null,
      hltbMainMinutes: 600,
      hltbExtraMinutes: null,
      hltbCompletionistMinutes: null,
      totalAchievements: null,
    },
    ...overrides,
  };
}

describe("computeLibraryStats", () => {
  it("returns empty stats for empty games array", () => {
    const stats = computeLibraryStats([]);
    expect(stats.statusBreakdown).toEqual([]);
    expect(stats.topGamesByPlaytime).toEqual([]);
    expect(stats.completionPredictions).toEqual([]);
    expect(stats.totalRemainingMinutes).toBe(0);
  });

  it("computes status breakdown correctly", () => {
    const games = [
      makeGame({ steamAppId: 1, status: "backlog" }),
      makeGame({ steamAppId: 2, status: "backlog" }),
      makeGame({ steamAppId: 3, status: "playing" }),
      makeGame({ steamAppId: 4, status: "completed" }),
    ];
    const stats = computeLibraryStats(games);
    const backlog = stats.statusBreakdown.find((s) => s.status === "backlog");
    const playing = stats.statusBreakdown.find((s) => s.status === "playing");
    const completed = stats.statusBreakdown.find((s) => s.status === "completed");
    expect(backlog?.count).toBe(2);
    expect(playing?.count).toBe(1);
    expect(completed?.count).toBe(1);
  });

  it("assigns chart colors to each status", () => {
    const games = [makeGame({ status: "backlog" })];
    const stats = computeLibraryStats(games);
    expect(stats.statusBreakdown[0].fill).toContain("hsl");
  });

  it("returns top 10 games sorted by playtime descending", () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      makeGame({
        steamAppId: i + 1,
        playtimeMinutes: (i + 1) * 60,
        cache: {
          steamAppId: i + 1,
          name: `Game ${i + 1}`,
          headerImageUrl: null,
          hltbMainMinutes: null,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      })
    );
    const stats = computeLibraryStats(games);
    expect(stats.topGamesByPlaytime).toHaveLength(10);
    expect(stats.topGamesByPlaytime[0].hours).toBe(12);
    expect(stats.topGamesByPlaytime[0].name).toBe("Game 12");
  });

  it("excludes games with 0 playtime from top games", () => {
    const games = [makeGame({ playtimeMinutes: 0 })];
    const stats = computeLibraryStats(games);
    expect(stats.topGamesByPlaytime).toHaveLength(0);
  });

  it("computes completion predictions for backlog/playing games with HLTB data", () => {
    const games = [
      makeGame({
        steamAppId: 1,
        status: "backlog",
        playtimeMinutes: 120,
        cache: {
          steamAppId: 1,
          name: "Game A",
          headerImageUrl: null,
          hltbMainMinutes: 600,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
      makeGame({
        steamAppId: 2,
        status: "completed",
        playtimeMinutes: 300,
        cache: {
          steamAppId: 2,
          name: "Game B",
          headerImageUrl: null,
          hltbMainMinutes: 300,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
    ];
    const stats = computeLibraryStats(games);
    expect(stats.completionPredictions).toHaveLength(1);
    expect(stats.completionPredictions[0].remainingMinutes).toBe(480);
  });

  it("clamps remaining time to 0 when playtime exceeds HLTB", () => {
    const games = [
      makeGame({
        playtimeMinutes: 700,
        cache: {
          steamAppId: 440,
          name: "TF2",
          headerImageUrl: null,
          hltbMainMinutes: 600,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
    ];
    const stats = computeLibraryStats(games);
    expect(stats.completionPredictions[0].remainingMinutes).toBe(0);
  });

  it("sums total remaining minutes", () => {
    const games = [
      makeGame({
        steamAppId: 1,
        status: "backlog",
        playtimeMinutes: 0,
        cache: {
          steamAppId: 1,
          name: "A",
          headerImageUrl: null,
          hltbMainMinutes: 300,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
      makeGame({
        steamAppId: 2,
        status: "playing",
        playtimeMinutes: 100,
        cache: {
          steamAppId: 2,
          name: "B",
          headerImageUrl: null,
          hltbMainMinutes: 500,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
    ];
    const stats = computeLibraryStats(games);
    expect(stats.totalRemainingMinutes).toBe(700);
  });

  it("excludes games without HLTB data from predictions", () => {
    const games = [
      makeGame({
        cache: {
          steamAppId: 440,
          name: "TF2",
          headerImageUrl: null,
          hltbMainMinutes: null,
          hltbExtraMinutes: null,
          hltbCompletionistMinutes: null,
          totalAchievements: null,
        },
      }),
    ];
    const stats = computeLibraryStats(games);
    expect(stats.completionPredictions).toHaveLength(0);
  });

  it("uses fallback name when cache is null", () => {
    const games = [
      makeGame({ steamAppId: 999, cache: null, playtimeMinutes: 60 }),
    ];
    const stats = computeLibraryStats(games);
    expect(stats.topGamesByPlaytime[0].name).toBe("Game 999");
  });
});

// Hook tests
const mockUseLibrary = vi.fn();
const mockFetch = vi.fn();

vi.mock("../use-library", () => ({
  useLibrary: () => mockUseLibrary(),
}));

vi.stubGlobal("fetch", mockFetch);

import { useLibraryStats, useAchievementStats } from "../use-statistics";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("useLibraryStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null stats when library is loading", () => {
    mockUseLibrary.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { result } = renderHook(() => useLibraryStats(), { wrapper });
    expect(result.current.stats).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("computes stats from library data", () => {
    mockUseLibrary.mockReturnValue({
      data: [makeGame()],
      isLoading: false,
      error: null,
    });
    const { result } = renderHook(() => useLibraryStats(), { wrapper });
    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats!.statusBreakdown).toHaveLength(1);
  });
});

describe("useAchievementStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches achievement statistics", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          overallAchievements: { achieved: 10, total: 20, percentage: 50 },
          perGame: [],
        }),
    });

    const { result } = renderHook(() => useAchievementStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.overallAchievements.percentage).toBe(50);
  });
});
