import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, users, userAchievements, gameCache } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getPlayerAchievements, getSchemaForGame } from "@/lib/services/steam";
import { cachedFetch } from "@/lib/services/cache";

export function generateStaticParams() {
  return [];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appId: appIdStr } = await params;
  const appId = parseInt(appIdStr, 10);
  if (isNaN(appId)) {
    return NextResponse.json({ error: "Invalid appId" }, { status: 400 });
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

  const result = await cachedFetch(
    "STEAM_ACHIEVEMENTS",
    [steamId, appId],
    async () => {
      const [playerAchievements, schema] = await Promise.all([
        getPlayerAchievements(steamId, appId),
        getSchemaForGame(appId),
      ]);

      if (!playerAchievements) return null;

      const schemaMap = new Map(schema.map((s) => [s.name, s]));

      return {
        gameName: playerAchievements.gameName,
        achievements: playerAchievements.achievements.map((a) => ({
          ...a,
          name: schemaMap.get(a.apiname)?.displayName ?? a.apiname,
          description: schemaMap.get(a.apiname)?.description ?? "",
          icon: a.achieved
            ? schemaMap.get(a.apiname)?.icon
            : schemaMap.get(a.apiname)?.icongray,
        })),
      };
    }
  );

  if (!result) {
    return NextResponse.json(
      { error: "No achievements found" },
      { status: 404 }
    );
  }

  const achieved = result.achievements.filter((a) => a.achieved).length;
  const total = result.achievements.length;

  await db
    .insert(userAchievements)
    .values({
      userId: session.user.id,
      steamAppId: appId,
      achievedCount: achieved,
      totalCount: total,
    })
    .onConflictDoUpdate({
      target: [userAchievements.userId, userAchievements.steamAppId],
      set: {
        achievedCount: achieved,
        totalCount: total,
        lastSynced: new Date(),
      },
    });

  await db
    .update(gameCache)
    .set({ totalAchievements: total })
    .where(
      and(eq(gameCache.steamAppId, appId))
    );

  return NextResponse.json(result);
}
