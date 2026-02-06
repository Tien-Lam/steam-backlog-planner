import { format, startOfWeek, addDays, differenceInMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function formatSessionTime(date: Date | string, timezone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return format(zoned, "h:mm a");
}

export function formatSessionDate(date: Date | string, timezone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const zoned = toZonedTime(d, timezone);
  return format(zoned, "EEE, MMM d");
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function durationMinutes(start: Date | string, end: Date | string): number {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return differenceInMinutes(e, s);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
