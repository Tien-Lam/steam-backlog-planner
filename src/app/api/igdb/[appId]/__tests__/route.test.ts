import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockGetIGDBData = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  return {
    db: { select: () => selectChain },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("@/lib/services/igdb", () => ({
  getIGDBData: (...args: unknown[]) => mockGetIGDBData(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { GET } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockDbSelectLimit.mockReset();
  mockGetIGDBData.mockReset();
});

function makeRequest(appId: string) {
  return new NextRequest(`http://localhost:3000/api/igdb/${appId}`);
}

describe("GET /api/igdb/[appId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("440"), {
      params: Promise.resolve({ appId: "440" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid appId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await GET(makeRequest("abc"), {
      params: Promise.resolve({ appId: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when game not in cache", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);
    const res = await GET(makeRequest("99999"), {
      params: Promise.resolve({ appId: "99999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns cached IGDB data when fresh", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      {
        steamAppId: 440,
        igdbId: 1942,
        genres: '["Shooter","Action"]',
        igdbRating: 93,
        summary: "A great game",
        coverUrl: "https://images.igdb.com/t_cover_big/co1234.jpg",
        releaseDate: new Date("2007-10-10T00:00:00Z"),
        cachedAt: new Date(),
      },
    ]);

    const res = await GET(makeRequest("440"), {
      params: Promise.resolve({ appId: "440" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.igdbId).toBe(1942);
    expect(data.genres).toEqual(["Shooter", "Action"]);
    expect(data.rating).toBe(93);
    expect(mockGetIGDBData).not.toHaveBeenCalled();
  });

  it("re-fetches when cache is stale (>30 days)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    mockDbSelectLimit.mockResolvedValue([
      {
        steamAppId: 440,
        igdbId: 1942,
        genres: '["Shooter"]',
        igdbRating: 90,
        summary: "Old data",
        coverUrl: null,
        releaseDate: null,
        cachedAt: staleDate,
      },
    ]);
    mockGetIGDBData.mockResolvedValue({
      igdbId: 1942,
      genres: ["Shooter", "FPS"],
      rating: 93,
      summary: "Updated summary",
      coverUrl: "https://images.igdb.com/t_cover_big/co5678.jpg",
      releaseDate: "2007-10-10T00:00:00.000Z",
    });

    const res = await GET(makeRequest("440"), {
      params: Promise.resolve({ appId: "440" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rating).toBe(93);
    expect(mockGetIGDBData).toHaveBeenCalledWith(440);
  });

  it("fetches IGDB data when igdbId is null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      {
        steamAppId: 440,
        name: "TF2",
        igdbId: null,
        cachedAt: new Date(),
      },
    ]);
    mockGetIGDBData.mockResolvedValue({
      igdbId: 1942,
      genres: ["FPS"],
      rating: 85,
      summary: "Team-based shooter",
      coverUrl: null,
      releaseDate: null,
    });

    const res = await GET(makeRequest("440"), {
      params: Promise.resolve({ appId: "440" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.igdbId).toBe(1942);
    expect(mockGetIGDBData).toHaveBeenCalledWith(440);
  });

  it("returns 404 when IGDB data not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      { steamAppId: 99999, name: "Unknown", igdbId: null, cachedAt: new Date() },
    ]);
    mockGetIGDBData.mockResolvedValue(null);

    const res = await GET(makeRequest("99999"), {
      params: Promise.resolve({ appId: "99999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns empty genres array when genres is null", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([
      {
        steamAppId: 440,
        igdbId: 100,
        genres: null,
        igdbRating: null,
        summary: null,
        coverUrl: null,
        releaseDate: null,
        cachedAt: new Date(),
      },
    ]);

    const res = await GET(makeRequest("440"), {
      params: Promise.resolve({ appId: "440" }),
    });
    const data = await res.json();
    expect(data.genres).toEqual([]);
  });
});
