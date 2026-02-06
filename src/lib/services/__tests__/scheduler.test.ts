import { describe, it, expect } from "vitest";
import {
  generateSchedule,
  type GenerateScheduleInput,
  type ScheduleGame,
  type SchedulePreferences,
} from "../scheduler";

const defaultPrefs: SchedulePreferences = {
  weeklyHours: 10,
  sessionLengthMinutes: 60,
  timezone: "UTC",
};

const games: ScheduleGame[] = [
  { steamAppId: 440, gameName: "TF2", hltbMainMinutes: 180, playtimeMinutes: 0 },
  { steamAppId: 620, gameName: "Portal 2", hltbMainMinutes: 480, playtimeMinutes: 120 },
];

function makeInput(overrides: Partial<GenerateScheduleInput> = {}): GenerateScheduleInput {
  return {
    startDate: new Date("2025-03-17T00:00:00Z"), // Monday
    weeks: 1,
    preferences: defaultPrefs,
    backlogGames: games,
    ...overrides,
  };
}

describe("generateSchedule", () => {
  it("generates sessions for one week", () => {
    const sessions = generateSchedule(makeInput());
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.length).toBeLessThanOrEqual(10); // 10 hrs / 1 hr = 10 max
  });

  it("returns empty for no backlog games", () => {
    expect(generateSchedule(makeInput({ backlogGames: [] }))).toEqual([]);
  });

  it("returns empty for zero weeks", () => {
    expect(generateSchedule(makeInput({ weeks: 0 }))).toEqual([]);
  });

  it("returns empty for zero weekly hours", () => {
    const prefs = { ...defaultPrefs, weeklyHours: 0 };
    expect(generateSchedule(makeInput({ preferences: prefs }))).toEqual([]);
  });

  it("assigns sessions to current game before moving to next", () => {
    const sessions = generateSchedule(makeInput());
    const tf2Sessions = sessions.filter((s) => s.steamAppId === 440);
    const portalSessions = sessions.filter((s) => s.steamAppId === 620);
    expect(tf2Sessions.length).toBe(3); // 180 min / 60 min = 3 sessions
    expect(portalSessions.length).toBeGreaterThan(0);
  });

  it("respects session length for start and end times", () => {
    const sessions = generateSchedule(makeInput());
    for (const session of sessions) {
      const durationMs = session.endTime.getTime() - session.startTime.getTime();
      expect(durationMs).toBe(60 * 60_000); // 60 minutes
    }
  });

  it("schedules weekday sessions at 19:00 local", () => {
    const input = makeInput({ weeks: 1 });
    const sessions = generateSchedule(input);
    const weekdaySession = sessions.find((s) => {
      const day = s.startTime.getUTCDay();
      return day >= 1 && day <= 5;
    });
    expect(weekdaySession).toBeDefined();
    expect(weekdaySession!.startTime.getUTCHours()).toBe(19);
  });

  it("schedules weekend sessions at 14:00 local", () => {
    const input = makeInput({ weeks: 1 });
    const sessions = generateSchedule(input);
    const weekendSession = sessions.find((s) => {
      const day = s.startTime.getUTCDay();
      return day === 0 || day === 6;
    });
    expect(weekendSession).toBeDefined();
    expect(weekendSession!.startTime.getUTCHours()).toBe(14);
  });

  it("limits sessions per week to weekly budget", () => {
    const prefs = { ...defaultPrefs, weeklyHours: 2, sessionLengthMinutes: 60 };
    const bigGame: ScheduleGame[] = [
      { steamAppId: 1, gameName: "Long Game", hltbMainMinutes: 6000, playtimeMinutes: 0 },
    ];
    const sessions = generateSchedule(makeInput({ preferences: prefs, backlogGames: bigGame }));
    expect(sessions).toHaveLength(2);
  });

  it("spans multiple weeks", () => {
    const prefs = { ...defaultPrefs, weeklyHours: 1, sessionLengthMinutes: 60 };
    const sessions = generateSchedule(makeInput({ weeks: 3, preferences: prefs }));
    expect(sessions).toHaveLength(3);
  });

  it("stops when all games are scheduled", () => {
    const smallGame: ScheduleGame[] = [
      { steamAppId: 1, gameName: "Short", hltbMainMinutes: 60, playtimeMinutes: 0 },
    ];
    const sessions = generateSchedule(makeInput({ weeks: 4, backlogGames: smallGame }));
    expect(sessions).toHaveLength(1);
  });

  it("accounts for existing playtime", () => {
    const partialGame: ScheduleGame[] = [
      { steamAppId: 1, gameName: "Partial", hltbMainMinutes: 180, playtimeMinutes: 120 },
    ];
    const sessions = generateSchedule(makeInput({ backlogGames: partialGame }));
    expect(sessions).toHaveLength(1); // only 60 min remaining
  });

  it("uses 3 sessions default for games without HLTB data", () => {
    const unknownGame: ScheduleGame[] = [
      { steamAppId: 1, gameName: "Unknown", hltbMainMinutes: null, playtimeMinutes: 0 },
    ];
    const sessions = generateSchedule(makeInput({ backlogGames: unknownGame }));
    expect(sessions).toHaveLength(3);
  });

  it("converts times to UTC using timezone", () => {
    const prefs = { ...defaultPrefs, timezone: "America/New_York" };
    const input = makeInput({ preferences: prefs });
    const sessions = generateSchedule(input);
    const weekdaySession = sessions.find((s) => {
      const day = s.startTime.getUTCDay();
      return day >= 1 && day <= 5;
    });
    expect(weekdaySession).toBeDefined();
    // 19:00 EDT = 23:00 UTC (or 00:00 next day during EST)
    const hour = weekdaySession!.startTime.getUTCHours();
    expect(hour === 23 || hour === 0).toBe(true);
  });
});
