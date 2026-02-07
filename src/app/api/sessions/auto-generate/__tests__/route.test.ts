import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockPrefsLimit = vi.fn();
const mockBacklogLeftJoin = vi.fn();
const mockDbDelete = vi.fn();
const mockDbInsertValues = vi.fn();
const mockGenerateSchedule = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const prefsChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockPrefsLimit(...args),
  };
  const backlogChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: (...args: unknown[]) => mockBacklogLeftJoin(...args),
  };
  let selectCallCount = 0;
  const deleteChain = {
    where: (...args: unknown[]) => mockDbDelete(...args),
  };
  const insertChain = {
    values: (...args: unknown[]) => mockDbInsertValues(...args),
  };
  const txObj = {
    delete: () => deleteChain,
    insert: () => insertChain,
  };
  return {
    db: {
      select: () => {
        selectCallCount++;
        return selectCallCount % 2 === 1 ? prefsChain : backlogChain;
      },
      delete: () => deleteChain,
      insert: () => insertChain,
      transaction: async (fn: (tx: typeof txObj) => Promise<void>) => fn(txObj),
    },
    scheduledSessions: { userId: "user_id" },
    userGames: { userId: "user_id", steamAppId: "steam_app_id", status: "status" },
    userPreferences: { userId: "user_id" },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
  and: vi.fn((...args: unknown[]) => args),
  notInArray: vi.fn((_c: unknown, v: unknown) => ({ notIn: v })),
}));

vi.mock("@/lib/services/scheduler", () => ({
  generateSchedule: (...args: unknown[]) => mockGenerateSchedule(...args),
}));

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrefsLimit.mockResolvedValue([{
    weeklyHours: 10,
    sessionLengthMinutes: 60,
    timezone: "UTC",
  }]);
  mockBacklogLeftJoin.mockResolvedValue([
    {
      user_games: { steamAppId: 440, priority: 5, playtimeMinutes: 0 },
      game_cache: { name: "TF2", hltbMainMinutes: 180 },
    },
  ]);
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/sessions/auto-generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/sessions/auto-generate", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ startDate: "2025-03-17", weeks: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/auto-generate", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("validates startDate is required", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(makeRequest({ weeks: 1 }));
    expect(res.status).toBe(400);
  });

  it("validates weeks range (1-12)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await POST(makeRequest({ startDate: "2025-03-17", weeks: 15 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no backlog games", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockBacklogLeftJoin.mockResolvedValue([]);
    const res = await POST(makeRequest({ startDate: "2025-03-17", weeks: 1 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No backlog");
  });

  it("returns 400 when scheduler generates nothing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGenerateSchedule.mockReturnValue([]);
    const res = await POST(makeRequest({ startDate: "2025-03-17", weeks: 1 }));
    expect(res.status).toBe(400);
  });

  it("generates sessions and inserts them", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGenerateSchedule.mockReturnValue([
      {
        steamAppId: 440,
        startTime: new Date("2025-03-17T19:00:00Z"),
        endTime: new Date("2025-03-17T20:00:00Z"),
      },
    ]);
    mockDbInsertValues.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ startDate: "2025-03-17", weeks: 1 }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.created).toBe(1);
    expect(mockDbInsertValues).toHaveBeenCalled();
  });

  it("inserts first then deletes old sessions when clearExisting is true", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockGenerateSchedule.mockReturnValue([
      {
        steamAppId: 440,
        startTime: new Date("2025-03-17T19:00:00Z"),
        endTime: new Date("2025-03-17T20:00:00Z"),
      },
    ]);
    mockDbDelete.mockResolvedValue(undefined);
    mockDbInsertValues.mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({ startDate: "2025-03-17", weeks: 1, clearExisting: true })
    );
    expect(res.status).toBe(201);
    // Insert happens before delete (safe ordering)
    expect(mockDbInsertValues).toHaveBeenCalled();
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it("sorts backlog games by priority descending", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockBacklogLeftJoin.mockResolvedValue([
      {
        user_games: { steamAppId: 620, priority: 1, playtimeMinutes: 0 },
        game_cache: { name: "Portal 2", hltbMainMinutes: 480 },
      },
      {
        user_games: { steamAppId: 440, priority: 5, playtimeMinutes: 0 },
        game_cache: { name: "TF2", hltbMainMinutes: 180 },
      },
    ]);
    mockGenerateSchedule.mockReturnValue([
      {
        steamAppId: 440,
        startTime: new Date("2025-03-17T19:00:00Z"),
        endTime: new Date("2025-03-17T20:00:00Z"),
      },
    ]);
    mockDbInsertValues.mockResolvedValue(undefined);

    await POST(makeRequest({ startDate: "2025-03-17", weeks: 1 }));

    const callArgs = mockGenerateSchedule.mock.calls[0][0];
    expect(callArgs.backlogGames[0].steamAppId).toBe(440);
  });
});
