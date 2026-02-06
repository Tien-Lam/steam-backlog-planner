import { HowLongToBeatService } from "howlongtobeat";
import { cachedFetch } from "@/lib/services/cache";
import { db, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface HLTBData {
  mainMinutes: number | null;
  extraMinutes: number | null;
  completionistMinutes: number | null;
}

export async function getHLTBData(
  gameName: string,
  steamAppId: number
): Promise<HLTBData | null> {
  try {
    return await cachedFetch("HLTB_DATA", [steamAppId], async () => {
      const service = new HowLongToBeatService();
      const results = await service.search(gameName);

      if (!results.length) return null;

      const entry = results[0];
      const data: HLTBData = {
        mainMinutes: entry.gameplayMain ? Math.round(entry.gameplayMain * 60) : null,
        extraMinutes: entry.gameplayMainExtra ? Math.round(entry.gameplayMainExtra * 60) : null,
        completionistMinutes: entry.gameplayCompletionist ? Math.round(entry.gameplayCompletionist * 60) : null,
      };

      await db
        .update(gameCache)
        .set({
          hltbMainMinutes: data.mainMinutes,
          hltbExtraMinutes: data.extraMinutes,
          hltbCompletionistMinutes: data.completionistMinutes,
          cachedAt: new Date(),
        })
        .where(eq(gameCache.steamAppId, steamAppId));

      return data;
    });
  } catch {
    return null;
  }
}
