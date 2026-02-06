import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockGetHLTBData = vi.fn();

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

vi.mock("@/lib/services/hltb", () => ({
  getHLTBData: (...args: unknown[]) => mockGetHLTBData(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { GET } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockDbSelectLimit.mockReset();
  mockGetHLTBData.mockReset();
});

function makeRequest(appId: string) {
  return new NextRequest(`http://localhost:3000/api/hltb/${appId}`);
}

describe("GET /api/hltb/[appId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest("440"), { params: Promise.resolve({ appId: "440" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid appId", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await GET(makeRequest("abc"), { params: Promise.resolve({ appId: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when game not in cache", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);
    const res = await GET(makeRequest("99999"), { params: Promise.resolve({ appId: "99999" }) });
    expect(res.status).toBe(404);
  });

  it("returns cached HLTB data if already present", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{
      steamAppId: 440,
      name: "TF2",
      hltbMainMinutes: 600,
      hltbExtraMinutes: 1200,
      hltbCompletionistMinutes: 2400,
    }]);

    const res = await GET(makeRequest("440"), { params: Promise.resolve({ appId: "440" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mainMinutes).toBe(600);
    expect(mockGetHLTBData).not.toHaveBeenCalled();
  });

  it("fetches HLTB data when not cached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{
      steamAppId: 440,
      name: "TF2",
      hltbMainMinutes: null,
    }]);
    mockGetHLTBData.mockResolvedValue({
      mainMinutes: 600,
      extraMinutes: 1200,
      completionistMinutes: 2400,
    });

    const res = await GET(makeRequest("440"), { params: Promise.resolve({ appId: "440" }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mainMinutes).toBe(600);
    expect(mockGetHLTBData).toHaveBeenCalledWith("TF2", 440);
  });

  it("returns 404 when HLTB data not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{
      steamAppId: 99999,
      name: "Unknown",
      hltbMainMinutes: null,
    }]);
    mockGetHLTBData.mockResolvedValue(null);

    const res = await GET(makeRequest("99999"), { params: Promise.resolve({ appId: "99999" }) });
    expect(res.status).toBe(404);
  });
});
