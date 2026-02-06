import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSearch = vi.fn();
const mockCachedFetch = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock("howlongtobeat", () => ({
  HowLongToBeatService: class {
    search(...args: unknown[]) {
      return mockSearch(...args);
    }
  },
}));

vi.mock("@/lib/services/cache", () => ({
  cachedFetch: (...args: unknown[]) => mockCachedFetch(...args),
}));

vi.mock("@/lib/db", () => {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: (...args: unknown[]) => mockDbUpdateWhere(...args),
  };
  return {
    db: { update: () => updateChain },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { getHLTBData } from "../hltb";

beforeEach(() => {
  mockSearch.mockReset();
  mockCachedFetch.mockReset();
  mockDbUpdateWhere.mockReset();
});

describe("getHLTBData", () => {
  it("returns HLTB data with hours converted to minutes", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockSearch.mockResolvedValue([
      { gameplayMain: 10, gameplayMainExtra: 20, gameplayCompletionist: 40 },
    ]);
    mockDbUpdateWhere.mockResolvedValue(undefined);

    const result = await getHLTBData("Half-Life 2", 220);
    expect(result).toEqual({
      mainMinutes: 600,
      extraMinutes: 1200,
      completionistMinutes: 2400,
    });
  });

  it("returns null when no search results", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockSearch.mockResolvedValue([]);

    const result = await getHLTBData("Unknown Game", 99999);
    expect(result).toBeNull();
  });

  it("uses HLTB_DATA cache category with appId", async () => {
    mockCachedFetch.mockResolvedValue(null);
    await getHLTBData("TF2", 440);
    expect(mockCachedFetch).toHaveBeenCalledWith("HLTB_DATA", [440], expect.any(Function));
  });

  it("handles zero gameplay values as null", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockSearch.mockResolvedValue([
      { gameplayMain: 0, gameplayMainExtra: 0, gameplayCompletionist: 0 },
    ]);
    mockDbUpdateWhere.mockResolvedValue(undefined);

    const result = await getHLTBData("Multiplayer Game", 730);
    expect(result).toEqual({
      mainMinutes: null,
      extraMinutes: null,
      completionistMinutes: null,
    });
  });

  it("persists data to game_cache table", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockSearch.mockResolvedValue([
      { gameplayMain: 5, gameplayMainExtra: 10, gameplayCompletionist: 15 },
    ]);
    mockDbUpdateWhere.mockResolvedValue(undefined);

    await getHLTBData("Portal", 400);
    expect(mockDbUpdateWhere).toHaveBeenCalled();
  });

  it("returns null on error", async () => {
    mockCachedFetch.mockRejectedValue(new Error("Network error"));

    const result = await getHLTBData("Error Game", 1);
    expect(result).toBeNull();
  });
});
