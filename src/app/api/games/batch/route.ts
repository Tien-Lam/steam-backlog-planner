import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userGames } from "@/lib/db";
import { eq, and } from "drizzle-orm";

interface PriorityUpdate {
  steamAppId: number;
  priority: number;
}

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

  const { updates } = body as { updates?: PriorityUpdate[] };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates must be a non-empty array" }, { status: 400 });
  }

  if (updates.length > 500) {
    return NextResponse.json({ error: "Too many updates (max 500)" }, { status: 400 });
  }

  for (const update of updates) {
    if (
      typeof update.steamAppId !== "number" ||
      typeof update.priority !== "number" ||
      !Number.isInteger(update.priority) ||
      update.priority < 0
    ) {
      return NextResponse.json(
        { error: `Invalid update for appId ${update.steamAppId}` },
        { status: 400 }
      );
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const { steamAppId, priority } of updates) {
        await tx
          .update(userGames)
          .set({ priority, updatedAt: new Date() })
          .where(
            and(
              eq(userGames.userId, session.user!.id!),
              eq(userGames.steamAppId, steamAppId)
            )
          );
      }
    });
  } catch {
    return NextResponse.json({ error: "Failed to update priorities" }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
