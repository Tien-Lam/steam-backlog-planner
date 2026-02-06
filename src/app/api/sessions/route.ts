import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, scheduledSessions, gameCache } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [eq(scheduledSessions.userId, session.user.id)];
  if (from) {
    const fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    }
    conditions.push(gte(scheduledSessions.startTime, fromDate));
  }
  if (to) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
    }
    conditions.push(lte(scheduledSessions.startTime, toDate));
  }

  const rows = await db
    .select()
    .from(scheduledSessions)
    .where(and(...conditions))
    .leftJoin(gameCache, eq(scheduledSessions.steamAppId, gameCache.steamAppId));

  const result = rows.map((row) => ({
    ...row.scheduled_sessions,
    game: row.game_cache
      ? { name: row.game_cache.name, headerImageUrl: row.game_cache.headerImageUrl }
      : null,
  }));

  return NextResponse.json(result);
}

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

  const { steamAppId, startTime, endTime, notes } = body as {
    steamAppId?: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
  };

  if (!steamAppId || typeof steamAppId !== "number") {
    return NextResponse.json({ error: "steamAppId is required" }, { status: 400 });
  }

  if (!startTime || !endTime) {
    return NextResponse.json({ error: "startTime and endTime are required" }, { status: 400 });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (end <= start) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }

  if (notes && notes.length > 2000) {
    return NextResponse.json({ error: "Notes must be 2000 characters or less" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await db.insert(scheduledSessions).values({
    id,
    userId: session.user.id,
    steamAppId,
    startTime: start,
    endTime: end,
    notes: notes ?? null,
  });

  return NextResponse.json({ id }, { status: 201 });
}
