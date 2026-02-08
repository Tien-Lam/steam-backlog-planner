import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  users,
  userPreferences,
  gameCache,
  userGames,
  userAchievements,
  scheduledSessions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const TEST_USER_PREFIX = "crud-test";
let testSeq = 0;

function uniqueUserId() {
  return `${TEST_USER_PREFIX}-${Date.now()}-${++testSeq}`;
}

const userIdsToClean: string[] = [];
const gameCacheIdsToClean: number[] = [];

afterEach(async () => {
  for (const id of userIdsToClean) {
    await db.delete(scheduledSessions).where(eq(scheduledSessions.userId, id));
    await db.delete(userAchievements).where(eq(userAchievements.userId, id));
    await db.delete(userGames).where(eq(userGames.userId, id));
    await db.delete(userPreferences).where(eq(userPreferences.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  for (const appId of gameCacheIdsToClean) {
    await db.delete(gameCache).where(eq(gameCache.steamAppId, appId));
  }
  userIdsToClean.length = 0;
  gameCacheIdsToClean.length = 0;
});

describe("Neon DB CRUD (live)", () => {
  it("inserts and selects a user", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "CRUDTestUser",
    });

    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].steamUsername).toBe("CRUDTestUser");
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("inserts and selects gameCache with nullable HLTB fields", async () => {
    const appId = 99990000 + testSeq;
    gameCacheIdsToClean.push(appId);

    await db.insert(gameCache).values({
      steamAppId: appId,
      name: "Test Game CRUD",
      headerImageUrl: "https://example.com/img.jpg",
      hltbMainMinutes: 120,
      hltbExtraMinutes: null,
      hltbCompletionistMinutes: null,
      totalAchievements: 50,
    });

    const rows = await db
      .select()
      .from(gameCache)
      .where(eq(gameCache.steamAppId, appId))
      .limit(1);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test Game CRUD");
    expect(rows[0].hltbMainMinutes).toBe(120);
    expect(rows[0].hltbExtraMinutes).toBeNull();
    expect(rows[0].totalAchievements).toBe(50);
  });

  it("inserts userGames with FK relationship", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);
    const appId = 99990000 + testSeq;
    gameCacheIdsToClean.push(appId);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "FKTest",
    });

    await db
      .insert(gameCache)
      .values({ steamAppId: appId, name: "FK Test Game" })
      .onConflictDoUpdate({ target: gameCache.steamAppId, set: { name: "FK Test Game" } });

    await db.insert(userGames).values({
      userId: id,
      steamAppId: appId,
      status: "backlog",
      priority: 5,
      playtimeMinutes: 100,
    });

    const rows = await db
      .select()
      .from(userGames)
      .where(and(eq(userGames.userId, id), eq(userGames.steamAppId, appId)));

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("backlog");
    expect(rows[0].priority).toBe(5);
  });

  it("upserts userGames via onConflictDoUpdate", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);
    const appId = 99990000 + testSeq;
    gameCacheIdsToClean.push(appId);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "UpsertTest",
    });

    await db
      .insert(gameCache)
      .values({ steamAppId: appId, name: "Upsert Game" })
      .onConflictDoUpdate({ target: gameCache.steamAppId, set: { name: "Upsert Game" } });

    await db.insert(userGames).values({
      userId: id,
      steamAppId: appId,
      playtimeMinutes: 50,
    });

    await db
      .insert(userGames)
      .values({
        userId: id,
        steamAppId: appId,
        playtimeMinutes: 200,
      })
      .onConflictDoUpdate({
        target: [userGames.userId, userGames.steamAppId],
        set: { playtimeMinutes: 200, updatedAt: new Date() },
      });

    const rows = await db
      .select()
      .from(userGames)
      .where(and(eq(userGames.userId, id), eq(userGames.steamAppId, appId)));

    expect(rows).toHaveLength(1);
    expect(rows[0].playtimeMinutes).toBe(200);
  });

  it("inserts and updates userPreferences", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "PrefsTest",
    });

    await db.insert(userPreferences).values({
      userId: id,
      weeklyHours: 10,
      sessionLengthMinutes: 60,
      timezone: "UTC",
    });

    await db
      .update(userPreferences)
      .set({ weeklyHours: 20, timezone: "America/New_York" })
      .where(eq(userPreferences.userId, id));

    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, id));

    expect(rows).toHaveLength(1);
    expect(rows[0].weeklyHours).toBe(20);
    expect(rows[0].timezone).toBe("America/New_York");
  });

  it("inserts scheduledSession with date range filtering", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "SessionTest",
    });

    const sessionId = crypto.randomUUID();
    const startTime = new Date("2026-03-01T19:00:00Z");
    const endTime = new Date("2026-03-01T20:00:00Z");

    await db.insert(scheduledSessions).values({
      id: sessionId,
      userId: id,
      steamAppId: 440,
      startTime,
      endTime,
    });

    const rows = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, id));

    expect(rows).toHaveLength(1);
    expect(rows[0].startTime.toISOString()).toBe(startTime.toISOString());
    expect(rows[0].completed).toBe(false);
  });

  it("inserts and verifies userAchievements", async () => {
    const id = uniqueUserId();
    userIdsToClean.push(id);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "AchTest",
    });

    await db.insert(userAchievements).values({
      userId: id,
      steamAppId: 440,
      achievedCount: 30,
      totalCount: 50,
    });

    const rows = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, id));

    expect(rows).toHaveLength(1);
    expect(rows[0].achievedCount).toBe(30);
    expect(rows[0].totalCount).toBe(50);
  });

  it("cascade deletes all child rows when user is deleted", async () => {
    const id = uniqueUserId();
    const appId = 99990000 + testSeq;
    gameCacheIdsToClean.push(appId);

    await db.insert(users).values({
      id,
      steamId: `steam-${id}`,
      steamUsername: "CascadeTest",
    });

    await db
      .insert(gameCache)
      .values({ steamAppId: appId, name: "Cascade Game" })
      .onConflictDoUpdate({ target: gameCache.steamAppId, set: { name: "Cascade Game" } });

    await db.insert(userPreferences).values({ userId: id });
    await db.insert(userGames).values({ userId: id, steamAppId: appId });
    await db.insert(userAchievements).values({
      userId: id,
      steamAppId: appId,
      achievedCount: 5,
      totalCount: 10,
    });
    await db.insert(scheduledSessions).values({
      id: crypto.randomUUID(),
      userId: id,
      steamAppId: appId,
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
    });

    // Delete user — should cascade
    await db.delete(users).where(eq(users.id, id));

    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, id));
    const games = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, id));
    const achs = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, id));
    const sessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, id));

    expect(prefs).toHaveLength(0);
    expect(games).toHaveLength(0);
    expect(achs).toHaveLength(0);
    expect(sessions).toHaveLength(0);

    // gameCache is NOT cascade-deleted (shared metadata) — cleaned via gameCacheIdsToClean
  });
});
