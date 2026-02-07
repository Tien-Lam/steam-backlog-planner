import { describe, it, expect } from "vitest";
import { seedUser, seedGames, seedAchievements, authAs, authAsNone } from "../helpers";

describe("Statistics API", () => {
  it("returns empty state when user has no achievements", async () => {
    const user = await seedUser();
    authAs(user.id);

    const { GET } = await import("@/app/api/statistics/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overallAchievements).toEqual({
      achieved: 0,
      total: 0,
      percentage: 0,
    });
    expect(data.perGame).toEqual([]);
  });

  it("aggregates achievements across multiple games", async () => {
    const user = await seedUser();
    authAs(user.id);

    await seedGames(user.id, [
      { steamAppId: 440, name: "Team Fortress 2" },
      { steamAppId: 620, name: "Portal 2" },
    ]);

    await seedAchievements(user.id, [
      { steamAppId: 440, achievedCount: 10, totalCount: 20 },
      { steamAppId: 620, achievedCount: 5, totalCount: 10 },
    ]);

    const { GET } = await import("@/app/api/statistics/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.overallAchievements).toEqual({
      achieved: 15,
      total: 30,
      percentage: 50,
    });
    expect(data.perGame).toHaveLength(2);

    const tf2 = data.perGame.find((g: { steamAppId: number }) => g.steamAppId === 440);
    expect(tf2).toEqual({
      steamAppId: 440,
      gameName: "Team Fortress 2",
      achieved: 10,
      total: 20,
      percentage: 50,
    });

    const portal = data.perGame.find((g: { steamAppId: number }) => g.steamAppId === 620);
    expect(portal).toEqual({
      steamAppId: 620,
      gameName: "Portal 2",
      achieved: 5,
      total: 10,
      percentage: 50,
    });
  });

  it("handles zero-division when totalCount is 0", async () => {
    const user = await seedUser();
    authAs(user.id);

    await seedGames(user.id, [
      { steamAppId: 440, name: "Team Fortress 2" },
    ]);

    await seedAchievements(user.id, [
      { steamAppId: 440, achievedCount: 0, totalCount: 0 },
    ]);

    const { GET } = await import("@/app/api/statistics/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overallAchievements.percentage).toBe(0);
    expect(data.perGame[0].percentage).toBe(0);
  });

  it("isolates data between users", async () => {
    const userA = await seedUser({ id: "user-a", steamId: "111", steamUsername: "Alice" });
    const userB = await seedUser({ id: "user-b", steamId: "222", steamUsername: "Bob" });

    await seedGames(userA.id, [{ steamAppId: 440, name: "Team Fortress 2" }]);
    await seedGames(userB.id, [{ steamAppId: 620, name: "Portal 2" }]);

    await seedAchievements(userA.id, [
      { steamAppId: 440, achievedCount: 10, totalCount: 20 },
    ]);
    await seedAchievements(userB.id, [
      { steamAppId: 620, achievedCount: 3, totalCount: 5 },
    ]);

    const { GET } = await import("@/app/api/statistics/route");

    // User A sees only their data
    authAs(userA.id);
    const resA = await GET();
    const dataA = await resA.json();
    expect(dataA.perGame).toHaveLength(1);
    expect(dataA.perGame[0].steamAppId).toBe(440);
    expect(dataA.overallAchievements.achieved).toBe(10);

    // User B sees only their data
    authAs(userB.id);
    const resB = await GET();
    const dataB = await resB.json();
    expect(dataB.perGame).toHaveLength(1);
    expect(dataB.perGame[0].steamAppId).toBe(620);
    expect(dataB.overallAchievements.achieved).toBe(3);
  });

  it("uses fallback name when game is not in cache", async () => {
    const user = await seedUser();
    authAs(user.id);

    // Insert achievement without a corresponding gameCache entry
    await seedAchievements(user.id, [
      { steamAppId: 999, achievedCount: 1, totalCount: 5 },
    ]);

    const { GET } = await import("@/app/api/statistics/route");
    const res = await GET();
    const data = await res.json();

    expect(data.perGame[0].gameName).toBe("Game 999");
  });
});
