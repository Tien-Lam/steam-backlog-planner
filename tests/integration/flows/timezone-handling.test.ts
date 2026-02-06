import { describe, it, expect } from "vitest";
import {
  seedUser,
  seedGames,
  seedPreferences,
  makeJsonRequest,
  makeRequest,
  authAs,
} from "../helpers";
import { db, scheduledSessions } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Timezone Handling", () => {
  it("scheduler generates correct UTC times for Asia/Tokyo (UTC+9)", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedPreferences(user.id, {
      weeklyHours: 7,
      sessionLengthMinutes: 60,
      timezone: "Asia/Tokyo",
    });
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "TF2",
        priority: 1,
        hltbMainMinutes: 600,
      },
    ]);

    const { POST } = await import("@/app/api/sessions/auto-generate/route");
    const res = await POST(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-01-06",
        weeks: 1,
      })
    );
    expect(res.status).toBe(201);

    const sessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));

    expect(sessions.length).toBeGreaterThan(0);

    for (const session of sessions) {
      const utcHour = session.startTime.getUTCHours();
      // Weekday 19:00 JST = 10:00 UTC, Weekend 14:00 JST = 05:00 UTC
      expect([5, 10]).toContain(utcHour);
    }
  });

  it("scheduler generates correct UTC times for America/Los_Angeles (UTC-8 in winter)", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedPreferences(user.id, {
      weeklyHours: 7,
      sessionLengthMinutes: 60,
      timezone: "America/Los_Angeles",
    });
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "TF2",
        priority: 1,
        hltbMainMinutes: 600,
      },
    ]);

    const { POST } = await import("@/app/api/sessions/auto-generate/route");
    const res = await POST(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-01-06",
        weeks: 1,
      })
    );
    expect(res.status).toBe(201);

    const sessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));

    expect(sessions.length).toBeGreaterThan(0);

    for (const session of sessions) {
      const utcHour = session.startTime.getUTCHours();
      // Weekday 19:00 PST = 03:00 UTC (next day), Weekend 14:00 PST = 22:00 UTC
      expect([3, 22]).toContain(utcHour);
    }
  });

  it("manually created sessions store exact UTC times through round-trip", async () => {
    const user = await seedUser();
    authAs(user.id);

    const startUtc = "2025-01-06T10:00:00.000Z";
    const endUtc = "2025-01-06T11:00:00.000Z";

    await seedGames(user.id, [{ steamAppId: 440, name: "TF2" }]);

    const { POST } = await import("@/app/api/sessions/route");
    const createRes = await POST(
      makeJsonRequest("/api/sessions", "POST", {
        steamAppId: 440,
        startTime: startUtc,
        endTime: endUtc,
      })
    );
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json();

    // Read back from DB
    const rows = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.id, id));

    expect(rows).toHaveLength(1);
    expect(rows[0].startTime.toISOString()).toBe(startUtc);
    expect(rows[0].endTime.toISOString()).toBe(endUtc);
  });

  it("sessions listed via GET preserve UTC through API response", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedGames(user.id, [{ steamAppId: 440, name: "TF2" }]);

    const { POST } = await import("@/app/api/sessions/route");
    await POST(
      makeJsonRequest("/api/sessions", "POST", {
        steamAppId: 440,
        startTime: "2025-01-06T10:00:00.000Z",
        endTime: "2025-01-06T11:00:00.000Z",
      })
    );

    const { GET } = await import("@/app/api/sessions/route");
    const res = await GET(makeRequest("/api/sessions"));
    const sessions = await res.json();

    expect(sessions).toHaveLength(1);
    expect(new Date(sessions[0].startTime).toISOString()).toBe(
      "2025-01-06T10:00:00.000Z"
    );
  });

  it("UTC timezone generates sessions at local=UTC times", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedPreferences(user.id, {
      weeklyHours: 7,
      sessionLengthMinutes: 60,
      timezone: "UTC",
    });
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "TF2",
        priority: 1,
        hltbMainMinutes: 600,
      },
    ]);

    const { POST } = await import("@/app/api/sessions/auto-generate/route");
    await POST(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-01-06",
        weeks: 1,
      })
    );

    const sessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));

    for (const session of sessions) {
      const utcHour = session.startTime.getUTCHours();
      // UTC timezone: weekday 19:00, weekend 14:00 — no offset
      expect([14, 19]).toContain(utcHour);
    }
  });
});
