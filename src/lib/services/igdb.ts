import { findGameBySteamAppId, getGameDetails } from "@/lib/services/igdb-client";
import { cachedFetch } from "@/lib/services/cache";
import { db, gameCache } from "@/lib/db";
import { eq } from "drizzle-orm";

export interface IGDBData {
  igdbId: number;
  genres: string[];
  rating: number | null;
  summary: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
}

function formatCoverUrl(url: string): string {
  const bigUrl = url.replace("t_thumb", "t_cover_big");
  return bigUrl.startsWith("//") ? `https:${bigUrl}` : bigUrl;
}

export async function getIGDBData(
  steamAppId: number
): Promise<IGDBData | null> {
  try {
    return await cachedFetch("GAME_METADATA", [steamAppId, "igdb"], async () => {
      const igdbId = await findGameBySteamAppId(steamAppId);
      if (!igdbId) return null;

      const details = await getGameDetails(igdbId);
      if (!details) return null;

      const genres = details.genres?.map((g) => g.name) ?? [];
      const rating = details.aggregated_rating
        ? Math.round(details.aggregated_rating)
        : null;
      const coverUrl = details.cover?.url
        ? formatCoverUrl(details.cover.url)
        : null;
      const releaseDate = details.first_release_date
        ? new Date(details.first_release_date * 1000).toISOString()
        : null;

      const data: IGDBData = {
        igdbId,
        genres,
        rating,
        summary: details.summary ?? null,
        coverUrl,
        releaseDate,
      };

      await db
        .update(gameCache)
        .set({
          igdbId,
          genres: JSON.stringify(genres),
          igdbRating: rating,
          summary: details.summary ?? null,
          coverUrl,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          cachedAt: new Date(),
        })
        .where(eq(gameCache.steamAppId, steamAppId));

      return data;
    });
  } catch {
    return null;
  }
}
