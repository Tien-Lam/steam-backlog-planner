import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TTL = {
  STEAM_LIBRARY: 60 * 60,          // 1 hour
  STEAM_ACHIEVEMENTS: 30 * 60,     // 30 minutes
  HLTB_DATA: 7 * 24 * 60 * 60,    // 7 days
  GAME_METADATA: 24 * 60 * 60,    // 24 hours
  PLAYER_PROFILE: 6 * 60 * 60,    // 6 hours
} as const;

export type CacheCategory = keyof typeof TTL;

function buildKey(category: string, ...parts: (string | number)[]): string {
  return `sbp:${category}:${parts.join(":")}`;
}

export async function getCached<T>(
  category: CacheCategory,
  ...keyParts: (string | number)[]
): Promise<T | null> {
  const key = buildKey(category, ...keyParts);
  const data = await redis.get<T>(key);
  return data;
}

export async function setCache<T>(
  category: CacheCategory,
  value: T,
  ...keyParts: (string | number)[]
): Promise<void> {
  const key = buildKey(category, ...keyParts);
  await redis.set(key, value, { ex: TTL[category] });
}

export async function invalidateCache(
  category: CacheCategory,
  ...keyParts: (string | number)[]
): Promise<void> {
  const key = buildKey(category, ...keyParts);
  await redis.del(key);
}

export async function cachedFetch<T>(
  category: CacheCategory,
  keyParts: (string | number)[],
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await getCached<T>(category, ...keyParts);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await setCache(category, fresh, ...keyParts);
  return fresh;
}

export { redis, TTL };
