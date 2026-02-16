import { db } from "@/lib/db";
import {
  scheduledSessions,
  userAchievements,
  userGames,
  userPreferences,
  gameCache,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/services/cache";
import { NextRequest } from "next/server";
import { mockAuth } from "./setup";

export const LIVE_TEST_USER_ID = "live-test-user";

export function authAsLiveUser() {
  mockAuth.mockResolvedValue({
    user: { id: LIVE_TEST_USER_ID, name: "LiveTestUser" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function authAsNone() {
  mockAuth.mockResolvedValue(null);
}

export function makeRequest(url: string, init?: RequestInit): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;
  const nextInit = init ? { ...init, signal: init.signal ?? undefined } : undefined;
  return new NextRequest(fullUrl, nextInit);
}

export function makeJsonRequest(
  url: string,
  method: string,
  body: unknown
): NextRequest {
  return makeRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function cleanupUserData() {
  await db
    .delete(scheduledSessions)
    .where(eq(scheduledSessions.userId, LIVE_TEST_USER_ID));
  await db
    .delete(userAchievements)
    .where(eq(userAchievements.userId, LIVE_TEST_USER_ID));
  await db
    .delete(userGames)
    .where(eq(userGames.userId, LIVE_TEST_USER_ID));
  await db
    .delete(userPreferences)
    .where(eq(userPreferences.userId, LIVE_TEST_USER_ID));
}

export async function cleanupRedisKeys(keys: string[]) {
  if (keys.length === 0) return;
  for (const key of keys) {
    await redis.del(key);
  }
}

export async function seedPreferences(
  prefs: {
    weeklyHours?: number;
    sessionLengthMinutes?: number;
    timezone?: string;
  } = {}
) {
  await db
    .insert(userPreferences)
    .values({
      userId: LIVE_TEST_USER_ID,
      weeklyHours: prefs.weeklyHours ?? 10,
      sessionLengthMinutes: prefs.sessionLengthMinutes ?? 60,
      timezone: prefs.timezone ?? "UTC",
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        weeklyHours: prefs.weeklyHours ?? 10,
        sessionLengthMinutes: prefs.sessionLengthMinutes ?? 60,
        timezone: prefs.timezone ?? "UTC",
        updatedAt: new Date(),
      },
    });
}

export async function seedGames(
  games: {
    steamAppId: number;
    name: string;
    status?: "backlog" | "playing" | "completed" | "abandoned";
    priority?: number;
    playtimeMinutes?: number;
    hltbMainMinutes?: number | null;
  }[]
) {
  for (const game of games) {
    await db
      .insert(gameCache)
      .values({
        steamAppId: game.steamAppId,
        name: game.name,
        headerImageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`,
        hltbMainMinutes: game.hltbMainMinutes ?? null,
      })
      .onConflictDoUpdate({
        target: gameCache.steamAppId,
        set: { name: game.name },
      });

    await db
      .insert(userGames)
      .values({
        userId: LIVE_TEST_USER_ID,
        steamAppId: game.steamAppId,
        status: game.status ?? "backlog",
        priority: game.priority ?? 0,
        playtimeMinutes: game.playtimeMinutes ?? 0,
      })
      .onConflictDoUpdate({
        target: [userGames.userId, userGames.steamAppId],
        set: {
          status: game.status ?? "backlog",
          priority: game.priority ?? 0,
          updatedAt: new Date(),
        },
      });
  }
}
