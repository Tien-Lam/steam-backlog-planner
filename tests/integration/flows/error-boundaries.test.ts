import { describe, it, expect } from "vitest";
import {
  makeRequest,
  makeJsonRequest,
  authAs,
  authAsNone,
  seedUser,
  seedGames,
} from "../helpers";

describe("Error Boundaries", () => {
  describe("Authentication — 401 on all routes when unauthenticated", () => {
    const routes = [
      {
        name: "GET /api/steam/library",
        handler: () =>
          import("@/app/api/steam/library/route").then((m) =>
            m.GET()
          ),
      },
      {
        name: "GET /api/sessions",
        handler: () =>
          import("@/app/api/sessions/route").then((m) =>
            m.GET(makeRequest("/api/sessions"))
          ),
      },
      {
        name: "POST /api/sessions",
        handler: () =>
          import("@/app/api/sessions/route").then((m) =>
            m.POST(
              makeJsonRequest("/api/sessions", "POST", {
                steamAppId: 440,
                startTime: "2025-01-01T10:00:00Z",
                endTime: "2025-01-01T11:00:00Z",
              })
            )
          ),
      },
      {
        name: "POST /api/sessions/auto-generate",
        handler: () =>
          import("@/app/api/sessions/auto-generate/route").then((m) =>
            m.POST(
              makeJsonRequest("/api/sessions/auto-generate", "POST", {
                startDate: "2025-01-06",
                weeks: 1,
              })
            )
          ),
      },
      {
        name: "PATCH /api/sessions/:id",
        handler: () =>
          import("@/app/api/sessions/[sessionId]/route").then((m) =>
            m.PATCH(
              makeJsonRequest("/api/sessions/abc", "PATCH", { notes: "hi" }),
              { params: Promise.resolve({ sessionId: "abc" }) }
            )
          ),
      },
      {
        name: "DELETE /api/sessions/:id",
        handler: () =>
          import("@/app/api/sessions/[sessionId]/route").then((m) =>
            m.DELETE(makeRequest("/api/sessions/abc", { method: "DELETE" }), {
              params: Promise.resolve({ sessionId: "abc" }),
            })
          ),
      },
      {
        name: "GET /api/preferences",
        handler: () =>
          import("@/app/api/preferences/route").then((m) => m.GET()),
      },
      {
        name: "PATCH /api/preferences",
        handler: () =>
          import("@/app/api/preferences/route").then((m) =>
            m.PATCH(
              makeJsonRequest("/api/preferences", "PATCH", { weeklyHours: 5 })
            )
          ),
      },
      {
        name: "PATCH /api/games",
        handler: () =>
          import("@/app/api/games/route").then((m) =>
            m.PATCH(
              makeJsonRequest("/api/games", "PATCH", {
                steamAppId: 440,
                status: "playing",
              })
            )
          ),
      },
      {
        name: "PATCH /api/games/batch",
        handler: () =>
          import("@/app/api/games/batch/route").then((m) =>
            m.PATCH(
              makeJsonRequest("/api/games/batch", "PATCH", {
                updates: [{ steamAppId: 440, priority: 1 }],
              })
            )
          ),
      },
      {
        name: "GET /api/calendar/export.ics",
        handler: () =>
          import("@/app/api/calendar/export.ics/route").then((m) => m.GET()),
      },
      {
        name: "GET /api/steam/achievements/:appId",
        handler: () =>
          import("@/app/api/steam/achievements/[appId]/route").then((m) =>
            m.GET(makeRequest("/api/steam/achievements/440"), {
              params: Promise.resolve({ appId: "440" }),
            })
          ),
      },
      {
        name: "GET /api/hltb/:appId",
        handler: () =>
          import("@/app/api/hltb/[appId]/route").then((m) =>
            m.GET(makeRequest("/api/hltb/440"), {
              params: Promise.resolve({ appId: "440" }),
            })
          ),
      },
    ];

    for (const route of routes) {
      it(`${route.name} returns 401`, async () => {
        authAsNone();
        const res = await route.handler();
        expect(res.status).toBe(401);
      });
    }
  });

  describe("Validation errors", () => {
    it("POST /api/sessions — endTime before startTime → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { POST } = await import("@/app/api/sessions/route");
      const res = await POST(
        makeJsonRequest("/api/sessions", "POST", {
          steamAppId: 440,
          startTime: "2025-01-01T12:00:00Z",
          endTime: "2025-01-01T10:00:00Z",
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("endTime");
    });

    it("POST /api/sessions/auto-generate — no backlog games → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { POST } = await import("@/app/api/sessions/auto-generate/route");
      const res = await POST(
        makeJsonRequest("/api/sessions/auto-generate", "POST", {
          startDate: "2025-01-06",
          weeks: 1,
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("backlog");
    });

    it("PATCH /api/preferences — weeklyHours > 168 → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { PATCH } = await import("@/app/api/preferences/route");
      const res = await PATCH(
        makeJsonRequest("/api/preferences", "PATCH", { weeklyHours: 200 })
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /api/preferences — invalid timezone → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { PATCH } = await import("@/app/api/preferences/route");
      const res = await PATCH(
        makeJsonRequest("/api/preferences", "PATCH", {
          timezone: "Not/A/Timezone",
        })
      );
      expect(res.status).toBe(400);
    });

    it("POST /api/sessions — notes > 2000 chars → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { POST } = await import("@/app/api/sessions/route");
      const res = await POST(
        makeJsonRequest("/api/sessions", "POST", {
          steamAppId: 440,
          startTime: "2025-01-01T10:00:00Z",
          endTime: "2025-01-01T11:00:00Z",
          notes: "x".repeat(2001),
        })
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /api/sessions/:id — endTime before startTime → 400", async () => {
      const user = await seedUser();
      authAs(user.id);
      await seedGames(user.id, [
        { steamAppId: 440, name: "Team Fortress 2" },
      ]);

      const { POST } = await import("@/app/api/sessions/route");
      const createRes = await POST(
        makeJsonRequest("/api/sessions", "POST", {
          steamAppId: 440,
          startTime: "2025-01-01T10:00:00Z",
          endTime: "2025-01-01T11:00:00Z",
        })
      );
      const { id } = await createRes.json();

      const { PATCH } = await import(
        "@/app/api/sessions/[sessionId]/route"
      );
      const res = await PATCH(
        makeJsonRequest(`/api/sessions/${id}`, "PATCH", {
          endTime: "2025-01-01T09:00:00Z",
        }),
        { params: Promise.resolve({ sessionId: id }) }
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /api/games — invalid status → 400", async () => {
      const user = await seedUser();
      authAs(user.id);

      const { PATCH } = await import("@/app/api/games/route");
      const res = await PATCH(
        makeJsonRequest("/api/games", "PATCH", {
          steamAppId: 440,
          status: "invalid_status",
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
