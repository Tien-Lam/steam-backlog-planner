import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockDbInsertConflict = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: (...args: unknown[]) => mockDbInsertConflict(...args),
  };
  return {
    db: {
      select: () => selectChain,
      insert: () => insertChain,
    },
    userPreferences: { userId: "user_id" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { GET, PATCH } from "../route";

beforeEach(() => {
  mockAuth.mockReset();
  mockDbSelectLimit.mockReset();
  mockDbInsertConflict.mockReset();
});

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/preferences", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns defaults when no preferences exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({
      weeklyHours: 10,
      sessionLengthMinutes: 60,
      timezone: "UTC",
    });
  });

  it("returns saved preferences", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{
      userId: "user-1",
      weeklyHours: 20,
      sessionLengthMinutes: 90,
      timezone: "America/New_York",
    }]);

    const res = await GET();
    const data = await res.json();
    expect(data.weeklyHours).toBe(20);
    expect(data.sessionLengthMinutes).toBe(90);
    expect(data.timezone).toBe("America/New_York");
  });
});

describe("PATCH /api/preferences", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ weeklyHours: 15 }));
    expect(res.status).toBe(401);
  });

  it("validates weeklyHours range", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makePatchRequest({ weeklyHours: 200 }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("weeklyHours");
  });

  it("validates sessionLengthMinutes range", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makePatchRequest({ sessionLengthMinutes: 5 }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("sessionLengthMinutes");
  });

  it("validates timezone is non-empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makePatchRequest({ timezone: "" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("timezone");
  });

  it("rejects invalid timezone values", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makePatchRequest({ timezone: "Not/A/Timezone" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid timezone");
  });

  it("accepts valid IANA timezone", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbInsertConflict.mockResolvedValue(undefined);
    const res = await PATCH(makePatchRequest({ timezone: "America/New_York" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("upserts preferences on valid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbInsertConflict.mockResolvedValue(undefined);

    const res = await PATCH(makePatchRequest({ weeklyHours: 15, sessionLengthMinutes: 120 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDbInsertConflict).toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/preferences", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid JSON");
  });
});
