import { describe, it, expect, vi } from "vitest";
import { seedUser, authAs } from "../helpers";
import { db, userGames, gameCache } from "@/lib/db";
import { eq, and } from "drizzle-orm";

vi.mock("@/lib/services/steam", () => ({
  getOwnedGames: vi.fn(),
  getGameHeaderUrl: (appId: number) =>
    `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
}));

describe("Library Sync Flow", () => {
  it("syncs Steam library to DB — creates gameCache + userGames rows", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { getOwnedGames } = await import("@/lib/services/steam");
    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 1200,
        img_icon_url: "",
        rtime_last_played: 1700000000,
      },
      {
        appid: 570,
        name: "Dota 2",
        playtime_forever: 500,
        img_icon_url: "",
      },
    ]);

    const { GET } = await import("@/app/api/steam/library/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);

    const cached = await db.select().from(gameCache);
    expect(cached).toHaveLength(2);
    expect(cached.map((c) => c.steamAppId).sort()).toEqual([440, 570]);

    const games = await db.select().from(userGames);
    expect(games).toHaveLength(2);
    expect(games.find((g) => g.steamAppId === 440)?.playtimeMinutes).toBe(
      1200
    );
  });

  it("re-sync updates playtime without duplicating (onConflictDoUpdate)", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { getOwnedGames } = await import("@/lib/services/steam");

    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 1200,
        img_icon_url: "",
      },
    ]);

    const { GET } = await import("@/app/api/steam/library/route");
    await GET();

    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 1500,
        img_icon_url: "",
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const games = await db.select().from(userGames);
    expect(games).toHaveLength(1);
    expect(games[0].playtimeMinutes).toBe(1500);
  });

  it("preserves user-set status/priority during re-sync", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { getOwnedGames } = await import("@/lib/services/steam");
    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 100,
        img_icon_url: "",
      },
    ]);

    const { GET } = await import("@/app/api/steam/library/route");
    await GET();

    await db
      .update(userGames)
      .set({ status: "playing", priority: 5 })
      .where(
        and(
          eq(userGames.userId, user.id),
          eq(userGames.steamAppId, 440)
        )
      );

    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 200,
        img_icon_url: "",
      },
    ]);

    await GET();

    const games = await db.select().from(userGames);
    expect(games).toHaveLength(1);
    expect(games[0].playtimeMinutes).toBe(200);
    expect(games[0].status).toBe("playing");
    expect(games[0].priority).toBe(5);
  });

  it("returns relational query result with cache data", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { getOwnedGames } = await import("@/lib/services/steam");
    vi.mocked(getOwnedGames).mockResolvedValue([
      {
        appid: 440,
        name: "Team Fortress 2",
        playtime_forever: 100,
        img_icon_url: "",
      },
    ]);

    const { GET } = await import("@/app/api/steam/library/route");
    const res = await GET();
    const body = await res.json();

    expect(body[0]).toHaveProperty("cache");
    expect(body[0].cache.name).toBe("Team Fortress 2");
  });

  it("returns 404 if user not in DB", async () => {
    authAs("nonexistent-user");

    const { getOwnedGames } = await import("@/lib/services/steam");
    vi.mocked(getOwnedGames).mockResolvedValue([]);

    const { GET } = await import("@/app/api/steam/library/route");
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
