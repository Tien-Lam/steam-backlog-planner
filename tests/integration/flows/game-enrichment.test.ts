import { describe, it, expect, vi } from "vitest";
import { seedUser, seedGames, authAs } from "../helpers";
import { db, userAchievements, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";

const mockHltbSearch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/steam", () => ({
  getPlayerAchievements: vi.fn(),
  getSchemaForGame: vi.fn(),
  getOwnedGames: vi.fn(),
  getGameHeaderUrl: (appId: number) =>
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
}));

vi.mock("howlongtobeat", () => ({
  HowLongToBeatService: class {
    search = mockHltbSearch;
  },
}));

describe("Game Enrichment Flow", () => {
  describe("Achievements", () => {
    it("fetches achievements and persists to userAchievements + gameCache", async () => {
      const user = await seedUser();
      authAs(user.id);
      await seedGames(user.id, [
        { steamAppId: 440, name: "Team Fortress 2" },
      ]);

      const { getPlayerAchievements, getSchemaForGame } = await import(
        "@/lib/services/steam"
      );

      vi.mocked(getPlayerAchievements).mockResolvedValue({
        gameName: "Team Fortress 2",
        achievements: [
          { apiname: "ach1", achieved: 1, unlocktime: 1700000000 },
          { apiname: "ach2", achieved: 0, unlocktime: 0 },
          { apiname: "ach3", achieved: 1, unlocktime: 1700000001 },
        ],
      });

      vi.mocked(getSchemaForGame).mockResolvedValue([
        {
          name: "ach1",
          displayName: "First Blood",
          description: "Get first kill",
          icon: "icon1.png",
          icongray: "icon1_gray.png",
        },
        {
          name: "ach2",
          displayName: "Medic!",
          description: "Heal teammates",
          icon: "icon2.png",
          icongray: "icon2_gray.png",
        },
        {
          name: "ach3",
          displayName: "Headshot",
          description: "Snipe someone",
          icon: "icon3.png",
          icongray: "icon3_gray.png",
        },
      ]);

      const { GET } = await import(
        "@/app/api/steam/achievements/[appId]/route"
      );
      const res = await GET(
        new (await import("next/server")).NextRequest(
          "http://localhost:3000/api/steam/achievements/440"
        ),
        { params: Promise.resolve({ appId: "440" }) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.achievements).toHaveLength(3);

      const achRows = await db.select().from(userAchievements);
      expect(achRows).toHaveLength(1);
      expect(achRows[0].achievedCount).toBe(2);
      expect(achRows[0].totalCount).toBe(3);

      const cacheRow = await db
        .select()
        .from(gameCache)
        .where(eq(gameCache.steamAppId, 440));
      expect(cacheRow[0].totalAchievements).toBe(3);
    });

    it("updates achievements on re-fetch (onConflictDoUpdate)", async () => {
      const user = await seedUser();
      authAs(user.id);
      await seedGames(user.id, [
        { steamAppId: 440, name: "Team Fortress 2" },
      ]);

      const { getPlayerAchievements, getSchemaForGame } = await import(
        "@/lib/services/steam"
      );

      vi.mocked(getSchemaForGame).mockResolvedValue([
        {
          name: "ach1",
          displayName: "First",
          description: "",
          icon: "",
          icongray: "",
        },
      ]);

      vi.mocked(getPlayerAchievements).mockResolvedValue({
        gameName: "TF2",
        achievements: [{ apiname: "ach1", achieved: 0, unlocktime: 0 }],
      });

      const { GET } = await import(
        "@/app/api/steam/achievements/[appId]/route"
      );
      const req = new (await import("next/server")).NextRequest(
        "http://localhost:3000/api/steam/achievements/440"
      );

      await GET(req, { params: Promise.resolve({ appId: "440" }) });

      let achRows = await db.select().from(userAchievements);
      expect(achRows[0].achievedCount).toBe(0);

      vi.mocked(getPlayerAchievements).mockResolvedValue({
        gameName: "TF2",
        achievements: [{ apiname: "ach1", achieved: 1, unlocktime: 170000 }],
      });

      await GET(req, { params: Promise.resolve({ appId: "440" }) });

      achRows = await db.select().from(userAchievements);
      expect(achRows).toHaveLength(1);
      expect(achRows[0].achievedCount).toBe(1);
    });
  });

  describe("HLTB", () => {
    it("fetches HLTB data and persists to gameCache", async () => {
      const user = await seedUser();
      authAs(user.id);
      await seedGames(user.id, [{ steamAppId: 440, name: "Team Fortress 2" }]);

      mockHltbSearch.mockResolvedValue([
        {
          gameplayMain: 10,
          gameplayMainExtra: 20,
          gameplayCompletionist: 40,
        } as never,
      ]);

      const { GET } = await import("@/app/api/hltb/[appId]/route");
      const req = new (await import("next/server")).NextRequest(
        "http://localhost:3000/api/hltb/440"
      );
      const res = await GET(req, {
        params: Promise.resolve({ appId: "440" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mainMinutes).toBe(600);
      expect(body.extraMinutes).toBe(1200);
      expect(body.completionistMinutes).toBe(2400);

      const cacheRow = await db
        .select()
        .from(gameCache)
        .where(eq(gameCache.steamAppId, 440));
      expect(cacheRow[0].hltbMainMinutes).toBe(600);
    });

    it("returns cached HLTB data from DB without calling HLTB service", async () => {
      const user = await seedUser();
      authAs(user.id);
      await seedGames(user.id, [
        {
          steamAppId: 440,
          name: "Team Fortress 2",
          hltbMainMinutes: 600,
          hltbExtraMinutes: 1200,
          hltbCompletionistMinutes: 2400,
        },
      ]);

      // Return empty from HLTB — if the service is bypassed, this won't matter
      mockHltbSearch.mockResolvedValue([]);
      const callsBefore = mockHltbSearch.mock.calls.length;

      const { GET } = await import("@/app/api/hltb/[appId]/route");
      const req = new (await import("next/server")).NextRequest(
        "http://localhost:3000/api/hltb/440"
      );
      const res = await GET(req, {
        params: Promise.resolve({ appId: "440" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Route returns cached data from DB, not from HLTB service
      expect(body.mainMinutes).toBe(600);
      expect(body.extraMinutes).toBe(1200);
      expect(body.completionistMinutes).toBe(2400);
      // No new calls to HLTB search after the route call
      expect(mockHltbSearch.mock.calls.length).toBe(callsBefore);
    });
  });
});
