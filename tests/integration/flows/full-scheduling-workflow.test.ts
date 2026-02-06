import { describe, it, expect } from "vitest";
import {
  seedUser,
  seedGames,
  makeRequest,
  makeJsonRequest,
  authAs,
} from "../helpers";
import { db, scheduledSessions } from "@/lib/db";
import { eq } from "drizzle-orm";

describe("Full Scheduling Workflow", () => {
  it("preferences → seed games → auto-generate → list → update → delete → iCal export", async () => {
    const user = await seedUser();
    authAs(user.id);

    // Step 1: Set preferences
    const { PATCH: patchPrefs } = await import(
      "@/app/api/preferences/route"
    );
    const prefsRes = await patchPrefs(
      makeJsonRequest("/api/preferences", "PATCH", {
        weeklyHours: 14,
        sessionLengthMinutes: 120,
        timezone: "America/New_York",
      })
    );
    expect(prefsRes.status).toBe(200);

    // Verify preferences saved
    const { GET: getPrefs } = await import("@/app/api/preferences/route");
    const savedPrefs = await (await getPrefs()).json();
    expect(savedPrefs.timezone).toBe("America/New_York");
    expect(savedPrefs.weeklyHours).toBe(14);

    // Step 2: Seed backlog games with HLTB data
    await seedGames(user.id, [
      {
        steamAppId: 440,
        name: "Team Fortress 2",
        priority: 2,
        hltbMainMinutes: 600,
      },
      {
        steamAppId: 570,
        name: "Dota 2",
        priority: 1,
        hltbMainMinutes: 300,
      },
    ]);

    // Step 3: Auto-generate schedule
    const { POST: autoGen } = await import(
      "@/app/api/sessions/auto-generate/route"
    );
    const genRes = await autoGen(
      makeJsonRequest("/api/sessions/auto-generate", "POST", {
        startDate: "2025-01-06",
        weeks: 2,
      })
    );
    expect(genRes.status).toBe(201);
    const genBody = await genRes.json();
    expect(genBody.created).toBeGreaterThan(0);

    // Step 4: List sessions with date range
    const { GET: getSessions } = await import("@/app/api/sessions/route");
    const listRes = await getSessions(
      makeRequest(
        "/api/sessions?from=2025-01-06T00:00:00Z&to=2025-01-20T00:00:00Z"
      )
    );
    expect(listRes.status).toBe(200);
    const sessions = await listRes.json();
    expect(sessions.length).toBeGreaterThan(0);

    // Each session should have game name from join
    expect(sessions[0]).toHaveProperty("game");
    expect(sessions[0].game).not.toBeNull();

    const firstSessionId = sessions[0].id;

    // Step 5: Update session notes
    const { PATCH: patchSession } = await import(
      "@/app/api/sessions/[sessionId]/route"
    );
    const updateRes = await patchSession(
      makeJsonRequest(`/api/sessions/${firstSessionId}`, "PATCH", {
        notes: "Great gaming session!",
      }),
      { params: Promise.resolve({ sessionId: firstSessionId }) }
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.notes).toBe("Great gaming session!");

    // Step 6: Delete one session
    const secondSessionId = sessions[1]?.id;
    if (secondSessionId) {
      const { DELETE: delSession } = await import(
        "@/app/api/sessions/[sessionId]/route"
      );
      const delRes = await delSession(
        makeRequest(`/api/sessions/${secondSessionId}`, { method: "DELETE" }),
        { params: Promise.resolve({ sessionId: secondSessionId }) }
      );
      expect(delRes.status).toBe(200);
    }

    // Step 7: Export iCal
    const { GET: getIcal } = await import(
      "@/app/api/calendar/export.ics/route"
    );
    const icalRes = await getIcal();
    expect(icalRes.headers.get("Content-Type")).toContain("text/calendar");

    const ical = await icalRes.text();
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("BEGIN:VEVENT");
    expect(ical).toContain("Great gaming session!");

    // Deleted session should not appear
    if (secondSessionId) {
      expect(ical).not.toContain(secondSessionId);
    }
  });

  it("cross-user isolation — user B cannot see or modify user A's sessions", async () => {
    const userA = await seedUser({ id: "user-a", steamId: "steam-a", steamUsername: "UserA" });
    const userB = await seedUser({ id: "user-b", steamId: "steam-b", steamUsername: "UserB" });

    authAs(userA.id);
    await seedGames(userA.id, [
      { steamAppId: 440, name: "TF2", hltbMainMinutes: 120 },
    ]);
    await seedGames(userB.id, [
      { steamAppId: 570, name: "Dota 2", hltbMainMinutes: 120 },
    ]);

    // Create a session for user A
    const { POST: createSession } = await import("@/app/api/sessions/route");
    const createRes = await createSession(
      makeJsonRequest("/api/sessions", "POST", {
        steamAppId: 440,
        startTime: "2025-01-06T19:00:00Z",
        endTime: "2025-01-06T21:00:00Z",
      })
    );
    const { id: sessionAId } = await createRes.json();

    // Switch to user B
    authAs(userB.id);

    // User B listing should not see user A's sessions
    const { GET: getSessions } = await import("@/app/api/sessions/route");
    const listRes = await getSessions(makeRequest("/api/sessions"));
    const sessions = await listRes.json();
    expect(sessions).toHaveLength(0);

    // User B cannot update user A's session
    const { PATCH: patchSession } = await import(
      "@/app/api/sessions/[sessionId]/route"
    );
    const patchRes = await patchSession(
      makeJsonRequest(`/api/sessions/${sessionAId}`, "PATCH", {
        notes: "hacked",
      }),
      { params: Promise.resolve({ sessionId: sessionAId }) }
    );
    expect(patchRes.status).toBe(404);

    // User B cannot delete user A's session
    const { DELETE: delSession } = await import(
      "@/app/api/sessions/[sessionId]/route"
    );
    const delRes = await delSession(
      makeRequest(`/api/sessions/${sessionAId}`, { method: "DELETE" }),
      { params: Promise.resolve({ sessionId: sessionAId }) }
    );
    expect(delRes.status).toBe(404);

    // User A's session still intact
    const dbSessions = await db
      .select()
      .from(scheduledSessions)
      .where(eq(scheduledSessions.id, sessionAId));
    expect(dbSessions).toHaveLength(1);
    expect(dbSessions[0].notes).toBeNull();
  });

  it("iCal export with no sessions returns valid empty calendar", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { GET: getIcal } = await import(
      "@/app/api/calendar/export.ics/route"
    );
    const res = await getIcal();
    expect(res.headers.get("Content-Type")).toContain("text/calendar");

    const ical = await res.text();
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).not.toContain("BEGIN:VEVENT");
  });
});
