import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, scheduledSessions, userGames, userPreferences, gameCache } from "@/lib/db";
import { eq, and, notInArray } from "drizzle-orm";
import { generateSchedule } from "@/lib/services/scheduler";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startDate, weeks, clearExisting } = body as {
    startDate?: string;
    weeks?: number;
    clearExisting?: boolean;
  };

  if (!startDate) {
    return NextResponse.json({ error: "startDate is required" }, { status: 400 });
  }

  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }

  if (!weeks || typeof weeks !== "number" || weeks < 1 || weeks > 12) {
    return NextResponse.json({ error: "weeks must be 1-12" }, { status: 400 });
  }

  const prefsRows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  const prefs = prefsRows[0] ?? {
    weeklyHours: 10,
    sessionLengthMinutes: 60,
    timezone: "UTC",
  };

  const backlogRows = await db
    .select()
    .from(userGames)
    .where(
      and(
        eq(userGames.userId, session.user.id),
        eq(userGames.status, "backlog")
      )
    )
    .leftJoin(gameCache, eq(userGames.steamAppId, gameCache.steamAppId));

  const backlogGames = backlogRows
    .sort((a, b) => (b.user_games.priority ?? 0) - (a.user_games.priority ?? 0))
    .map((row) => ({
      steamAppId: row.user_games.steamAppId,
      gameName: row.game_cache?.name ?? `Game ${row.user_games.steamAppId}`,
      hltbMainMinutes: row.game_cache?.hltbMainMinutes ?? null,
      playtimeMinutes: row.user_games.playtimeMinutes ?? 0,
    }));

  if (backlogGames.length === 0) {
    return NextResponse.json({ error: "No backlog games to schedule" }, { status: 400 });
  }

  const generated = generateSchedule({
    startDate: start,
    weeks,
    preferences: {
      weeklyHours: prefs.weeklyHours ?? 10,
      sessionLengthMinutes: prefs.sessionLengthMinutes ?? 60,
      timezone: prefs.timezone ?? "UTC",
    },
    backlogGames,
  });

  if (generated.length === 0) {
    return NextResponse.json({ error: "No sessions could be generated" }, { status: 400 });
  }

  const toInsert = generated.map((s) => ({
    id: crypto.randomUUID(),
    userId: session.user!.id!,
    steamAppId: s.steamAppId,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  try {
    // Insert new sessions first to avoid data loss if the operation fails midway.
    // (Neon HTTP driver doesn't support transactions.)
    await db.insert(scheduledSessions).values(toInsert);

    if (clearExisting) {
      const newIds = toInsert.map((s) => s.id);
      await db
        .delete(scheduledSessions)
        .where(
          and(
            eq(scheduledSessions.userId, session.user!.id!),
            notInArray(scheduledSessions.id, newIds)
          )
        );
    }
  } catch {
    return NextResponse.json({ error: "Failed to save sessions" }, { status: 500 });
  }

  return NextResponse.json({ created: toInsert.length }, { status: 201 });
}
