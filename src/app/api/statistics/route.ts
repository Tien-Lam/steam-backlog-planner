import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, userAchievements, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      steamAppId: userAchievements.steamAppId,
      achievedCount: userAchievements.achievedCount,
      totalCount: userAchievements.totalCount,
      gameName: gameCache.name,
    })
    .from(userAchievements)
    .leftJoin(gameCache, eq(userAchievements.steamAppId, gameCache.steamAppId))
    .where(eq(userAchievements.userId, session.user.id));

  let totalAchieved = 0;
  let totalAll = 0;
  const perGame = rows.map((r) => {
    totalAchieved += r.achievedCount;
    totalAll += r.totalCount;
    return {
      steamAppId: r.steamAppId,
      gameName: r.gameName ?? `Game ${r.steamAppId}`,
      achieved: r.achievedCount,
      total: r.totalCount,
      percentage: r.totalCount > 0 ? Math.round((r.achievedCount / r.totalCount) * 100) : 0,
    };
  });

  return NextResponse.json({
    overallAchievements: {
      achieved: totalAchieved,
      total: totalAll,
      percentage: totalAll > 0 ? Math.round((totalAchieved / totalAll) * 100) : 0,
    },
    perGame,
  });
}
