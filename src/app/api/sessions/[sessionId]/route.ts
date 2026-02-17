import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, scheduledSessions, gameCache } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { notifySessionCompleted } from "@/lib/services/discord-notify";
import { syncSessionUpdated, syncSessionDeleted } from "@/lib/services/gcal-sync";

export function generateStaticParams() {
  return [];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startTime, endTime, notes, completed } = body as {
    startTime?: string;
    endTime?: string;
    notes?: string;
    completed?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (startTime !== undefined) {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
    }
    updates.startTime = start;
  }

  if (endTime !== undefined) {
    const end = new Date(endTime);
    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid endTime" }, { status: 400 });
    }
    updates.endTime = end;
  }

  if (notes !== undefined) {
    if (typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json({ error: "Notes must be 2000 characters or less" }, { status: 400 });
    }
    updates.notes = notes;
  }
  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 });
    }
    updates.completed = completed;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (updates.startTime || updates.endTime) {
    const existing = await db
      .select()
      .from(scheduledSessions)
      .where(
        and(
          eq(scheduledSessions.id, sessionId),
          eq(scheduledSessions.userId, session.user.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const finalStart = (updates.startTime as Date) ?? existing[0].startTime;
    const finalEnd = (updates.endTime as Date) ?? existing[0].endTime;

    if (finalEnd <= finalStart) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }
  }

  const result = await db
    .update(scheduledSessions)
    .set(updates)
    .where(
      and(
        eq(scheduledSessions.id, sessionId),
        eq(scheduledSessions.userId, session.user.id)
      )
    )
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const cacheRows = await db
    .select({ name: gameCache.name, headerImageUrl: gameCache.headerImageUrl })
    .from(gameCache)
    .where(eq(gameCache.steamAppId, result[0].steamAppId))
    .limit(1);

  const game = cacheRows[0];

  if (completed === true && game) {
    notifySessionCompleted(session.user.id, {
      gameName: game.name,
      headerImageUrl: game.headerImageUrl,
    }).catch((err) => console.error(`[Discord] Session ${sessionId} completion notify failed:`, err));
  }

  if (game && (updates.startTime || updates.endTime || updates.notes !== undefined)) {
    syncSessionUpdated(session.user.id, sessionId, {
      gameName: game.name,
      startTime: result[0].startTime,
      endTime: result[0].endTime,
      notes: result[0].notes,
    }).catch((err) => console.error(`[GCal] Session ${sessionId} sync failed:`, err));
  }

  return NextResponse.json(result[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  const result = await db
    .delete(scheduledSessions)
    .where(
      and(
        eq(scheduledSessions.id, sessionId),
        eq(scheduledSessions.userId, session.user.id)
      )
    )
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  syncSessionDeleted(session.user.id, result[0].googleCalendarEventId)
    .catch((err) => console.error(`[GCal] Session ${sessionId} delete sync failed:`, err));

  return NextResponse.json({ success: true });
}
