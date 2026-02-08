import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { liveConfig } from "../config";
import {
  authAsLiveUser,
  cleanupUserData,
  cleanupRedisKeys,
  LIVE_TEST_USER_ID,
} from "../helpers";
import { db, userGames, userAchievements, gameCache } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { GET as libraryGET } from "@/app/api/steam/library/route";
import { GET as achievementsGET } from "@/app/api/steam/achievements/[appId]/route";
import { GET as hltbGET } from "@/app/api/hltb/[appId]/route";
import { NextRequest } from "next/server";

let knownAppId: number;
let knownGameName: string;
const redisKeysToClean: string[] = [];

beforeAll(async () => {
  authAsLiveUser();
  redisKeysToClean.push(`sbp:STEAM_LIBRARY:${liveConfig.steamId}`);

  // Sync library to populate gameCache + userGames
  const res = await libraryGET();
  const games = await res.json();

  // Pick a game that likely has achievements (>0 playtime, well-known)
  const candidate = games.find(
    (g: { playtimeMinutes: number; steamAppId: number }) =>
      g.playtimeMinutes > 60 && g.steamAppId > 0
  );

  if (candidate) {
    knownAppId = candidate.steamAppId;
    knownGameName = candidate.cache?.name ?? `Game ${candidate.steamAppId}`;
  } else {
    // Fallback to TF2 which most Steam accounts have
    knownAppId = 440;
    knownGameName = "Team Fortress 2";
  }
});

afterAll(async () => {
  await cleanupUserData();
  await cleanupRedisKeys(redisKeysToClean);
});

describe("Game enrichment flow (live)", () => {
  it("fetches achievements for a known game", async () => {
    authAsLiveUser();
    redisKeysToClean.push(
      `sbp:STEAM_ACHIEVEMENTS:${liveConfig.steamId}:${knownAppId}`
    );

    const req = new NextRequest(
      `http://localhost:3000/api/steam/achievements/${knownAppId}`
    );
    const res = await achievementsGET(req, {
      params: Promise.resolve({ appId: String(knownAppId) }),
    });

    // May be 200 (has achievements) or 404 (no achievements for this game)
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("gameName");
      expect(Array.isArray(body.achievements)).toBe(true);
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("persists achievement counts to DB", async () => {
    authAsLiveUser();
    redisKeysToClean.push(
      `sbp:STEAM_ACHIEVEMENTS:${liveConfig.steamId}:${knownAppId}`
    );

    const req = new NextRequest(
      `http://localhost:3000/api/steam/achievements/${knownAppId}`
    );
    const res = await achievementsGET(req, {
      params: Promise.resolve({ appId: String(knownAppId) }),
    });

    if (res.status === 200) {
      const rows = await db
        .select()
        .from(userAchievements)
        .where(
          and(
            eq(userAchievements.userId, LIVE_TEST_USER_ID),
            eq(userAchievements.steamAppId, knownAppId)
          )
        );

      expect(rows).toHaveLength(1);
      expect(rows[0].totalCount).toBeGreaterThan(0);
    }
  });

  it("fetches HLTB data for a known game", async () => {
    authAsLiveUser();
    redisKeysToClean.push(`sbp:HLTB_DATA:${knownAppId}`);

    const req = new NextRequest(
      `http://localhost:3000/api/hltb/${knownAppId}`
    );
    const res = await hltbGET(req, {
      params: Promise.resolve({ appId: String(knownAppId) }),
    });

    // May be 200 (HLTB found) or 404 (not on HLTB)
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty("mainMinutes");
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("returns 400 for invalid appId", async () => {
    authAsLiveUser();

    const req = new NextRequest(
      "http://localhost:3000/api/steam/achievements/notanumber"
    );
    const res = await achievementsGET(req, {
      params: Promise.resolve({ appId: "notanumber" }),
    });

    expect(res.status).toBe(400);
  });
});
