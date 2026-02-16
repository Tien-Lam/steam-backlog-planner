import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelectLimit = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockRefreshAccessToken = vi.fn();

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const updateChain = {
    set: (...args: unknown[]) => {
      mockDbUpdateSet(...args);
      return {
        where: (...wargs: unknown[]) => mockDbUpdateWhere(...wargs),
      };
    },
  };
  return {
    db: {
      select: () => selectChain,
      update: () => updateChain,
    },
    userPreferences: {
      userId: "user_id",
      googleCalendarSyncEnabled: "gcal_sync",
      googleAccessToken: "gcal_at",
      googleRefreshToken: "gcal_rt",
      googleTokenExpiry: "gcal_exp",
      googleCalendarId: "gcal_cid",
      timezone: "timezone",
    },
    scheduledSessions: {
      id: "id",
      googleCalendarEventId: "gcal_event_id",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
}));

const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock("@/lib/services/cache", () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
  },
}));

vi.mock("../google-calendar", () => ({
  tryRefreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
  isRefreshError: (r: unknown) => typeof r === "object" && r !== null && "permanent" in r,
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
}));

import {
  getGoogleCalendarConfig,
  syncSessionCreated,
  syncSessionUpdated,
  syncSessionDeleted,
  syncAutoGenerate,
} from "../gcal-sync";

const validPrefs = {
  enabled: true,
  accessToken: "at-valid",
  refreshToken: "rt-valid",
  tokenExpiry: new Date(Date.now() + 3600_000),
  calendarId: "cal-123",
  timezone: "America/New_York",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "csec";
  mockDbUpdateWhere.mockResolvedValue(undefined);
  mockRedisSet.mockResolvedValue("OK");
  mockRedisDel.mockResolvedValue(1);
  mockRedisIncr.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(true);
});

describe("getGoogleCalendarConfig", () => {
  it("returns config when enabled with valid tokens", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    const config = await getGoogleCalendarConfig("u1");
    expect(config).toEqual({
      accessToken: "at-valid",
      calendarId: "cal-123",
      timezone: "America/New_York",
    });
  });

  it("returns null when no prefs row", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    expect(await getGoogleCalendarConfig("u1")).toBeNull();
  });

  it("returns null when sync disabled", async () => {
    mockDbSelectLimit.mockResolvedValue([{ ...validPrefs, enabled: false }]);
    expect(await getGoogleCalendarConfig("u1")).toBeNull();
  });

  it("returns null when accessToken missing", async () => {
    mockDbSelectLimit.mockResolvedValue([{ ...validPrefs, accessToken: null }]);
    expect(await getGoogleCalendarConfig("u1")).toBeNull();
  });

  it("returns null when calendarId missing", async () => {
    mockDbSelectLimit.mockResolvedValue([{ ...validPrefs, calendarId: null }]);
    expect(await getGoogleCalendarConfig("u1")).toBeNull();
  });

  it("refreshes expired token and persists new one", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    const config = await getGoogleCalendarConfig("u1");
    expect(config?.accessToken).toBe("new-at");
    expect(mockRefreshAccessToken).toHaveBeenCalledWith("rt-valid", "cid", "csec");
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ googleAccessToken: "new-at" })
    );
  });

  it("disables sync immediately on permanent refresh failure (token revoked)", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ permanent: true, status: 401 });

    const config = await getGoogleCalendarConfig("u1");
    expect(config).toBeNull();
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ googleCalendarSyncEnabled: false })
    );
  });

  it("returns null when env vars missing for refresh", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);

    expect(await getGoogleCalendarConfig("u1")).toBeNull();
  });

  it("acquires Redis lock before refreshing token", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    await getGoogleCalendarConfig("u1");
    expect(mockRedisSet).toHaveBeenCalledWith(
      "sbp:gcal-token-refresh:u1",
      "1",
      { nx: true, ex: 30 }
    );
  });

  it("returns null when lock not acquired (contention)", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRedisSet.mockResolvedValue(null);

    const config = await getGoogleCalendarConfig("u1");
    expect(config).toBeNull();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("releases lock after successful refresh", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    await getGoogleCalendarConfig("u1");
    expect(mockRedisDel).toHaveBeenCalledWith("sbp:gcal-token-refresh:u1");
  });

  it("releases lock even when refresh fails", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ permanent: true, status: 401 });

    await getGoogleCalendarConfig("u1");
    expect(mockRedisDel).toHaveBeenCalledWith("sbp:gcal-token-refresh:u1");
  });

  it("proceeds without lock when Redis set fails (fail-open)", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRedisSet.mockRejectedValue(new Error("Redis down"));
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    const config = await getGoogleCalendarConfig("u1");
    expect(config?.accessToken).toBe("new-at");
  });

  it("tracks transient failures in Redis counter", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ permanent: false, status: 500 });
    mockRedisIncr.mockResolvedValue(1);

    const config = await getGoogleCalendarConfig("u1");
    expect(config).toBeNull();
    expect(mockRedisIncr).toHaveBeenCalledWith("sbp:gcal-refresh-failures:u1");
    expect(mockRedisExpire).toHaveBeenCalledWith("sbp:gcal-refresh-failures:u1", 86400);
    // Should NOT disable sync on first failure
    expect(mockDbUpdateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ googleCalendarSyncEnabled: false })
    );
  });

  it("disables sync after 3 consecutive transient failures", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ permanent: false, status: 503 });
    mockRedisIncr.mockResolvedValue(3);

    const config = await getGoogleCalendarConfig("u1");
    expect(config).toBeNull();
    expect(mockDbUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ googleCalendarSyncEnabled: false })
    );
  });

  it("clears failure counter on successful refresh", async () => {
    const expired = { ...validPrefs, tokenExpiry: new Date(Date.now() - 60_000) };
    mockDbSelectLimit.mockResolvedValue([expired]);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    await getGoogleCalendarConfig("u1");
    expect(mockRedisDel).toHaveBeenCalledWith("sbp:gcal-refresh-failures:u1");
  });

  it("refreshes token within 60s of expiry", async () => {
    const almostExpired = {
      ...validPrefs,
      tokenExpiry: new Date(Date.now() + 30_000),
    };
    mockDbSelectLimit.mockResolvedValue([almostExpired]);
    mockRefreshAccessToken.mockResolvedValue({ accessToken: "new-at", expiresIn: 3600 });

    const config = await getGoogleCalendarConfig("u1");
    expect(config?.accessToken).toBe("new-at");
  });
});

