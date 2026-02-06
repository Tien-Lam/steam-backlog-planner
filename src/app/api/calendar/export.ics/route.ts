import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, scheduledSessions, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateICalendar } from "@/lib/services/ical";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(scheduledSessions)
    .where(eq(scheduledSessions.userId, session.user.id))
    .leftJoin(gameCache, eq(scheduledSessions.steamAppId, gameCache.steamAppId));

  const icalSessions = rows.map((row) => ({
    id: row.scheduled_sessions.id,
    gameName: row.game_cache?.name ?? `Game ${row.scheduled_sessions.steamAppId}`,
    startTime: row.scheduled_sessions.startTime,
    endTime: row.scheduled_sessions.endTime,
    notes: row.scheduled_sessions.notes,
  }));

  const ical = generateICalendar(icalSessions);

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=steam-backlog.ics",
    },
  });
}
