import { db } from "@/lib/db";
import {
  users,
  userPreferences,
  userGames,
  gameCache,
  userAchievements,
  scheduledSessions,
} from "@/lib/db/schema";
import { NextRequest } from "next/server";
import { mockAuth } from "./setup";

interface SeedUserOptions {
  id?: string;
  steamId?: string;
  steamUsername?: string;
}

export async function seedUser(opts: SeedUserOptions = {}) {
  const user = {
    id: opts.id ?? "user-1",
    steamId: opts.steamId ?? "76561198000000001",
    steamUsername: opts.steamUsername ?? "TestPlayer",
    avatarUrl: "https://example.com/avatar.jpg",
    profileUrl: "https://steamcommunity.com/id/test",
  };
  await db.insert(users).values(user);
  return user;
}

interface SeedGameOptions {
  steamAppId: number;
  name: string;
  status?: "backlog" | "playing" | "completed" | "abandoned";
  priority?: number;
  playtimeMinutes?: number;
  hltbMainMinutes?: number | null;
  hltbExtraMinutes?: number | null;
  hltbCompletionistMinutes?: number | null;
}

export async function seedGames(userId: string, games: SeedGameOptions[]) {
  for (const game of games) {
    await db.insert(gameCache).values({
      steamAppId: game.steamAppId,
      name: game.name,
      headerImageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`,
      hltbMainMinutes: game.hltbMainMinutes ?? null,
      hltbExtraMinutes: game.hltbExtraMinutes ?? null,
      hltbCompletionistMinutes: game.hltbCompletionistMinutes ?? null,
    });

    await db.insert(userGames).values({
      userId,
      steamAppId: game.steamAppId,
      status: game.status ?? "backlog",
      priority: game.priority ?? 0,
      playtimeMinutes: game.playtimeMinutes ?? 0,
    });
  }
}

interface SeedPreferencesOptions {
  weeklyHours?: number;
  sessionLengthMinutes?: number;
  timezone?: string;
}

export async function seedPreferences(
  userId: string,
  prefs: SeedPreferencesOptions = {}
) {
  await db.insert(userPreferences).values({
    userId,
    weeklyHours: prefs.weeklyHours ?? 10,
    sessionLengthMinutes: prefs.sessionLengthMinutes ?? 60,
    timezone: prefs.timezone ?? "UTC",
  });
}

export async function seedSession(
  userId: string,
  session: {
    id?: string;
    steamAppId: number;
    startTime: Date;
    endTime: Date;
    notes?: string;
    completed?: boolean;
  }
) {
  const id = session.id ?? crypto.randomUUID();
  await db.insert(scheduledSessions).values({
    id,
    userId,
    steamAppId: session.steamAppId,
    startTime: session.startTime,
    endTime: session.endTime,
    notes: session.notes ?? null,
    completed: session.completed ?? false,
  });
  return id;
}

interface SeedAchievementOptions {
  steamAppId: number;
  achievedCount: number;
  totalCount: number;
}

export async function seedAchievements(
  userId: string,
  achievements: SeedAchievementOptions[]
) {
  for (const ach of achievements) {
    await db.insert(userAchievements).values({
      userId,
      steamAppId: ach.steamAppId,
      achievedCount: ach.achievedCount,
      totalCount: ach.totalCount,
    });
  }
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

export function authAs(userId: string) {
  mockAuth.mockResolvedValue({
    user: { id: userId, name: "TestPlayer" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function authAsNone() {
  mockAuth.mockResolvedValue(null);
}
