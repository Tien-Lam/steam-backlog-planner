import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  exchangeCodeForTokens,
  refreshAccessToken,
  tryRefreshAccessToken,
  isRefreshError,
  getUserEmail,
  createCalendar,
  createEvent,
  updateEvent,
  deleteEvent,
  revokeToken,
} from "../google-calendar";

beforeEach(() => {
  vi.clearAllMocks();
});

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function failRes(status = 400) {
  return { ok: false, status, json: async () => ({ error: "fail" }) };
}

describe("exchangeCodeForTokens", () => {
  it("exchanges code for tokens on success", async () => {
    mockFetch.mockResolvedValue(
      okJson({
        access_token: "at-123",
        refresh_token: "rt-456",
        expires_in: 3600,
      })
    );

    const result = await exchangeCodeForTokens("code-1", "cid", "csec", "http://localhost/cb");
    expect(result).toEqual({
      accessToken: "at-123",
      refreshToken: "rt-456",
      expiresIn: 3600,
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(opts.method).toBe("POST");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue(failRes());
    const result = await exchangeCodeForTokens("code-1", "cid", "csec", "http://localhost/cb");
    expect(result).toBeNull();
  });

  it("returns null when refresh_token missing", async () => {
    mockFetch.mockResolvedValue(okJson({ access_token: "at-123" }));
    const result = await exchangeCodeForTokens("code-1", "cid", "csec", "http://localhost/cb");
    expect(result).toBeNull();
  });

  it("defaults expiresIn to 3600 when not in response", async () => {
    mockFetch.mockResolvedValue(
      okJson({ access_token: "at", refresh_token: "rt" })
    );
    const result = await exchangeCodeForTokens("code-1", "cid", "csec", "http://localhost/cb");
    expect(result?.expiresIn).toBe(3600);
  });
});

describe("refreshAccessToken", () => {
  it("refreshes token on success", async () => {
    mockFetch.mockResolvedValue(
      okJson({ access_token: "new-at", expires_in: 1800 })
    );

    const result = await refreshAccessToken("rt-1", "cid", "csec");
    expect(result).toEqual({ accessToken: "new-at", expiresIn: 1800 });
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue(failRes(401));
    const result = await refreshAccessToken("rt-1", "cid", "csec");
    expect(result).toBeNull();
  });

  it("returns null when access_token missing", async () => {
    mockFetch.mockResolvedValue(okJson({ token_type: "Bearer" }));
    const result = await refreshAccessToken("rt-1", "cid", "csec");
    expect(result).toBeNull();
  });
});

describe("tryRefreshAccessToken", () => {
  it("returns token on success", async () => {
    mockFetch.mockResolvedValue(
      okJson({ access_token: "new-at", expires_in: 1800 })
    );
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(false);
    expect(result).toEqual({ accessToken: "new-at", expiresIn: 1800 });
  });

  it("returns permanent error on 401", async () => {
    mockFetch.mockResolvedValue(failRes(401));
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(true);
    if (isRefreshError(result)) {
      expect(result.permanent).toBe(true);
      expect(result.status).toBe(401);
    }
  });

  it("returns permanent error on 400 (invalid_grant)", async () => {
    mockFetch.mockResolvedValue(failRes(400));
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(true);
    if (isRefreshError(result)) {
      expect(result.permanent).toBe(true);
    }
  });

  it("returns transient error on 500", async () => {
    mockFetch.mockResolvedValue(failRes(500));
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(true);
    if (isRefreshError(result)) {
      expect(result.permanent).toBe(false);
      expect(result.status).toBe(500);
    }
  });

  it("returns transient error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(true);
    if (isRefreshError(result)) {
      expect(result.permanent).toBe(false);
    }
  });

  it("returns permanent error when access_token missing from OK response", async () => {
    mockFetch.mockResolvedValue(okJson({ token_type: "Bearer" }));
    const result = await tryRefreshAccessToken("rt-1", "cid", "csec");
    expect(isRefreshError(result)).toBe(true);
    if (isRefreshError(result)) {
      expect(result.permanent).toBe(true);
    }
  });
});

describe("getUserEmail", () => {
  it("returns email on success", async () => {
    mockFetch.mockResolvedValue(okJson({ email: "user@gmail.com" }));
    const result = await getUserEmail("at-1");
    expect(result).toBe("user@gmail.com");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer at-1");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue(failRes());
    const result = await getUserEmail("at-1");
    expect(result).toBeNull();
  });

  it("returns null when email missing from response", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "123" }));
    const result = await getUserEmail("at-1");
    expect(result).toBeNull();
  });
});

