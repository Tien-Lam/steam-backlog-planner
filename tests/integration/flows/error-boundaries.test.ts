import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  makeRequest,
  makeJsonRequest,
  authAs,
  authAsNone,
  seedUser,
  seedGames,
} from "../helpers";

const HTTP_METHODS = ["GET", "POST", "PATCH", "DELETE", "PUT"] as const;

const routes = [
  {
    name: "GET /api/steam/library",
    handler: () =>
      import("@/app/api/steam/library/route").then((m) => m.GET()),
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
    name: "PATCH /api/sessions/:sessionId",
    handler: () =>
      import("@/app/api/sessions/[sessionId]/route").then((m) =>
        m.PATCH(
          makeJsonRequest("/api/sessions/abc", "PATCH", { notes: "hi" }),
          { params: Promise.resolve({ sessionId: "abc" }) }
        )
      ),
  },
  {
    name: "DELETE /api/sessions/:sessionId",
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
  {
    name: "GET /api/statistics",
    handler: () =>
      import("@/app/api/statistics/route").then((m) => m.GET()),
  },
  {
    name: "POST /api/discord/test",
    handler: () =>
      import("@/app/api/discord/test/route").then((m) => m.POST()),
  },
  {
    name: "GET /api/igdb/:appId",
    handler: () =>
      import("@/app/api/igdb/[appId]/route").then((m) =>
        m.GET(makeRequest("/api/igdb/440"), {
          params: Promise.resolve({ appId: "440" }),
        })
      ),
  },
  {
    name: "GET /api/google/connect",
    handler: () =>
      import("@/app/api/google/connect/route").then((m) => m.GET()),
  },
  {
    name: "GET /api/google/callback",
    handler: () =>
      import("@/app/api/google/callback/route").then((m) =>
        m.GET(makeRequest("/api/google/callback?code=c&state=s"))
      ),
  },
  {
    name: "POST /api/google/disconnect",
    handler: () =>
      import("@/app/api/google/disconnect/route").then((m) => m.POST()),
  },
];

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

function filePathToRoutePath(filePath: string): string {
  const apiDir = path.join("src", "app", "api");
  const idx = filePath.indexOf(apiDir);
  const relative = filePath.slice(idx + apiDir.length).replace(/\\/g, "/");
  return (
    "/api" +
    relative
      .replace(/\/route\.ts$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1")
  );
}

async function getExportedMethods(
  filePath: string
): Promise<string[]> {
  const mod = await import(filePath);
  return HTTP_METHODS.filter((m) => typeof mod[m] === "function");
}

function isExcluded(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/auth/") || normalized.includes("/api/test/");
}

describe("Error Boundaries", () => {
  describe("Authentication — 401 on all routes when unauthenticated", () => {
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

  describe("Completeness", () => {
    const routeNames = new Set(routes.map((r) => r.name));
    const apiRoot = path.resolve("src", "app", "api");

    it("routes array covers all authenticated API endpoints", async () => {
      const routeFiles = findRouteFiles(apiRoot);
      const missing: string[] = [];

      for (const file of routeFiles) {
        if (isExcluded(file)) continue;

        const routePath = filePathToRoutePath(file);
        const methods = await getExportedMethods(file);

        for (const method of methods) {
          const entry = `${method} ${routePath}`;
          if (!routeNames.has(entry)) {
            missing.push(entry);
          }
        }
      }

      expect(
        missing,
        `Missing from routes array:\n${missing.map((m) => `  - ${m}`).join("\n")}`
      ).toEqual([]);
    });

    it("routes array has no stale entries", async () => {
      const routeFiles = findRouteFiles(apiRoot);
      const diskEndpoints = new Set<string>();

      for (const file of routeFiles) {
        if (isExcluded(file)) continue;

        const routePath = filePathToRoutePath(file);
        const methods = await getExportedMethods(file);
        for (const method of methods) {
          diskEndpoints.add(`${method} ${routePath}`);
        }
      }

      const stale = [...routeNames].filter((r) => !diskEndpoints.has(r));

      expect(
        stale,
        `Stale entries in routes array:\n${stale.map((s) => `  - ${s}`).join("\n")}`
      ).toEqual([]);
    });
  });
});
