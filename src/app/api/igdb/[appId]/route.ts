import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getIGDBData } from "@/lib/services/igdb";

const IGDB_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appId } = await params;
  const appIdNum = parseInt(appId, 10);
  if (isNaN(appIdNum)) {
    return NextResponse.json({ error: "Invalid appId" }, { status: 400 });
  }

  const cached = await db
    .select()
    .from(gameCache)
    .where(eq(gameCache.steamAppId, appIdNum))
    .limit(1);

  if (!cached.length) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const game = cached[0];

  const isFresh =
    game.igdbId !== null &&
    game.cachedAt &&
    Date.now() - new Date(game.cachedAt).getTime() < IGDB_STALE_MS;

  if (isFresh) {
    return NextResponse.json({
      igdbId: game.igdbId,
      genres: game.genres ? JSON.parse(game.genres) : [],
      rating: game.igdbRating,
      summary: game.summary,
      coverUrl: game.coverUrl,
      releaseDate: game.releaseDate?.toISOString() ?? null,
    });
  }

  const data = await getIGDBData(appIdNum);
  if (!data) {
    return NextResponse.json({ error: "IGDB data not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
