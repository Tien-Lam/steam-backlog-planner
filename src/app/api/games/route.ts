import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userGames } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { gameStatusEnum } from "@/lib/db/schema";
import type { GameStatus } from "@/lib/db/schema";

export async function PATCH(req: NextRequest) {
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
  const { steamAppId, status, priority } = body as {
    steamAppId: number;
    status?: GameStatus;
    priority?: number;
  };

  if (!steamAppId) {
    return NextResponse.json({ error: "steamAppId required" }, { status: 400 });
  }

  if (status && !gameStatusEnum.enumValues.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (priority !== undefined) {
    if (typeof priority !== "number" || !Number.isInteger(priority) || priority < 0) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (priority !== undefined) updates.priority = priority;

  await db
    .update(userGames)
    .set(updates)
    .where(
      and(
        eq(userGames.userId, session.user.id),
        eq(userGames.steamAppId, steamAppId)
      )
    );

  return NextResponse.json({ success: true });
}
