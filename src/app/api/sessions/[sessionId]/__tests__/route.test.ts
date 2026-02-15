import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockDbUpdateReturning = vi.fn();
const mockDbDeleteReturning = vi.fn();
const mockDbSelectLimit = vi.fn();
const mockNotifySessionCompleted = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...args: unknown[]) => mockDbSelectLimit(...args),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: (...args: unknown[]) => mockDbUpdateReturning(...args),
  };
  const deleteChain = {
    where: vi.fn().mockReturnThis(),
    returning: (...args: unknown[]) => mockDbDeleteReturning(...args),
  };
  return {
    db: {
      select: () => selectChain,
      update: () => updateChain,
      delete: () => deleteChain,
    },
    scheduledSessions: {
      id: "id",
      userId: "user_id",
      steamAppId: "steam_app_id",
    },
    gameCache: { steamAppId: "steam_app_id", name: "name", headerImageUrl: "header_image_url" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => v),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/services/discord-notify", () => ({
  notifySessionCompleted: (...args: unknown[]) => mockNotifySessionCompleted(...args),
}));

vi.mock("@/lib/services/gcal-sync", () => ({
  syncSessionUpdated: vi.fn().mockResolvedValue(undefined),
  syncSessionDeleted: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH, DELETE } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  mockNotifySessionCompleted.mockResolvedValue(undefined);
  mockDbSelectLimit.mockResolvedValue([{
    id: "session-1",
    startTime: new Date("2025-03-15T18:00:00Z"),
    endTime: new Date("2025-03-15T19:00:00Z"),
  }]);
});

const sessionParams = Promise.resolve({ sessionId: "session-1" });

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/sessions/session-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PATCH /api/sessions/[sessionId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({}), { params: sessionParams });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost:3000/api/sessions/s1", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: sessionParams });
    expect(res.status).toBe(400);
  });

  it("returns 400 for no fields to update", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(makePatchRequest({}), { params: sessionParams });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No fields");
  });

  it("validates invalid startTime", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makePatchRequest({ startTime: "bad-date" }),
      { params: sessionParams }
    );
    expect(res.status).toBe(400);
  });

  it("validates endTime must be after startTime when both provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makePatchRequest({
        startTime: "2025-03-15T19:00:00Z",
        endTime: "2025-03-15T18:00:00Z",
      }),
      { params: sessionParams }
    );
    expect(res.status).toBe(400);
  });

  it("validates endTime against existing startTime when only endTime provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([{
      startTime: new Date("2025-03-15T20:00:00Z"),
      endTime: new Date("2025-03-15T21:00:00Z"),
    }]);
    const res = await PATCH(
      makePatchRequest({ endTime: "2025-03-15T19:00:00Z" }),
      { params: sessionParams }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found during cross-validation", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbSelectLimit.mockResolvedValue([]);
    const res = await PATCH(
      makePatchRequest({ startTime: "2025-03-15T18:00:00Z" }),
      { params: sessionParams }
    );
    expect(res.status).toBe(404);
  });

  it("validates completed must be boolean", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makePatchRequest({ completed: "yes" }),
      { params: sessionParams }
    );
    expect(res.status).toBe(400);
  });

  it("validates notes length", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await PATCH(
      makePatchRequest({ notes: "x".repeat(2001) }),
      { params: sessionParams }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found on update", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbUpdateReturning.mockResolvedValue([]);
    const res = await PATCH(
      makePatchRequest({ notes: "Updated" }),
      { params: sessionParams }
    );
    expect(res.status).toBe(404);
  });

  it("updates session successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const updated = {
      id: "session-1",
      steamAppId: 440,
      notes: "Updated",
      completed: false,
    };
    mockDbUpdateReturning.mockResolvedValue([updated]);

    const res = await PATCH(
      makePatchRequest({ notes: "Updated" }),
      { params: sessionParams }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.notes).toBe("Updated");
  });

  it("fires Discord notification when session marked completed", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbUpdateReturning.mockResolvedValue([
      { id: "session-1", steamAppId: 440, completed: true },
    ]);
    mockDbSelectLimit.mockResolvedValue([
      { name: "TF2", headerImageUrl: "http://img.jpg" },
    ]);

    await PATCH(makePatchRequest({ completed: true }), { params: sessionParams });

    expect(mockNotifySessionCompleted).toHaveBeenCalledWith("user-1", {
      gameName: "TF2",
      headerImageUrl: "http://img.jpg",
    });
  });

  it("does not fire Discord notification when completed is false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbUpdateReturning.mockResolvedValue([
      { id: "session-1", steamAppId: 440, completed: false },
    ]);

    await PATCH(makePatchRequest({ completed: false }), { params: sessionParams });

    expect(mockNotifySessionCompleted).not.toHaveBeenCalled();
  });

  it("does not fire Discord notification for non-completion updates", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbUpdateReturning.mockResolvedValue([
      { id: "session-1", steamAppId: 440, notes: "hi" },
    ]);

    await PATCH(makePatchRequest({ notes: "hi" }), { params: sessionParams });

    expect(mockNotifySessionCompleted).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/sessions/[sessionId]", () => {
  const deleteReq = new NextRequest("http://localhost:3000/api/sessions/session-1", {
    method: "DELETE",
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteReq, { params: sessionParams });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbDeleteReturning.mockResolvedValue([]);
    const res = await DELETE(deleteReq, { params: sessionParams });
    expect(res.status).toBe(404);
  });

  it("deletes session successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDbDeleteReturning.mockResolvedValue([{ id: "session-1" }]);
    const res = await DELETE(deleteReq, { params: sessionParams });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
