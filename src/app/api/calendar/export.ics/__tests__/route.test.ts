import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbSelectLeftJoin = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: (...args: unknown[]) => mockDbSelectLeftJoin(...args),
  };
  return {
    db: { select: () => selectChain },
    scheduledSessions: { userId: "user_id", steamAppId: "steam_app_id" },
    gameCache: { steamAppId: "steam_app_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
}));

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/calendar/export.ics", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns iCal content with correct headers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([
      {
        scheduled_sessions: {
          id: "s1",
          steamAppId: 440,
          startTime: new Date("2025-03-15T18:00:00Z"),
          endTime: new Date("2025-03-15T19:00:00Z"),
          notes: null,
        },
        game_cache: { name: "TF2" },
      },
    ]);

    const res = await GET();
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename=steam-backlog.ics");

    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).toContain("SUMMARY:TF2");
  });

  it("handles sessions without game cache", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([
      {
        scheduled_sessions: {
          id: "s1",
          steamAppId: 999,
          startTime: new Date("2025-03-15T18:00:00Z"),
          endTime: new Date("2025-03-15T19:00:00Z"),
          notes: null,
        },
        game_cache: null,
      },
    ]);

    const res = await GET();
    const text = await res.text();
    expect(text).toContain("SUMMARY:Game 999");
  });

  it("returns empty calendar when no sessions", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLeftJoin.mockResolvedValue([]);

    const res = await GET();
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
    expect(text).not.toContain("BEGIN:VEVENT");
  });
});