describe("syncSessionCreated", () => {
  const data = {
    gameName: "Portal 2",
    startTime: new Date("2025-04-01T18:00:00Z"),
    endTime: new Date("2025-04-01T19:00:00Z"),
    notes: "Fun session",
  };

  it("creates event and stores eventId on session", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    mockCreateEvent.mockResolvedValue({ eventId: "evt-1" });

    await syncSessionCreated("u1", "sess-1", data);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      "at-valid",
      "cal-123",
      expect.objectContaining({ summary: "Portal 2" })
    );
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: "evt-1" });
  });

  it("does nothing when sync not configured", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    await syncSessionCreated("u1", "sess-1", data);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("does not store eventId when createEvent fails", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    mockCreateEvent.mockResolvedValue(null);

    await syncSessionCreated("u1", "sess-1", data);
    expect(mockDbUpdateSet).not.toHaveBeenCalled();
  });
});

describe("syncSessionUpdated", () => {
  const data = {
    gameName: "TF2",
    startTime: new Date("2025-04-01T18:00:00Z"),
    endTime: new Date("2025-04-01T20:00:00Z"),
  };

  it("updates existing calendar event", async () => {
    // First call: getConfig, second call: get session eventId
    mockDbSelectLimit
      .mockResolvedValueOnce([validPrefs])
      .mockResolvedValueOnce([{ googleCalendarEventId: "evt-existing" }]);
    mockUpdateEvent.mockResolvedValue(true);

    await syncSessionUpdated("u1", "sess-1", data);
    expect(mockUpdateEvent).toHaveBeenCalledWith(
      "at-valid", "cal-123", "evt-existing",
      expect.objectContaining({ summary: "TF2" })
    );
  });

  it("creates new event when session has no eventId", async () => {
    mockDbSelectLimit
      .mockResolvedValueOnce([validPrefs])
      .mockResolvedValueOnce([{ googleCalendarEventId: null }]);
    mockCreateEvent.mockResolvedValue({ eventId: "new-evt" });

    await syncSessionUpdated("u1", "sess-1", data);
    expect(mockCreateEvent).toHaveBeenCalled();
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: "new-evt" });
  });

  it("does nothing when sync not configured", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    await syncSessionUpdated("u1", "sess-1", data);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});

describe("syncSessionDeleted", () => {
  it("deletes calendar event", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    mockDeleteEvent.mockResolvedValue(true);

    await syncSessionDeleted("u1", "evt-to-delete");
    expect(mockDeleteEvent).toHaveBeenCalledWith("at-valid", "cal-123", "evt-to-delete");
  });

  it("does nothing when eventId is null", async () => {
    await syncSessionDeleted("u1", null);
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it("does nothing when sync not configured", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    await syncSessionDeleted("u1", "evt-1");
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });
});

describe("syncAutoGenerate", () => {
  const sessions = [
    { id: "s1", gameName: "Game A", startTime: new Date("2025-04-01T18:00:00Z"), endTime: new Date("2025-04-01T19:00:00Z") },
    { id: "s2", gameName: "Game B", startTime: new Date("2025-04-02T18:00:00Z"), endTime: new Date("2025-04-02T19:00:00Z") },
  ];

  it("creates events for all sessions and writes eventIds", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    mockCreateEvent
      .mockResolvedValueOnce({ eventId: "evt-a" })
      .mockResolvedValueOnce({ eventId: "evt-b" });

    await syncAutoGenerate("u1", sessions);

    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: "evt-a" });
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: "evt-b" });
  });

  it("does nothing when sync not configured", async () => {
    mockDbSelectLimit.mockResolvedValue([]);
    await syncAutoGenerate("u1", sessions);
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("continues creating events even if one fails", async () => {
    mockDbSelectLimit.mockResolvedValue([validPrefs]);
    mockCreateEvent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ eventId: "evt-b" });

    await syncAutoGenerate("u1", sessions);
    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
    // Only the second one should have set eventId
    expect(mockDbUpdateSet).toHaveBeenCalledTimes(1);
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ googleCalendarEventId: "evt-b" });
  });
});
