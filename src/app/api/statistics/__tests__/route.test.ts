import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbWhere = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: (...args: unknown[]) => mockDbWhere(...args),
  };
  return {
    db: { select: () => selectChain },
    userAchievements: {
      userId: "user_id",
      steamAppId: "steam_app_id",
      achievedCount: "achieved_count",
      totalCount: "total_count",
    },
    gameCache: {
      steamAppId: "steam_app_id",
      name: "name",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/statistics", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty state when no achievements exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbWhere.mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.overallAchievements).toEqual({
      achieved: 0,
      total: 0,
      percentage: 0,
    });
    expect(data.perGame).toEqual([]);
  });

  it("aggregates achievement data across games", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbWhere.mockResolvedValue([
      { steamAppId: 440, achievedCount: 10, totalCount: 20, gameName: "TF2" },
      { steamAppId: 620, achievedCount: 5, totalCount: 10, gameName: "Portal 2" },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.overallAchievements).toEqual({
      achieved: 15,
      total: 30,
      percentage: 50,
    });
    expect(data.perGame).toHaveLength(2);
    expect(data.perGame[0].percentage).toBe(50);
    expect(data.perGame[1].percentage).toBe(50);
  });

  it("handles zero-division when totalCount is 0", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbWhere.mockResolvedValue([
      { steamAppId: 440, achievedCount: 0, totalCount: 0, gameName: "TF2" },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(data.overallAchievements.percentage).toBe(0);
    expect(data.perGame[0].percentage).toBe(0);
  });

  it("uses fallback game name when gameName is null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbWhere.mockResolvedValue([
      { steamAppId: 440, achievedCount: 5, totalCount: 10, gameName: null },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(data.perGame[0].gameName).toBe("Game 440");
  });
});
