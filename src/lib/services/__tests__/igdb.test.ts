import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindGameBySteamAppId = vi.fn();
const mockGetGameDetails = vi.fn();
const mockCachedFetch = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock("@/lib/services/igdb-client", () => ({
  findGameBySteamAppId: (...args: unknown[]) => mockFindGameBySteamAppId(...args),
  getGameDetails: (...args: unknown[]) => mockGetGameDetails(...args),
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

import { getIGDBData } from "../igdb";

beforeEach(() => {
  mockFindGameBySteamAppId.mockReset();
  mockGetGameDetails.mockReset();
  mockCachedFetch.mockReset();
  mockDbUpdateWhere.mockReset();
});

describe("getIGDBData", () => {
  it("returns IGDB data with mapped fields", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(1942);
    mockGetGameDetails.mockResolvedValue({
      id: 1942,
      genres: [{ name: "Shooter" }, { name: "Action" }],
      aggregated_rating: 92.7,
      summary: "A great game about shooting.",
      cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/co1234.jpg" },
      first_release_date: 1256688000,
    });
    mockDbUpdateWhere.mockResolvedValue(undefined);

    const result = await getIGDBData(440);
    expect(result).toEqual({
      igdbId: 1942,
      genres: ["Shooter", "Action"],
      rating: 93,
      summary: "A great game about shooting.",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg",
      releaseDate: expect.any(String),
    });
  });

  it("returns null when Steam app not found in IGDB", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(null);

    const result = await getIGDBData(99999);
    expect(result).toBeNull();
  });

  it("returns null when IGDB game details not found", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(1942);
    mockGetGameDetails.mockResolvedValue(null);

    const result = await getIGDBData(440);
    expect(result).toBeNull();
  });

  it("uses GAME_METADATA cache category", async () => {
    mockCachedFetch.mockResolvedValue(null);
    await getIGDBData(440);
    expect(mockCachedFetch).toHaveBeenCalledWith(
      "GAME_METADATA",
      [440, "igdb"],
      expect.any(Function)
    );
  });

  it("handles missing optional fields", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(100);
    mockGetGameDetails.mockResolvedValue({ id: 100 });
    mockDbUpdateWhere.mockResolvedValue(undefined);

    const result = await getIGDBData(730);
    expect(result).toEqual({
      igdbId: 100,
      genres: [],
      rating: null,
      summary: null,
      coverUrl: null,
      releaseDate: null,
    });
  });

  it("persists data to game_cache table", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(1942);
    mockGetGameDetails.mockResolvedValue({
      id: 1942,
      genres: [{ name: "FPS" }],
      aggregated_rating: 85,
      summary: "Fun game",
      cover: { url: "//images.igdb.com/t_thumb/co5678.jpg" },
      first_release_date: 1256688000,
    });
    mockDbUpdateWhere.mockResolvedValue(undefined);

    await getIGDBData(440);
    expect(mockDbUpdateWhere).toHaveBeenCalled();
  });

  it("formats cover URL correctly", async () => {
    mockCachedFetch.mockImplementation(
      async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => fetcher()
    );
    mockFindGameBySteamAppId.mockResolvedValue(42);
    mockGetGameDetails.mockResolvedValue({
      id: 42,
      cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/co9999.jpg" },
    });
    mockDbUpdateWhere.mockResolvedValue(undefined);

    const result = await getIGDBData(10);
    expect(result?.coverUrl).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co9999.jpg"
    );
  });

  it("returns null on error", async () => {
    mockCachedFetch.mockRejectedValue(new Error("Network error"));
    const result = await getIGDBData(440);
    expect(result).toBeNull();
  });
});
