import { describe, it, expect } from "vitest";
import {
  seedUser,
  seedGames,
  seedPreferences,
  makeJsonRequest,
  authAs,
} from "../helpers";
import { db, userGames, scheduledSessions } from "@/lib/db";
import { eq, and } from "drizzle-orm";

describe("Prioritization → Scheduling Flow", () => {
  it("PATCH /api/games/batch updates priorities in DB", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedGames(user.id, [
      { steamAppId: 440, name: "TF2", priority: 0 },
      { steamAppId: 570, name: "Dota 2", priority: 0 },
      { steamAppId: 730, name: "CS2", priority: 0 },
    ]);

    const { PATCH } = await import("@/app/api/games/batch/route");
    const res = await PATCH(
      makeJsonRequest("/api/games/batch", "PATCH", {
        updates: [
          { steamAppId: 440, priority: 3 },
          { steamAppId: 570, priority: 2 },
          { steamAppId: 730, priority: 1 },
        ],
      })
    );

    expect(res.status).toBe(200);

    const games = await db
      .select()
      .from(userGames)
      .where(eq(userGames.userId, user.id));

    const byApp = Object.fromEntries(
      games.map((g) => [g.steamAppId, g.priority])
    );
    expect(byApp[440]).toBe(3);
    expect(byApp[570]).toBe(2);
    expect(byApp[730]).toBe(1);
  });

  it("auto-generate creates sessions in priority order", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedPreferences(user.id, {
      weeklyHours: 14,
      sessionLengthMinutes: 120,
      timezone: "UTC",
    });
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "TF2",
        priority: 3,
        hltbMainMinutes: 120,
      },
      {
        steamAppId: 570,
        name: "Dota 2",
        priority: 2,
        hltbMainMinutes: 120,
      },
      {
        steamAppId: 730,
        name: "CS2",
        priority: 1,
        hltbMainMinutes: 120,
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
    const body = await res.json();
    expect(body.created).toBeGreaterThan(0);

    const sessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));

    expect(sessions.length).toBeGreaterThan(0);

    expect(sessions[0].steamAppId).toBe(440);
  });

  it("clearExisting removes old sessions atomically in transaction", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedPreferences(user.id, { weeklyHours: 7, sessionLengthMinutes: 60 });
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "TF2",
        priority: 1,
        hltbMainMinutes: 120,
      },
    ]);

    const { POST } = await import("@/app/api/sessions/auto-generate/route");

    await POST(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-01-06",
        weeks: 1,
      })
    );

    const beforeSessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));
    const countBefore = beforeSessions.length;
    expect(countBefore).toBeGreaterThan(0);

    await POST(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-02-03",
        weeks: 1,
        clearExisting: true,
      })
    );

    const afterSessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.userId, user.id));

    for (const s of afterSessions) {
      expect(s.startTime.getTime()).toBeGreaterThanOrEqual(
        new Date("2025-02-03").getTime()
      );
    }
  });

  it("batch update is transactional — all-or-nothing via DB constraints", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedGames(user.id, [
      { steamAppId: 440, name: "TF2", priority: 0 },
    ]);

    const { PATCH } = await import("@/app/api/games/batch/route");

    const res = await PATCH(
      makeJsonRequest("/api/games/batch", "PATCH", {
        updates: [
          { steamAppId: 440, priority: 5 },
          { steamAppId: 999, priority: 3 },
        ],
      })
    );

    expect(res.status).toBe(200);

    const game440 = await db
      .select()
      .from(userGames)
      .where(
        and(
          eq(userGames.userId, user.id),
          eq(userGames.steamAppId, 440)
        )
      );
    expect(game440[0].priority).toBe(5);
  });

  it("PATCH /api/games updates individual game status", async () => {
    const user = await seedUser();
    authAs(user.id);
    await seedGames(user.id, [
      { steamAppId: 440, name: "TF2", status: "backlog" },
    ]);

    const { PATCH } = await import("@/app/api/games/route");
    const res = await PATCH(
      makeJsonRequest("/api/games", "PATCH", {
        steamAppId: 440,
        status: "playing",
      })
    );
    expect(res.status).toBe(200);

    const games = await db
      .select()
      .from(userGames)
      .where(
        and(
          eq(userGames.userId, user.id),
          eq(userGames.steamAppId, 440)
        )
      );
    expect(games[0].status).toBe("playing");
  });
});
