import { describe, it, expect } from "vitest";
import { generateICalendar, type ICalSession } from "../ical";

describe("generateICalendar", () => {
  const session: ICalSession = {
    id: "session-1",
    gameName: "Team Fortress 2",
    startTime: "2025-03-15T18:00:00.000Z",
    endTime: "2025-03-15T19:30:00.000Z",
    notes: "Focus on MvM mode",
  };

  it("generates valid iCal structure", () => {
    const ical = generateICalendar([session]);
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).toContain("VERSION:2.0");
    expect(ical).toContain("PRODID:-//Steam Backlog Planner//EN");
  });

  it("includes event data", () => {
    const ical = generateICalendar([session]);
    expect(ical).toContain("BEGIN:VEVENT");
    expect(ical).toContain("END:VEVENT");
    expect(ical).toContain("UID:session-1@steam-backlog-planner");
    expect(ical).toContain("SUMMARY:Team Fortress 2");
    expect(ical).toContain("DTSTART:20250315T180000Z");
    expect(ical).toContain("DTEND:20250315T193000Z");
    expect(ical).toContain("DESCRIPTION:Focus on MvM mode");
  });

  it("escapes special characters in text", () => {
    const s: ICalSession = {
      ...session,
      gameName: "Half-Life 2, Episode 1; The Sequel",
      notes: "Line 1\nLine 2",
    };
    const ical = generateICalendar([s]);
    expect(ical).toContain("SUMMARY:Half-Life 2\\, Episode 1\\; The Sequel");
    expect(ical).toContain("DESCRIPTION:Line 1\\nLine 2");
  });

  it("omits DESCRIPTION when notes is null", () => {
    const s: ICalSession = { ...session, notes: null };
    const ical = generateICalendar([s]);
    expect(ical).not.toContain("DESCRIPTION:");
  });

  it("handles multiple sessions", () => {
    const s2: ICalSession = {
      id: "session-2",
      gameName: "Portal 2",
      startTime: "2025-03-16T20:00:00.000Z",
      endTime: "2025-03-16T21:00:00.000Z",
    };
    const ical = generateICalendar([session, s2]);
    const events = ical.match(/BEGIN:VEVENT/g);
    expect(events).toHaveLength(2);
  });

  it("handles empty sessions array", () => {
    const ical = generateICalendar([]);
    expect(ical).toContain("BEGIN:VCALENDAR");
    expect(ical).toContain("END:VCALENDAR");
    expect(ical).not.toContain("BEGIN:VEVENT");
  });

  it("uses CRLF line endings per RFC 5545", () => {
    const ical = generateICalendar([session]);
    expect(ical).toContain("\r\n");
    const lines = ical.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
  });
});
