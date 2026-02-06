import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlayerSummary,
  getOwnedGames,
  getPlayerAchievements,
  getSchemaForGame,
  getGameHeaderUrl,
  getGameCapsuleUrl,
  getStorePage,
} from "../steam";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getPlayerSummary", () => {
  it("returns player data on success", async () => {
    const player = { steamid: "123", personaname: "Test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { players: [player] } }),
    });
    const result = await getPlayerSummary("123");
    expect(result).toEqual(player);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("GetPlayerSummaries"));
  });

  it("returns null when no players in response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { players: [] } }),
    });
    expect(await getPlayerSummary("123")).toBeNull();
  });

  it("returns null when response is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    expect(await getPlayerSummary("123")).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await getPlayerSummary("123")).toBeNull();
  });
});

describe("getOwnedGames", () => {
  it("returns game list on success", async () => {
    const games = [{ appid: 440, name: "TF2", playtime_forever: 100 }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { games } }),
    });
    const result = await getOwnedGames("123");
    expect(result).toEqual(games);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("GetOwnedGames"));
  });

  it("returns empty array when no games", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: {} }),
    });
    expect(await getOwnedGames("123")).toEqual([]);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    expect(await getOwnedGames("123")).toEqual([]);
  });
});

describe("getPlayerAchievements", () => {
  it("returns achievements on success", async () => {
    const achievements = [{ apiname: "ach1", achieved: 1, unlocktime: 123 }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          playerstats: { success: true, gameName: "TF2", achievements },
        }),
    });
    const result = await getPlayerAchievements("123", 440);
    expect(result).toEqual({ achievements, gameName: "TF2" });
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(await getPlayerAchievements("123", 440)).toBeNull();
  });

  it("returns null when stats not successful", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ playerstats: { success: false } }),
    });
    expect(await getPlayerAchievements("123", 440)).toBeNull();
  });

  it("returns empty achievements when none present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          playerstats: { success: true, gameName: "", achievements: undefined },
        }),
    });
    const result = await getPlayerAchievements("123", 440);
    expect(result).toEqual({ achievements: [], gameName: "" });
  });
});

describe("getSchemaForGame", () => {
  it("returns achievement schema on success", async () => {
    const achievements = [{ name: "ach1", displayName: "Achievement 1" }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ game: { availableGameStats: { achievements } } }),
    });
    expect(await getSchemaForGame(440)).toEqual(achievements);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(await getSchemaForGame(440)).toEqual([]);
  });

  it("returns empty array when no game stats", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ game: {} }),
    });
    expect(await getSchemaForGame(440)).toEqual([]);
  });
});

describe("URL helpers", () => {
  it("getGameHeaderUrl returns correct URL", () => {
    expect(getGameHeaderUrl(440)).toBe(
      "https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg"
    );
  });

  it("getGameCapsuleUrl returns correct URL", () => {
    expect(getGameCapsuleUrl(440)).toBe(
      "https://cdn.akamai.steamstatic.com/steam/apps/440/capsule_231x87.jpg"
    );
  });

  it("getStorePage returns correct URL", () => {
    expect(getStorePage(440)).toBe("https://store.steampowered.com/app/440");
  });
});
