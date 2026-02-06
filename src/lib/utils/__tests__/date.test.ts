import { describe, it, expect } from "vitest";
import {
  formatSessionTime,
  formatSessionDate,
  getWeekDays,
  durationMinutes,
  formatDuration,
} from "../date";

describe("formatSessionTime", () => {
  it("formats a UTC date to the given timezone", () => {
    const utcDate = new Date("2025-03-15T18:00:00Z");
    const result = formatSessionTime(utcDate, "America/New_York");
    expect(result).toBe("2:00 PM");
  });

  it("accepts string dates", () => {
    const result = formatSessionTime("2025-03-15T12:00:00Z", "UTC");
    expect(result).toBe("12:00 PM");
  });
});

describe("formatSessionDate", () => {
  it("formats a date with day and month", () => {
    const result = formatSessionDate("2025-03-15T12:00:00Z", "UTC");
    expect(result).toBe("Sat, Mar 15");
  });

  it("adjusts for timezone when date crosses boundary", () => {
    const result = formatSessionDate("2025-03-16T02:00:00Z", "America/New_York");
    expect(result).toBe("Sat, Mar 15");
  });
});

describe("getWeekDays", () => {
  it("returns 7 days starting from Monday", () => {
    const wednesday = new Date("2025-03-19T12:00:00Z");
    const days = getWeekDays(wednesday);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
  });

  it("returns correct dates for the week", () => {
    const date = new Date("2025-03-19T12:00:00Z");
    const days = getWeekDays(date);
    expect(days[0].getDate()).toBe(17); // Mon March 17
    expect(days[4].getDate()).toBe(21); // Fri March 21
  });
});

describe("durationMinutes", () => {
  it("calculates duration between two dates", () => {
    const start = new Date("2025-03-15T18:00:00Z");
    const end = new Date("2025-03-15T19:30:00Z");
    expect(durationMinutes(start, end)).toBe(90);
  });

  it("accepts string dates", () => {
    expect(durationMinutes("2025-03-15T18:00:00Z", "2025-03-15T20:00:00Z")).toBe(120);
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });
});
