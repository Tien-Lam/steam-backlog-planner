import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet, mockDel } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  const RedisMock = vi.fn(function () {
    return { get: mockGet, set: mockSet, del: mockDel };
  });
  return { Redis: RedisMock };
});

import { getCached, setCache, invalidateCache, cachedFetch, TTL } from "../cache";

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockDel.mockReset();
});

describe("getCached", () => {
  it("returns cached data when present", async () => {
    mockGet.mockResolvedValue({ name: "TF2" });
    const result = await getCached("STEAM_LIBRARY", "123");
    expect(result).toEqual({ name: "TF2" });
    expect(mockGet).toHaveBeenCalledWith("sbp:STEAM_LIBRARY:123");
  });

  it("returns null when cache miss", async () => {
    mockGet.mockResolvedValue(null);
    expect(await getCached("STEAM_LIBRARY", "123")).toBeNull();
  });

  it("builds key with multiple parts", async () => {
    mockGet.mockResolvedValue(null);
    await getCached("STEAM_ACHIEVEMENTS", "user1", 440);
    expect(mockGet).toHaveBeenCalledWith("sbp:STEAM_ACHIEVEMENTS:user1:440");
  });
});

describe("setCache", () => {
  it("stores value with correct TTL", async () => {
    mockSet.mockResolvedValue(undefined);
    await setCache("STEAM_LIBRARY", { games: [] }, "123");
    expect(mockSet).toHaveBeenCalledWith(
      "sbp:STEAM_LIBRARY:123",
      { games: [] },
      { ex: TTL.STEAM_LIBRARY }
    );
  });

  it("uses achievement TTL for achievements", async () => {
    mockSet.mockResolvedValue(undefined);
    await setCache("STEAM_ACHIEVEMENTS", [], "user1", 440);
    expect(mockSet).toHaveBeenCalledWith(
      "sbp:STEAM_ACHIEVEMENTS:user1:440",
      [],
      { ex: TTL.STEAM_ACHIEVEMENTS }
    );
  });
});

describe("invalidateCache", () => {
  it("deletes the correct key", async () => {
    mockDel.mockResolvedValue(undefined);
    await invalidateCache("STEAM_LIBRARY", "123");
    expect(mockDel).toHaveBeenCalledWith("sbp:STEAM_LIBRARY:123");
  });
});

describe("cachedFetch", () => {
  it("returns cached value on hit", async () => {
    mockGet.mockResolvedValue([{ appid: 440 }]);
    const fetcher = vi.fn();
    const result = await cachedFetch("STEAM_LIBRARY", ["123"], fetcher);
    expect(result).toEqual([{ appid: 440 }]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls fetcher and caches on miss", async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
    const freshData = [{ appid: 730 }];
    const fetcher = vi.fn().mockResolvedValue(freshData);
    const result = await cachedFetch("STEAM_LIBRARY", ["456"], fetcher);
    expect(result).toEqual(freshData);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledOnce();
  });

  it("caches null results with sentinel to avoid re-fetching", async () => {
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
    const fetcher = vi.fn().mockResolvedValue(null);
    const result = await cachedFetch("HLTB_DATA", ["99999"], fetcher);
    expect(result).toBeNull();
    expect(mockSet).toHaveBeenCalledWith(
      "sbp:HLTB_DATA:99999",
      { __cacheNull: true },
      { ex: TTL.HLTB_DATA }
    );
  });

  it("returns null when sentinel is found in cache", async () => {
    mockGet.mockResolvedValue({ __cacheNull: true });
    const fetcher = vi.fn();
    const result = await cachedFetch("HLTB_DATA", ["99999"], fetcher);
    expect(result).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("TTL values", () => {
  it("has correct TTL for STEAM_LIBRARY", () => {
    expect(TTL.STEAM_LIBRARY).toBe(3600);
  });

  it("has correct TTL for STEAM_ACHIEVEMENTS", () => {
    expect(TTL.STEAM_ACHIEVEMENTS).toBe(1800);
  });

  it("has correct TTL for HLTB_DATA", () => {
    expect(TTL.HLTB_DATA).toBe(604800);
  });
});
