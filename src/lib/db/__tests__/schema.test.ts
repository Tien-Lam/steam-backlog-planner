import { describe, it, expect } from "vitest";
import {
  gameStatusEnum,
  users,
  userGames,
  gameCache,
  userAchievements,
  scheduledSessions,
  userPreferences,
} from "../schema";

describe("gameStatusEnum", () => {
  it("has all expected values", () => {
    expect(gameStatusEnum.enumValues).toEqual([
      "backlog",
      "playing",
      "completed",
      "abandoned",
    ]);
  });
});

describe("table exports", () => {
  it("exports users table", () => {
    expect(users).toBeDefined();
  });

  it("exports userGames table", () => {
    expect(userGames).toBeDefined();
  });

  it("exports gameCache table", () => {
    expect(gameCache).toBeDefined();
  });

  it("exports userAchievements table", () => {
    expect(userAchievements).toBeDefined();
  });

  it("exports scheduledSessions table", () => {
    expect(scheduledSessions).toBeDefined();
  });

  it("exports userPreferences table", () => {
    expect(userPreferences).toBeDefined();
  });
});
