import { describe, it, expect } from "vitest";
import { liveConfig } from "../config";
import {
  getPlayerSummary,
  getOwnedGames,
  getPlayerAchievements,
  getSchemaForGame,
} from "@/lib/services/steam";

describe("Steam API (live)", () => {
  describe("getPlayerSummary", () => {
    it("returns player data for a valid steam ID", async () => {
      const player = await getPlayerSummary(liveConfig.steamId);

      expect(player).not.toBeNull();
      expect(player!.steamid).toBe(liveConfig.steamId);
      expect(player!.personaname).toBeTruthy();
      expect(player!.avatarfull).toBeTruthy();
    });

    it("returns null for an invalid steam ID", async () => {
      const player = await getPlayerSummary("0000000000000000");
      expect(player).toBeNull();
    });
  });

  describe("getOwnedGames", () => {
    it("returns a non-empty array of games", async () => {
      const games = await getOwnedGames(liveConfig.steamId);

      expect(games.length).toBeGreaterThan(0);
      expect(games[0]).toHaveProperty("appid");
      expect(games[0]).toHaveProperty("name");
      expect(games[0]).toHaveProperty("playtime_forever");
    });
  });

  describe("getPlayerAchievements", () => {
    let knownAppId: number;

    it("discovers a game with achievements and returns them", async () => {
      const games = await getOwnedGames(liveConfig.steamId);
      const withStats = games.find((g) => g.has_community_visible_stats);
      expect(withStats).toBeDefined();
      knownAppId = withStats!.appid;

      const result = await getPlayerAchievements(
        liveConfig.steamId,
        knownAppId
      );

      // Some games have stats but no achievements — allow null
      if (result) {
        expect(result.gameName).toBeTruthy();
        expect(Array.isArray(result.achievements)).toBe(true);
      }
    });

    it("returns null for a non-existent game", async () => {
      const result = await getPlayerAchievements(liveConfig.steamId, 0);
      expect(result).toBeNull();
    });
  });

  describe("getSchemaForGame", () => {
    it("returns achievement schemas for a known game (TF2 = 440)", async () => {
      const schemas = await getSchemaForGame(440);

      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas[0]).toHaveProperty("displayName");
      expect(schemas[0]).toHaveProperty("icon");
    });

    it("returns empty array for a non-existent game", async () => {
      const schemas = await getSchemaForGame(999999999);
      expect(schemas).toEqual([]);
    });
  });
});
