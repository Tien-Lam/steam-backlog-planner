import { describe, it, expect, afterAll } from "vitest";
import { liveConfig } from "../config";
import {
  authAsLiveUser,
  makeRequest,
  makeJsonRequest,
  cleanupUserData,
  cleanupRedisKeys,
  LIVE_TEST_USER_ID,
} from "../helpers";
import { db, userGames } from "@/lib/db";
import { eq } from "drizzle-orm";
import { GET as libraryGET } from "@/app/api/steam/library/route";
import { PATCH as gamesPATCH } from "@/app/api/games/route";
import { GET as hltbGET } from "@/app/api/hltb/[appId]/route";
import { PATCH as preferencesPATCH } from "@/app/api/preferences/route";
import { POST as autoGeneratePOST } from "@/app/api/sessions/auto-generate/route";
import { GET as sessionsGET } from "@/app/api/sessions/route";
import { GET as icalGET } from "@/app/api/calendar/export.ics/route";
import { GET as statisticsGET } from "@/app/api/statistics/route";
import { NextRequest } from "next/server";

const redisKeysToClean: string[] = [];

afterAll(async () => {
  await cleanupUserData();
  redisKeysToClean.push(
    `sbp:STEAM_LIBRARY:${liveConfig.steamId}`,
    `sbp:ratelimit:autogen:${LIVE_TEST_USER_ID}`
  );
  await cleanupRedisKeys(redisKeysToClean);
});

describe("Full workflow (live)", { timeout: 120_000 }, () => {
  it("syncs library → sets backlog → enriches → schedules → exports", async () => {
    authAsLiveUser();

    // 1. Sync library
    const syncRes = await libraryGET();
    expect(syncRes.status).toBe(200);
    const library = await syncRes.json();
    expect(library.length).toBeGreaterThan(0);

    // 2. Pick 3 games and set to backlog with priorities
    const gamesToSchedule = library.slice(0, 3);
    for (let i = 0; i < gamesToSchedule.length; i++) {
      const game = gamesToSchedule[i];
      const patchReq = makeJsonRequest("/api/games", "PATCH", {
        steamAppId: game.steamAppId,
        status: "backlog",
        priority: gamesToSchedule.length - i,
      });
      const patchRes = await gamesPATCH(patchReq);
      expect(patchRes.status).toBe(200);
    }

    // Verify backlog status in DB
    const dbGames = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, LIVE_TEST_USER_ID));
    const backlogGames = dbGames.filter((g) => g.status === "backlog");
    expect(backlogGames.length).toBeGreaterThanOrEqual(3);

    // 3. Enrich with HLTB (attempt — may 404 if HLTB doesn't have the game)
    for (const game of gamesToSchedule) {
      redisKeysToClean.push(`sbp:HLTB_DATA:${game.steamAppId}`);
      const hltbReq = new NextRequest(
        `http://localhost:3000/api/hltb/${game.steamAppId}`
      );
      const hltbRes = await hltbGET(hltbReq, {
        params: Promise.resolve({ appId: String(game.steamAppId) }),
      });
      // Accept both 200 and 404
      expect([200, 404]).toContain(hltbRes.status);
    }

    // 4. Configure preferences
    const prefsReq = makeJsonRequest("/api/preferences", "PATCH", {
      weeklyHours: 14,
      sessionLengthMinutes: 90,
      timezone: "America/New_York",
    });
    const prefsRes = await preferencesPATCH(prefsReq);
    expect(prefsRes.status).toBe(200);

    // 5. Auto-generate schedule
    const genReq = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 2,
    });
    const genRes = await autoGeneratePOST(genReq);
    expect(genRes.status).toBe(201);
    const genBody = await genRes.json();
    expect(genBody.created).toBeGreaterThan(0);

    // 6. List sessions
    const listRes = await sessionsGET(makeRequest("/api/sessions"));
    expect(listRes.status).toBe(200);
    const sessions = await listRes.json();
    expect(sessions.length).toBe(genBody.created);

    // 7. Export iCal
    const icalRes = await icalGET();
    const icalText = await icalRes.text();
    expect(icalText).toContain("BEGIN:VCALENDAR");
    expect(icalText).toContain("BEGIN:VEVENT");
    expect(icalText).toContain("END:VCALENDAR");

    // 8. Statistics
    const statsRes = await statisticsGET();
    expect(statsRes.status).toBe(200);
    const stats = await statsRes.json();
    expect(stats).toHaveProperty("overallAchievements");
    expect(stats).toHaveProperty("perGame");
  });
});
