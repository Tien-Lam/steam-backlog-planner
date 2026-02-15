import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbSelectLeftJoin = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockDbInsertValues = vi.fn();
const mockNotifySessionCreated = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: (...args: unknown[]) => mockDbSelectLeftJoin(...args),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const insertChain = {
    values: (...args: unknown[]) => mockDbInsertValues(...args),
  };
  return {
    db: {
      select: () => selectChain,
      insert: () => insertChain,
    },
    scheduledSessions: {
      userId: "user_id",
      startTime: "start_time",
      steamAppId: "steam_app_id",
      id: "id",
    },
    gameCache: { steamAppId: "steam_app_id", name: "name", headerImageUrl: "header_image_url" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((_c: unknown, v: unknown) => ({ gte: v })),
  lte: vi.fn((_c: unknown, v: unknown) => ({ lte: v })),
}));

vi.mock("@/lib/services/discord-notify", () => ({
  notifySessionCreated: (...args: unknown[]) => mockNotifySessionCreated(...args),
}));

vi.mock("@/lib/services/gcal-sync", () => ({
  syncSessionCreated: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockNotifySessionCreated.mockResolvedValue(undefined);
});

describe("GET /api/sessions", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/sessions");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns sessions with game data", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([
      {
        scheduled_sessions: {
          id: "s1",
          steamAppId: 440,
          startTime: "2025-03-15T18:00:00Z",
          endTime: "2025-03-15T19:00:00Z",
          completed: false,
          notes: null,
        },
        game_cache: {
          name: "TF2",
          headerImageUrl: "http://img.jpg",
        },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/sessions");
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].game.name).toBe("TF2");
  });

  it("handles sessions without game cache", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([
      {
        scheduled_sessions: { id: "s1", steamAppId: 999 },
        game_cache: null,
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/sessions");
    const res = await GET(req);
    const data = await res.json();
    expect(data[0].game).toBeNull();
  });

  it("validates invalid from date", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/sessions?from=not-a-date");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("validates invalid to date", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/sessions?to=not-a-date");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("passes date filters to query", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([]);
    const req = new NextRequest(
      "http://localhost:3000/api/sessions?from=2025-03-01&to=2025-03-31"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/sessions", () => {
  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ steamAppId: 440 }));
    expect(res.status).toBe(401);
  });

  it("validates steamAppId is required", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("validates startTime and endTime are required", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(makeRequest({ steamAppId: 440 }));
    expect(res.status).toBe(400);
  });

  it("validates endTime is after startTime", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(
      makeRequest({
        steamAppId: 440,
        startTime: "2025-03-15T19:00:00Z",
        endTime: "2025-03-15T18:00:00Z",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("endTime");
  });

  it("validates invalid date format", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(
      makeRequest({ steamAppId: 440, startTime: "bad", endTime: "bad" })
    );
    expect(res.status).toBe(400);
  });

  it("creates a session successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbSelectLimit.mockResolvedValue([{ name: "TF2", headerImageUrl: "http://img.jpg" }]);

    const res = await POST(
      makeRequest({
        steamAppId: 440,
        startTime: "2025-03-15T18:00:00Z",
        endTime: "2025-03-15T19:00:00Z",
        notes: "Test session",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
  });

  it("fires Discord notification after creating a session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbSelectLimit.mockResolvedValue([{ name: "TF2", headerImageUrl: "http://img.jpg" }]);

    await POST(
      makeRequest({
        steamAppId: 440,
        startTime: "2025-03-15T18:00:00Z",
        endTime: "2025-03-15T19:00:00Z",
      })
    );

    expect(mockNotifySessionCreated).toHaveBeenCalledWith("user-1", {
      gameName: "TF2",
      headerImageUrl: "http://img.jpg",
      startTime: new Date("2025-03-15T18:00:00Z"),
      endTime: new Date("2025-03-15T19:00:00Z"),
    });
  });

  it("skips Discord notification when no game cache", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbInsertValues.mockResolvedValue(undefined);
    mockDbSelectLimit.mockResolvedValue([]);

    await POST(
      makeRequest({
        steamAppId: 440,
        startTime: "2025-03-15T18:00:00Z",
        endTime: "2025-03-15T19:00:00Z",
      })
    );

    expect(mockNotifySessionCreated).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
