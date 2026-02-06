export interface ICalSession {
  id: string;
  gameName: string;
  startTime: Date | string;
  endTime: Date | string;
  notes?: string | null;
}

function formatICalDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateICalendar(sessions: ICalSession[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Steam Backlog Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const session of sessions) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${session.id}@steam-backlog-planner`);
    lines.push(`DTSTART:${formatICalDate(session.startTime)}`);
    lines.push(`DTEND:${formatICalDate(session.endTime)}`);
    lines.push(`SUMMARY:${escapeICalText(session.gameName)}`);
    if (session.notes) {
      lines.push(`DESCRIPTION:${escapeICalText(session.notes)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
