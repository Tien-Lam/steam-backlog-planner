import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: (...args: unknown[]) => mockUpdate(...args),
  };
  return {
    db: {
      update: () => updateChain,
    },
    userGames: { userId: "user_id", steamAppId: "steam_app_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import { PATCH } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockUpdate.mockReset();
  mockUpdate.mockResolvedValue(undefined);
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/games/batch", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/games/batch", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ updates: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/games/batch", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
  });

  it("returns 400 when updates is not an array", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makeRequest({ updates: "not-array" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("non-empty array");
  });

  it("returns 400 when updates is empty", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makeRequest({ updates: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("non-empty array");
  });

  it("returns 400 for negative priority", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makeRequest({ updates: [{ steamAppId: 440, priority: -1 }] })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Invalid update");
  });

  it("returns 400 for non-integer priority", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makeRequest({ updates: [{ steamAppId: 440, priority: 2.5 }] })
    );
    expect(res.status).toBe(400);
  });

  it("updates all games sequentially", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makeRequest({
        updates: [
          { steamAppId: 440, priority: 3 },
          { steamAppId: 730, priority: 2 },
          { steamAppId: 570, priority: 1 },
        ],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updated).toBe(3);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("returns 400 when exceeding 500 updates", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const updates = Array.from({ length: 501 }, (_, i) => ({
      steamAppId: i,
      priority: i,
    }));
    const res = await PATCH(makeRequest({ updates }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Too many");
  });
});
