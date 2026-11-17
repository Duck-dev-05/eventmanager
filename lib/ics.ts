export type IcsEvent = {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  /** Events have no explicit end time; 2 hours is the calendar default. */
  durationMinutes?: number;
};

function utcStamp(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 wants lines folded at 75 octets; a space prefixes continuations. */
function foldLine(line: string) {
  if (line.length <= 74) return line;

  const parts: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
}

export function buildCalendar({
  calendarName,
  events,
  now = new Date(),
}: {
  calendarName: string;
  events: IcsEvent[];
  now?: Date;
}) {
  const stamp = utcStamp(now.getTime());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EventPulse//Event workspace//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    const start = utcStamp(event.startsAt);
    if (!start) continue;

    const durationMs = (event.durationMinutes ?? 120) * 60_000;
    const end = utcStamp(new Date(event.startsAt).getTime() + durationMs) ?? start;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@eventpulse`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
    );

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.venue) {
      lines.push(`LOCATION:${escapeText(event.venue)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function calendarFileName(name: string) {
  const clean = name
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${clean || "eventpulse"}.ics`;
}
