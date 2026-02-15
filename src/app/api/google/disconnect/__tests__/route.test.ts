import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/services/google-calendar", () => ({
  revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const updateChain = {
    set: (...args: unknown[]) => {
      mockDbUpdateSet(...args);
      return updateChain;
    },
    where: vi.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      select: () => selectChain,
      update: () => updateChain,
    },
    userPreferences: {
      userId: "user_id",
      googleAccessToken: "google_access_token",
      googleRefreshToken: "google_refresh_token",
    },
    scheduledSessions: {
      userId: "user_id",
      googleCalendarEventId: "gcal_event_id",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
}));

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/google/disconnect", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("revokes both tokens and clears DB fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDbSelectLimit.mockResolvedValue([
      { accessToken: "at-1", refreshToken: "rt-1" },
    ]);
    mockRevokeToken.mockResolvedValue(true);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockRevokeToken).toHaveBeenCalledWith("at-1");
    expect(mockRevokeToken).toHaveBeenCalledWith("rt-1");
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleCalendarSyncEnabled: false,
      })
    );
    // Also clears event IDs from sessions
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: null });
  });

  it("succeeds even when no tokens in DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDbSelectLimit.mockResolvedValue([
      { accessToken: null, refreshToken: null },
    ]);

    const res = await POST();
    expect(res.status).toBe(200);
    expect(mockRevokeToken).not.toHaveBeenCalled();
  });

  it("succeeds even when revoke fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDbSelectLimit.mockResolvedValue([
      { accessToken: "at-1", refreshToken: "rt-1" },
    ]);
    mockRevokeToken.mockRejectedValue(new Error("network error"));

    const res = await POST();
    expect(res.status).toBe(200);
  });

  it("succeeds when no prefs row exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockDbSelectLimit.mockResolvedValue([]);

    const res = await POST();
    expect(res.status).toBe(200);
  });
});
