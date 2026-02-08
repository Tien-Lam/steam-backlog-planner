import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  authAsLiveUser,
  authAsNone,
  makeRequest,
  makeJsonRequest,
  cleanupUserData,
  cleanupRedisKeys,
  seedPreferences,
  seedGames,
  LIVE_TEST_USER_ID,
} from "../helpers";
import { db, scheduledSessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { GET as sessionsGET } from "@/app/api/sessions/route";
import { POST as autoGeneratePOST } from "@/app/api/sessions/auto-generate/route";
import { GET as icalGET } from "@/app/api/calendar/export.ics/route";

const redisKeysToClean: string[] = [];

beforeEach(async () => {
  authAsLiveUser();
  redisKeysToClean.push(`sbp:ratelimit:autogen:${LIVE_TEST_USER_ID}`);
});

afterEach(async () => {
  await cleanupUserData();
  await cleanupRedisKeys(redisKeysToClean);
  redisKeysToClean.length = 0;
});

describe("Scheduling flow (live)", () => {
  it("auto-generates sessions from backlog games", async () => {
    await seedPreferences({ weeklyHours: 14, sessionLengthMinutes: 60 });
    await seedGames([
      { steamAppId: 440, name: "Team Fortress 2", status: "backlog", priority: 3, hltbMainMinutes: 120 },
      { steamAppId: 620, name: "Portal 2", status: "backlog", priority: 2, hltbMainMinutes: 360 },
      { steamAppId: 730, name: "Counter-Strike 2", status: "backlog", priority: 1, hltbMainMinutes: 180 },
    ]);

    const req = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 2,
    });

    const res = await autoGeneratePOST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.created).toBeGreaterThan(0);

    // Verify sessions in DB
    const dbSessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, LIVE_TEST_USER_ID));

    expect(dbSessions.length).toBe(body.created);
  });

  it("GET /api/sessions returns created sessions", async () => {
    await seedPreferences();
    await seedGames([
      { steamAppId: 440, name: "Team Fortress 2", status: "backlog", priority: 1, hltbMainMinutes: 120 },
    ]);

    const genReq = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 1,
    });
    await autoGeneratePOST(genReq);

    const listRes = await sessionsGET(makeRequest("/api/sessions"));
    const sessions = await listRes.json();

    expect(listRes.status).toBe(200);
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty("steamAppId");
    expect(sessions[0]).toHaveProperty("startTime");
  });

  it("GET /api/calendar/export.ics returns valid iCal", async () => {
    await seedPreferences();
    await seedGames([
      { steamAppId: 440, name: "Team Fortress 2", status: "backlog", priority: 1, hltbMainMinutes: 120 },
    ]);

    const genReq = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 1,
    });
    await autoGeneratePOST(genReq);

    const icalRes = await icalGET();
    const icalText = await icalRes.text();

    expect(icalRes.headers.get("Content-Type")).toContain("text/calendar");
    expect(icalText).toContain("BEGIN:VCALENDAR");
    expect(icalText).toContain("BEGIN:VEVENT");
    expect(icalText).toContain("END:VCALENDAR");
  });

  it("clearExisting replaces old sessions", async () => {
    await seedPreferences();
    await seedGames([
      { steamAppId: 440, name: "Team Fortress 2", status: "backlog", priority: 1, hltbMainMinutes: 120 },
    ]);

    // First generation
    const req1 = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 1,
    });
    await autoGeneratePOST(req1);

    const countBefore = (
      await db
        .select()
        .from(scheduledSessions)
        .where(eq(scheduledSessions.userId, LIVE_TEST_USER_ID))
    ).length;

    // Second generation with clearExisting
    const req2 = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-04-01",
      weeks: 1,
      clearExisting: true,
    });
    const res2 = await autoGeneratePOST(req2);

    expect(res2.status).toBe(201);

    const countAfter = (
      await db
        .select()
        .from(scheduledSessions)
        .where(eq(scheduledSessions.userId, LIVE_TEST_USER_ID))
    ).length;

    // New sessions replaced old ones (count may differ but old ones are gone)
    const body2 = await res2.json();
    expect(countAfter).toBe(body2.created);
  });

  it("rate limits after 3 rapid requests", async () => {
    await seedPreferences();
    await seedGames([
      { steamAppId: 440, name: "Team Fortress 2", status: "backlog", priority: 1, hltbMainMinutes: 120 },
    ]);

    const makeGenReq = () =>
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2026-03-01",
        weeks: 1,
      });

    const res1 = await autoGeneratePOST(makeGenReq());
    expect(res1.status).toBe(201);

    const res2 = await autoGeneratePOST(makeGenReq());
    expect(res2.status).toBe(201);

    const res3 = await autoGeneratePOST(makeGenReq());
    expect(res3.status).toBe(201);

    const res4 = await autoGeneratePOST(makeGenReq());
    expect(res4.status).toBe(429);
  });

  it("returns 401 when not authenticated", async () => {
    authAsNone();

    const req = makeJsonRequest("/api/sessions/auto-generate", "POST", {
      startDate: "2026-03-01",
      weeks: 1,
    });

    const res = await autoGeneratePOST(req);
    expect(res.status).toBe(401);
  });
});
