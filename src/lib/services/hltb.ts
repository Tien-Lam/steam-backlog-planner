import { searchHLTB } from "@/lib/services/hltb-client";
import { cachedFetch } from "@/lib/services/cache";
import { db, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface HLTBData {
  mainMinutes: number | null;
  extraMinutes: number | null;
  completionistMinutes: number | null;
}

function secondsToMinutes(seconds: number): number | null {
  return seconds > 0 ? Math.round(seconds / 60) : null;
}

export async function getHLTBData(
  gameName: string,
  steamAppId: number
): Promise<HLTBData | null> {
  try {
    return await cachedFetch("HLTB_DATA", [steamAppId], async () => {
      const results = await searchHLTB(gameName);

      if (!results.length) return null;

      const entry = results[0];
      const data: HLTBData = {
        mainMinutes: secondsToMinutes(entry.comp_main),
        extraMinutes: secondsToMinutes(entry.comp_plus),
        completionistMinutes: secondsToMinutes(entry.comp_100),
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
