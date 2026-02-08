import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, userGames, gameCache } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getOwnedGames, getGameHeaderUrl } from "@/lib/services/steam";
import { cachedFetch } from "@/lib/services/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!dbUser.length) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const steamId = dbUser[0].steamId;

  try {
    const games = await cachedFetch("STEAM_LIBRARY", [steamId], () =>
      getOwnedGames(steamId)
    );

    if (games.length > 0) {
      await db
        .insert(gameCache)
        .values(
          games.map((game) => ({
            steamAppId: game.appid,
            name: game.name,
            headerImageUrl: getGameHeaderUrl(game.appid),
          }))
        )
        .onConflictDoUpdate({
          target: gameCache.steamAppId,
          set: {
            name: sql`excluded."name"`,
            headerImageUrl: sql`excluded."header_image_url"`,
          },
        });

      await db
        .insert(userGames)
        .values(
          games.map((game) => ({
            userId: session.user.id,
            steamAppId: game.appid,
            playtimeMinutes: game.playtime_forever,
            lastPlayed: game.rtime_last_played
              ? new Date(game.rtime_last_played * 1000)
              : null,
          }))
        )
        .onConflictDoUpdate({
          target: [userGames.userId, userGames.steamAppId],
          set: {
            playtimeMinutes: sql`excluded."playtime_minutes"`,
            lastPlayed: sql`excluded."last_played"`,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.error("[Library Sync] Failed for user", session.user.id, error);
  }

  const userGamesList = await db.query.userGames.findMany({
    where: eq(userGames.userId, session.user.id),
    with: { cache: true },
    orderBy: (ug, { desc }) => [desc(ug.playtimeMinutes)],
  });

  return NextResponse.json(userGamesList);
}
