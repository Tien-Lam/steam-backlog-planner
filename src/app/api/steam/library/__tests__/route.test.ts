import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockFindMany = vi.fn();
const mockCachedFetch = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      select: () => selectChain,
      insert: () => insertChain,
      query: {
        userGames: {
          findMany: (...args: unknown[]) => mockFindMany(...args),
        },
      },
    },
    users: { id: "id", steamId: "steam_id" },
    userGames: { userId: "user_id", steamAppId: "steam_app_id" },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("@/lib/services/steam", () => ({
  getOwnedGames: vi.fn(),
  getGameHeaderUrl: (appId: number) =>
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
}));

vi.mock("@/lib/services/cache", () => ({
  cachedFetch: (...args: unknown[]) => mockCachedFetch(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { GET } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockDbSelectLimit.mockReset();
  mockFindMany.mockReset();
  mockCachedFetch.mockReset();
});

describe("GET /api/steam/library", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when user not found in DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe("User not found");
  });

  it("fetches games via cache and returns user library", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{ id: "user-1", steamId: "steam123" }]);
    mockCachedFetch.mockResolvedValue([
      { appid: 440, name: "TF2", playtime_forever: 100 },
    ]);
    const userGamesList = [{ steamAppId: 440, status: "backlog" }];
    mockFindMany.mockResolvedValue(userGamesList);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual(userGamesList);
  });

  it("calls cachedFetch with STEAM_LIBRARY category", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{ id: "user-1", steamId: "steam123" }]);
    mockCachedFetch.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    await GET();
    expect(mockCachedFetch).toHaveBeenCalledWith(
      "STEAM_LIBRARY",
      ["steam123"],
      expect.any(Function)
    );
  });
});
