import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export interface ScheduleGame {
  steamAppId: number;
  gameName: string;
  hltbMainMinutes: number | null;
  playtimeMinutes: number;
}

export interface SchedulePreferences {
  weeklyHours: number;
  sessionLengthMinutes: number;
  timezone: string;
}

export interface ScheduleSession {
  steamAppId: number;
  startTime: Date;
  endTime: Date;
}

export interface GenerateScheduleInput {
  startDate: Date;
  weeks: number;
  preferences: SchedulePreferences;
  backlogGames: ScheduleGame[];
}

const WEEKDAY_START_HOUR = 19;
const WEEKEND_START_HOUR = 14;

function estimateSessionsNeeded(game: ScheduleGame, sessionMinutes: number): number {
  const remaining = game.hltbMainMinutes
    ? Math.max(0, game.hltbMainMinutes - game.playtimeMinutes)
    : sessionMinutes * 3; // default: 3 sessions for unknown games
  return Math.max(1, Math.ceil(remaining / sessionMinutes));
}

export function generateSchedule(input: GenerateScheduleInput): ScheduleSession[] {
  const { startDate, weeks, preferences, backlogGames } = input;

  if (backlogGames.length === 0 || weeks <= 0 || preferences.weeklyHours <= 0) {
    return [];
  }

  const sessionsPerWeek = Math.floor(
    (preferences.weeklyHours * 60) / preferences.sessionLengthMinutes
  );
  if (sessionsPerWeek <= 0) return [];

  const gameQueue: { steamAppId: number; sessionsRemaining: number }[] = [];
  for (const game of backlogGames) {
    gameQueue.push({
      steamAppId: game.steamAppId,
      sessionsRemaining: estimateSessionsNeeded(game, preferences.sessionLengthMinutes),
    });
  }

  const sessions: ScheduleSession[] = [];

  for (let week = 0; week < weeks; week++) {
    const weekStart = startOfWeek(addDays(startDate, week * 7), { weekStartsOn: 1 });
    let sessionsThisWeek = 0;

    for (let dayOffset = 0; dayOffset < 7 && sessionsThisWeek < sessionsPerWeek; dayOffset++) {
      const day = addDays(weekStart, dayOffset);
      const dayOfWeek = day.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const startHour = isWeekend ? WEEKEND_START_HOUR : WEEKDAY_START_HOUR;

      const currentGame = gameQueue.find((g) => g.sessionsRemaining > 0);
      if (!currentGame) break;

      const localStart = setMinutes(setHours(day, startHour), 0);
      const localEnd = new Date(localStart.getTime() + preferences.sessionLengthMinutes * 60_000);

      const utcStart = fromZonedTime(localStart, preferences.timezone);
      const utcEnd = fromZonedTime(localEnd, preferences.timezone);

      sessions.push({
        steamAppId: currentGame.steamAppId,
        startTime: utcStart,
        endTime: utcEnd,
      });

      currentGame.sessionsRemaining--;
      sessionsThisWeek++;
    }
  }

  return sessions;
}
