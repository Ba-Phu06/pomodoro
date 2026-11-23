import { expandRRuleForDay, parseRRule } from "./rrule.js";

export type ParsedCalendarEvent = {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  occurrenceDate: string;
};

type ParsedDateVal = { date: Date; allDay: boolean };

type RawVEvent = {
  uid: string;
  summary: string;
  dtStart?: ParsedDateVal;
  dtEnd?: ParsedDateVal;
  rrule?: string;
  exdates: number[];
  recurrenceId?: ParsedDateVal;
  cancelled: boolean;
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unescapeIcsText(val: string): string {
  return val
    .replace(/\\n|\\N/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function convertTzidToUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tzid: string
): Date {
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm, ss);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value])
    );
    const hr = parts.hour === "24" ? 0 : Number(parts.hour);
    const tzAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hr,
      Number(parts.minute),
      Number(parts.second)
    );
    return new Date(utcGuess - (tzAsUtc - utcGuess));
  } catch {
    return new Date(y, mo - 1, d, hh, mm, ss);
  }
}

function parseIcsDate(rawVal: string, params: Record<string, string>): ParsedDateVal | undefined {
  const val = rawVal.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(val);
  if (!m) return undefined;
  const [, y, mo, d, hh, mm, ss, isUtc] = m;
  if (!hh || params.VALUE === "DATE") {
    return { date: new Date(+y, +mo - 1, +d, 0, 0, 0, 0), allDay: true };
  }
  if (isUtc) {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)), allDay: false };
  }
  if (params.TZID) {
    return {
      date: convertTzidToUtc(+y, +mo, +d, +hh, +mm, +ss, params.TZID),
      allDay: false,
    };
  }
  return { date: new Date(+y, +mo - 1, +d, +hh, +mm, +ss), allDay: false };
}

function parsePropertyLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const left = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const parts = left.split(";");
  const name = parts[0].trim().toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf("=");
    if (eq !== -1) {
      params[parts[i].slice(0, eq).trim().toUpperCase()] = parts[i]
        .slice(eq + 1)
        .trim()
        .replace(/^"|"$/g, "");
    }
  }
  return { name, params, value };
}

function parseVEventBlock(lines: string[]): RawVEvent | null {
  const ev: RawVEvent = { uid: "", summary: "", exdates: [], cancelled: false };
  for (const line of lines) {
    const prop = parsePropertyLine(line);
    if (!prop) continue;
    if (prop.name === "UID") ev.uid = prop.value.trim();
    else if (prop.name === "SUMMARY") ev.summary = unescapeIcsText(prop.value);
    else if (prop.name === "DTSTART") ev.dtStart = parseIcsDate(prop.value, prop.params);
    else if (prop.name === "DTEND") ev.dtEnd = parseIcsDate(prop.value, prop.params);
    else if (prop.name === "RRULE") ev.rrule = prop.value.trim();
    else if (prop.name === "RECURRENCE-ID") ev.recurrenceId = parseIcsDate(prop.value, prop.params);
    else if (prop.name === "STATUS" && prop.value.trim().toUpperCase() === "CANCELLED") {
      ev.cancelled = true;
    } else if (prop.name === "EXDATE") {
      for (const part of prop.value.split(",")) {
        const parsed = parseIcsDate(part, prop.params);
        if (parsed) ev.exdates.push(parsed.date.getTime());
      }
    }
  }
  return ev.dtStart ? ev : null;
}

function collectVEvents(icsText: string): RawVEvent[] {
  const unfolded = icsText.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: RawVEvent[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = [];
    } else if (upper === "END:VEVENT" && current) {
      const parsed = parseVEventBlock(current);
      if (parsed) events.push(parsed);
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  return events;
}

function buildExcludedMap(events: RawVEvent[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const addEx = (uid: string, key: string) => {
    if (!map.has(uid)) map.set(uid, new Set());
    map.get(uid)!.add(key);
  };
  for (const ev of events) {
    for (const ts of ev.exdates) {
      addEx(ev.uid, toDateKey(new Date(ts)));
    }
    if (ev.recurrenceId) {
      addEx(ev.uid, toDateKey(ev.recurrenceId.date));
    }
  }
  return map;
}

export function parseIcsForDate(icsText: string, targetDateStr: string): ParsedCalendarEvent[] {
  const [ty, tm, td] = targetDateStr.split("-").map(Number);
  const dayStart = new Date(ty, tm - 1, td, 0, 0, 0, 0);
  const dayEnd = new Date(ty, tm - 1, td + 1, 0, 0, 0, 0);
  const rawEvents = collectVEvents(icsText);
  const excludedByUid = buildExcludedMap(rawEvents);
  const results: ParsedCalendarEvent[] = [];

  for (const ev of rawEvents) {
    if (ev.cancelled || !ev.dtStart) continue;
    const start = ev.dtStart.date;
    const allDay = ev.dtStart.allDay;
    const defaultEnd = allDay
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
      : new Date(start.getTime() + 30 * 60000);
    const end = ev.dtEnd ? ev.dtEnd.date : defaultEnd;
    const durationMs = Math.max(0, end.getTime() - start.getTime());

    if (ev.rrule && !ev.recurrenceId) {
      const rule = parseRRule(ev.rrule);
      if (!rule) continue;
      const occurrences = expandRRuleForDay(start, durationMs, rule, dayStart, dayEnd, allDay);
      const exSet = excludedByUid.get(ev.uid);
      for (const occStart of occurrences) {
        const occKey = toDateKey(occStart);
        if (exSet?.has(occKey)) continue;
        results.push({
          uid: ev.uid || `${occKey}_${ev.summary}`,
          summary: ev.summary,
          start: occStart,
          end: new Date(occStart.getTime() + durationMs),
          allDay,
          occurrenceDate: targetDateStr,
        });
      }
    } else {
      const effectiveEnd = Math.max(end.getTime(), start.getTime() + (allDay ? 86400000 : 1));
      if (effectiveEnd > dayStart.getTime() && start.getTime() < dayEnd.getTime()) {
        results.push({
          uid: ev.uid || `${targetDateStr}_${ev.summary}`,
          summary: ev.summary,
          start,
          end: new Date(start.getTime() + durationMs),
          allDay,
          occurrenceDate: targetDateStr,
        });
      }
    }
  }

  return results.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });
}
