import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockCachedFetch = vi.fn();
const mockGetPlayerAchievements = vi.fn();
const mockGetSchemaForGame = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      select: () => {
        const result = mockDbSelect();
        selectChain.limit = vi.fn().mockResolvedValue(result);
        return selectChain;
      },
      insert: () => {
        mockDbInsert();
        return insertChain;
      },
      update: () => {
        mockDbUpdate();
        return updateChain;
      },
    },
    users: { id: "id", steamId: "steam_id" },
    userAchievements: { userId: "user_id", steamAppId: "steam_app_id" },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("@/lib/services/steam", () => ({
  getPlayerAchievements: (...args: unknown[]) => mockGetPlayerAchievements(...args),
  getSchemaForGame: (...args: unknown[]) => mockGetSchemaForGame(...args),
}));

vi.mock("@/lib/services/cache", () => ({
  cachedFetch: (...args: unknown[]) => mockCachedFetch(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import { GET } from "../route";

function makeRequest(appId: string) {
  const req = new NextRequest("http://localhost:3000/api/steam/achievements/" + appId);
  const params = Promise.resolve({ appId });
  return { req, params };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockDbSelect.mockReset();
  mockDbInsert.mockReset();
  mockDbUpdate.mockReset();
  mockCachedFetch.mockReset();
  mockGetPlayerAchievements.mockReset();
  mockGetSchemaForGame.mockReset();
});

describe("GET /api/steam/achievements/[appId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid appId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const { req, params } = makeRequest("notanumber");
    const res = await GET(req, { params });
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found in DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([]);
    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns 404 when no achievements found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([{ id: "user-1", steamId: "steam123" }]);
    mockCachedFetch.mockResolvedValue(null);
    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns enriched achievements and updates DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([{ id: "user-1", steamId: "steam123" }]);
    const result = {
      gameName: "TF2",
      achievements: [
        { apiname: "ach1", achieved: 1, unlocktime: 100, name: "First", description: "Desc", icon: "icon.png" },
        { apiname: "ach2", achieved: 0, unlocktime: 0, name: "Second", description: "", icon: "gray.png" },
      ],
    };
    mockCachedFetch.mockResolvedValue(result);
    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.gameName).toBe("TF2");
    expect(data.achievements).toHaveLength(2);
  });

  it("the fetcher enriches achievements with schema data", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([{ id: "user-1", steamId: "steam123" }]);

    // Make cachedFetch call the fetcher
    mockCachedFetch.mockImplementation(async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => {
      return fetcher();
    });

    mockGetPlayerAchievements.mockResolvedValue({
      gameName: "TF2",
      achievements: [
        { apiname: "ACH_1", achieved: 1, unlocktime: 100 },
        { apiname: "ACH_2", achieved: 0, unlocktime: 0 },
      ],
    });
    mockGetSchemaForGame.mockResolvedValue([
      { name: "ACH_1", displayName: "First Blood", description: "Get first kill", icon: "icon1.png", icongray: "gray1.png" },
      { name: "ACH_2", displayName: "Double Kill", description: "Get double kill", icon: "icon2.png", icongray: "gray2.png" },
    ]);

    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.gameName).toBe("TF2");
    expect(data.achievements[0].name).toBe("First Blood");
    expect(data.achievements[0].icon).toBe("icon1.png");
    expect(data.achievements[1].name).toBe("Double Kill");
    expect(data.achievements[1].icon).toBe("gray2.png");
  });

  it("the fetcher returns null when no player achievements", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([{ id: "user-1", steamId: "steam123" }]);

    mockCachedFetch.mockImplementation(async (_cat: string, _keys: unknown[], fetcher: () => Promise<unknown>) => {
      return fetcher();
    });

    mockGetPlayerAchievements.mockResolvedValue(null);
    mockGetSchemaForGame.mockResolvedValue([]);

    const { req, params } = makeRequest("440");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("calls cachedFetch with STEAM_ACHIEVEMENTS", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelect.mockReturnValue([{ id: "user-1", steamId: "steam123" }]);
    mockCachedFetch.mockResolvedValue(null);
    const { req, params } = makeRequest("440");
    await GET(req, { params });
    expect(mockCachedFetch).toHaveBeenCalledWith(
      "STEAM_ACHIEVEMENTS",
      ["steam123", 440],
      expect.any(Function)
    );
  });
});
