import { describe, it, expect, afterEach } from "vitest";
import {
  getCached,
  setCache,
  invalidateCache,
  cachedFetch,
  redis,
} from "@/lib/services/cache";

const TEST_PREFIX = `live-test-${Date.now()}`;

function testKey(suffix: string): string {
  return `sbp:GAME_METADATA:${TEST_PREFIX}:${suffix}`;
}

const createdKeys: string[] = [];

function trackKey(suffix: string): string {
  const key = testKey(suffix);
  createdKeys.push(key);
  return key;
}

afterEach(async () => {
  for (const key of createdKeys) {
    await redis.del(key);
  }
  createdKeys.length = 0;
});

describe("Redis cache (live)", () => {
  it("setCache + getCached round-trip", async () => {
    const _key = trackKey("roundtrip");
    const data = { name: "Portal 2", appId: 620 };

    await setCache("GAME_METADATA", data, TEST_PREFIX, "roundtrip");
    const result = await getCached("GAME_METADATA", TEST_PREFIX, "roundtrip");

    expect(result).toEqual(data);
  });

  it("invalidateCache removes a cached entry", async () => {
    const _key = trackKey("invalidate");
    await setCache("GAME_METADATA", { test: true }, TEST_PREFIX, "invalidate");

    await invalidateCache("GAME_METADATA", TEST_PREFIX, "invalidate");

    const result = await getCached("GAME_METADATA", TEST_PREFIX, "invalidate");
    expect(result).toBeNull();
  });

  it("cachedFetch calls fetcher on miss and stores result", async () => {
    const _key = trackKey("fetch-miss");
    let fetcherCalled = false;

    const result = await cachedFetch(
      "GAME_METADATA",
      [TEST_PREFIX, "fetch-miss"],
      async () => {
        fetcherCalled = true;
        return { value: 42 };
      }
    );

    expect(fetcherCalled).toBe(true);
    expect(result).toEqual({ value: 42 });

    const cached = await getCached("GAME_METADATA", TEST_PREFIX, "fetch-miss");
    expect(cached).toEqual({ value: 42 });
  });

  it("cachedFetch returns cached value on hit without calling fetcher", async () => {
    const _key = trackKey("fetch-hit");
    await setCache("GAME_METADATA", { cached: true }, TEST_PREFIX, "fetch-hit");

    let fetcherCalled = false;
    const result = await cachedFetch(
      "GAME_METADATA",
      [TEST_PREFIX, "fetch-hit"],
      async () => {
        fetcherCalled = true;
        return { cached: false };
      }
    );

    expect(fetcherCalled).toBe(false);
    expect(result).toEqual({ cached: true });
  });

  it("cachedFetch stores null sentinel when fetcher returns null", async () => {
    const _key = trackKey("null-sentinel");
    let callCount = 0;

    const result1 = await cachedFetch(
      "GAME_METADATA",
      [TEST_PREFIX, "null-sentinel"],
      async () => {
        callCount++;
        return null as unknown as object;
      }
    );

    expect(result1).toBeNull();
    expect(callCount).toBe(1);

    const result2 = await cachedFetch(
      "GAME_METADATA",
      [TEST_PREFIX, "null-sentinel"],
      async () => {
        callCount++;
        return { shouldNotReturn: true };
      }
    );

    expect(result2).toBeNull();
    expect(callCount).toBe(1);
  });

  it("cached entries have a positive TTL", async () => {
    const key = trackKey("ttl-check");
    await setCache("GAME_METADATA", { ttl: true }, TEST_PREFIX, "ttl-check");

    const fullKey = `sbp:GAME_METADATA:${TEST_PREFIX}:ttl-check`;
    const ttl = await redis.ttl(fullKey);
    expect(ttl).toBeGreaterThan(0);
  });

  it("getCached returns null for a non-existent key", async () => {
    const result = await getCached(
      "GAME_METADATA",
      TEST_PREFIX,
      "does-not-exist"
    );
    expect(result).toBeNull();
  });

  it("setCache overwrites existing value", async () => {
    const _key = trackKey("overwrite");
    await setCache("GAME_METADATA", { v: 1 }, TEST_PREFIX, "overwrite");
    await setCache("GAME_METADATA", { v: 2 }, TEST_PREFIX, "overwrite");

    const result = await getCached("GAME_METADATA", TEST_PREFIX, "overwrite");
    expect(result).toEqual({ v: 2 });
  });
});
