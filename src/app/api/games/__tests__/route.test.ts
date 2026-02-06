import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      update: () => {
        mockDbUpdate();
        return updateChain;
      },
    },
    userGames: { userId: "user_id", steamAppId: "steam_app_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import { PATCH } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockDbUpdate.mockReset();
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/games", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/games", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRequest({ steamAppId: 440, status: "playing" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when steamAppId is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = makeRequest({ status: "playing" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("updates game status successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = makeRequest({ steamAppId: 440, status: "playing" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("updates game priority", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = makeRequest({ steamAppId: 440, priority: 5 });
    const res = await PATCH(req);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("updates both status and priority", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = makeRequest({ steamAppId: 440, status: "completed", priority: 1 });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});
