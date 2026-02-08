import { describe, it, expect, afterEach } from "vitest";
import { liveConfig } from "../config";
import {
  authAsLiveUser,
  authAsNone,
  makeRequest,
  cleanupUserData,
  cleanupRedisKeys,
  LIVE_TEST_USER_ID,
} from "../helpers";
import { db, userGames } from "@/lib/db";
import { eq } from "drizzle-orm";
import { GET } from "@/app/api/steam/library/route";

const redisKeysToClean: string[] = [];

afterEach(async () => {
  await cleanupUserData();
  await cleanupRedisKeys(redisKeysToClean);
  redisKeysToClean.length = 0;
});

describe("Library sync flow (live)", () => {
  it("syncs Steam library and returns games", async () => {
    authAsLiveUser();
    redisKeysToClean.push(`sbp:STEAM_LIBRARY:${liveConfig.steamId}`);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    // Each game should have steamAppId and cache data
    const firstGame = body[0];
    expect(firstGame).toHaveProperty("steamAppId");
    expect(firstGame).toHaveProperty("playtimeMinutes");
    expect(firstGame).toHaveProperty("cache");
    expect(firstGame.cache).toHaveProperty("name");
  });

  it("creates userGames rows in the database", async () => {
    authAsLiveUser();
    redisKeysToClean.push(`sbp:STEAM_LIBRARY:${liveConfig.steamId}`);

    await GET();

    const dbGames = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, LIVE_TEST_USER_ID));

    expect(dbGames.length).toBeGreaterThan(0);
  });

  it("re-sync does not create duplicates (upsert)", async () => {
    authAsLiveUser();
    redisKeysToClean.push(`sbp:STEAM_LIBRARY:${liveConfig.steamId}`);

    await GET();
    const countAfterFirst = (
      await db
        .select()
        .from(userGames)
        .where(eq(userGames.userId, LIVE_TEST_USER_ID))
    ).length;

    await GET();
    const countAfterSecond = (
      await db
        .select()
        .from(userGames)
        .where(eq(userGames.userId, LIVE_TEST_USER_ID))
    ).length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it("returns 401 when not authenticated", async () => {
    authAsNone();

    const res = await GET();
    expect(res.status).toBe(401);
  });
});
