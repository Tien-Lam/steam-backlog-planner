import { NextRequest, NextResponse } from "next/server";
import { db, users, userPreferences, userGames, gameCache, scheduledSessions } from "@/lib/db";

const TEST_USER = {
  id: "e2e-test-user",
  steamId: "76561198000000099",
  steamUsername: "E2E Tester",
  avatarUrl: "https://example.com/avatar.jpg",
  profileUrl: "https://steamcommunity.com/id/e2etester",
};

const TEST_GAMES = [
  { steamAppId: 440, name: "Team Fortress 2", hltbMainMinutes: 600 },
  { steamAppId: 570, name: "Dota 2", hltbMainMinutes: 1200 },
  { steamAppId: 730, name: "Counter-Strike 2", hltbMainMinutes: 300 },
  { steamAppId: 1245620, name: "Elden Ring", hltbMainMinutes: 3360 },
  { steamAppId: 292030, name: "The Witcher 3", hltbMainMinutes: 3060 },
];

export async function POST(req: NextRequest) {
  if (process.env.E2E_TESTING !== "true") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { scenario?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const scenario = body.scenario ?? "default";

  // Clean existing test data
  try {
    const { eq } = await import("drizzle-orm");
    await db.delete(scheduledSessions).where(eq(scheduledSessions.userId, TEST_USER.id));
    await db.delete(userGames).where(eq(userGames.userId, TEST_USER.id));
    await db.delete(userPreferences).where(eq(userPreferences.userId, TEST_USER.id));
    await db.delete(users).where(eq(users.id, TEST_USER.id));
  } catch {
    // Tables may not have existing data
  }

  await db.insert(users).values(TEST_USER);

  if (scenario === "with-library" || scenario === "full") {
    for (const game of TEST_GAMES) {
      await db
        .insert(gameCache)
        .values({
          steamAppId: game.steamAppId,
          name: game.name,
          headerImageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`,
          hltbMainMinutes: game.hltbMainMinutes,
        })
        .onConflictDoUpdate({
          target: gameCache.steamAppId,
          set: {
            name: game.name,
            hltbMainMinutes: game.hltbMainMinutes,
          },
        });

      await db.insert(userGames).values({
        userId: TEST_USER.id,
        steamAppId: game.steamAppId,
        status: "backlog",
        priority: TEST_GAMES.indexOf(game),
        playtimeMinutes: Math.floor(Math.random() * 100),
      });
    }
  }

  if (scenario === "full") {
    await db.insert(userPreferences).values({
      userId: TEST_USER.id,
      weeklyHours: 10,
      sessionLengthMinutes: 60,
      timezone: "America/New_York",
    });
  }

  return NextResponse.json({
    userId: TEST_USER.id,
    scenario,
  });
}
