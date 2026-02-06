import type { LibraryGame } from "@/lib/hooks/use-library";
import type { GameStatus } from "@/lib/db/schema";

export function makeLibraryGame(overrides: Partial<LibraryGame> = {}): LibraryGame {
  return {
    userId: "user-1",
    steamAppId: 440,
    status: "backlog" as GameStatus,
    priority: 0,
    playtimeMinutes: 120,
    lastPlayed: "2024-01-15T00:00:00Z",
    addedAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
    cache: {
      steamAppId: 440,
      name: "Team Fortress 2",
      headerImageUrl: "https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg",
      hltbMainMinutes: 600,
      hltbExtraMinutes: 1200,
      hltbCompletionistMinutes: 2400,
      totalAchievements: 50,
    },
    ...overrides,
  };
}

export function mockFetchResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}