describe("createCalendar", () => {
  it("creates calendar and returns id", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "cal-id-123" }));
    const result = await createCalendar("at-1");
    expect(result).toEqual({ calendarId: "cal-id-123" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/calendars");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.summary).toBe("Steam Backlog Planner");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue(failRes());
    const result = await createCalendar("at-1");
    expect(result).toBeNull();
  });

  it("returns null when id missing from response", async () => {
    mockFetch.mockResolvedValue(okJson({ summary: "test" }));
    const result = await createCalendar("at-1");
    expect(result).toBeNull();
  });
});

describe("createEvent", () => {
  const eventData = {
    summary: "Play Portal 2",
    description: "Gaming session",
    startTime: new Date("2025-04-01T18:00:00Z"),
    endTime: new Date("2025-04-01T19:00:00Z"),
    timezone: "America/New_York",
  };

  it("creates event and returns eventId", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "evt-1" }));
    const result = await createEvent("at-1", "cal-1", eventData);
    expect(result).toEqual({ eventId: "evt-1" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/calendars/cal-1/events");
    const body = JSON.parse(opts.body);
    expect(body.summary).toBe("Play Portal 2");
    expect(body.start.timeZone).toBe("America/New_York");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValue(failRes());
    const result = await createEvent("at-1", "cal-1", eventData);
    expect(result).toBeNull();
  });

  it("encodes calendarId in URL", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "evt-1" }));
    await createEvent("at-1", "user@group.calendar.google.com", eventData);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain(encodeURIComponent("user@group.calendar.google.com"));
  });

  it("uses empty string for description when not provided", async () => {
    mockFetch.mockResolvedValue(okJson({ id: "evt-1" }));
    await createEvent("at-1", "cal-1", { ...eventData, description: undefined });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.description).toBe("");
  });
});

describe("updateEvent", () => {
  const eventData = {
    summary: "Play TF2",
    startTime: new Date("2025-04-01T18:00:00Z"),
    endTime: new Date("2025-04-01T19:00:00Z"),
    timezone: "UTC",
  };

  it("returns true on success", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const result = await updateEvent("at-1", "cal-1", "evt-1", eventData);
    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/events/evt-1");
    expect(opts.method).toBe("PUT");
  });

  it("returns false on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await updateEvent("at-1", "cal-1", "evt-1", eventData);
    expect(result).toBe(false);
  });
});

describe("deleteEvent", () => {
  it("returns true on 204 success", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });
    const result = await deleteEvent("at-1", "cal-1", "evt-1");
    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/events/evt-1");
    expect(opts.method).toBe("DELETE");
  });

  it("returns true on 410 gone (already deleted)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 410 });
    const result = await deleteEvent("at-1", "cal-1", "evt-1");
    expect(result).toBe(true);
  });

  it("returns false on other errors", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await deleteEvent("at-1", "cal-1", "evt-1");
    expect(result).toBe(false);
  });
});

describe("revokeToken", () => {
  it("returns true on success", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const result = await revokeToken("at-1");
    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("revoke?token=at-1");
    expect(opts.method).toBe("POST");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });
    const result = await revokeToken("at-1");
    expect(result).toBe(false);
  });

  it("URL-encodes the token", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    await revokeToken("token+with/special=chars");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain(encodeURIComponent("token+with/special=chars"));
  });
});
