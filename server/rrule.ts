export type RRuleFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type ByDayToken = {
  weekday: number; // 0 = SU .. 6 = SA
  nth?: number;
};

export type RRuleSpec = {
  freq: RRuleFreq;
  interval: number;
  count?: number;
  until?: Date;
  byDay?: ByDayToken[];
};

const WEEKDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const MAX_STEPS = 5000;

function parseUntilDate(val: string): Date | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(val.trim());
  if (!m) return undefined;
  const [, y, mo, d, hh, mm, ss, isUtc] = m;
  if (!hh) return new Date(+y, +mo - 1, +d, 23, 59, 59, 999);
  if (isUtc) return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  return new Date(+y, +mo - 1, +d, +hh, +mm, +ss);
}

function parseByDay(raw: string): ByDayToken[] {
  const tokens: ByDayToken[] = [];
  for (const part of raw.split(",")) {
    const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(part.trim());
    if (!m) continue;
    tokens.push({
      weekday: WEEKDAY_MAP[m[2]],
      nth: m[1] ? parseInt(m[1], 10) : undefined,
    });
  }
  return tokens;
}

export function parseRRule(raw: string): RRuleSpec | null {
  const parts = raw.trim().split(";");
  let freq: RRuleFreq | undefined;
  let interval = 1;
  let count: number | undefined;
  let until: Date | undefined;
  let byDay: ByDayToken[] | undefined;

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    const key = k.trim().toUpperCase();
    const val = v.trim().toUpperCase();
    if (key === "FREQ" && (val === "DAILY" || val === "WEEKLY" || val === "MONTHLY" || val === "YEARLY")) {
      freq = val;
    } else if (key === "INTERVAL") {
      interval = Math.max(1, parseInt(val, 10) || 1);
    } else if (key === "COUNT") {
      count = Math.max(1, parseInt(val, 10) || 1);
    } else if (key === "UNTIL") {
      until = parseUntilDate(val);
    } else if (key === "BYDAY") {
      byDay = parseByDay(val);
    }
  }
  return freq ? { freq, interval, count, until, byDay } : null;
}

function matchesNthWeekday(d: Date, token: ByDayToken): boolean {
  if (d.getDay() !== token.weekday) return false;
  if (token.nth === undefined) return true;
  if (token.nth > 0) {
    return Math.ceil(d.getDate() / 7) === token.nth;
  }
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const fromEnd = Math.ceil((daysInMonth - d.getDate() + 1) / 7);
  return fromEnd === Math.abs(token.nth);
}

function getNextCandidate(cur: Date, freq: RRuleFreq, interval: number, hasByDay: boolean): Date {
  const next = new Date(cur.getTime());
  if (freq === "DAILY") {
    next.setDate(next.getDate() + interval);
  } else if (freq === "WEEKLY") {
    if (hasByDay) {
      next.setDate(next.getDate() + 1);
      if (next.getDay() === 0 && interval > 1) {
        next.setDate(next.getDate() + (interval - 1) * 7);
      }
    } else {
      next.setDate(next.getDate() + 7 * interval);
    }
  } else if (freq === "MONTHLY") {
    if (hasByDay) {
      next.setDate(next.getDate() + 1);
      if (next.getDate() === 1 && interval > 1) {
        next.setMonth(next.getMonth() + interval - 1);
      }
    } else {
      next.setMonth(next.getMonth() + interval);
    }
  } else {
    next.setFullYear(next.getFullYear() + interval);
  }
  return next;
}

function isValidOccurrence(cur: Date, start: Date, rule: RRuleSpec): boolean {
  if (cur.getTime() < start.getTime()) return false;
  if (!rule.byDay || rule.byDay.length === 0) return true;
  if (rule.freq === "WEEKLY") {
    return rule.byDay.some((t) => t.weekday === cur.getDay());
  }
  if (rule.freq === "MONTHLY") {
    return rule.byDay.some((t) => matchesNthWeekday(cur, t));
  }
  return true;
}

function fastForwardStart(start: Date, rule: RRuleSpec, windowStartMs: number): Date {
  const cur = new Date(start.getTime());
  if (rule.count !== undefined || start.getTime() >= windowStartMs) return cur;

  const diffMs = windowStartMs - start.getTime();
  const winDate = new Date(windowStartMs);

  if (rule.freq === "DAILY") {
    const jump = (Math.floor(diffMs / 86400000 / rule.interval) - 1) * rule.interval;
    if (jump > 0) cur.setDate(cur.getDate() + jump);
  } else if (rule.freq === "WEEKLY") {
    const jump = (Math.floor(diffMs / (7 * 86400000) / rule.interval) - 1) * 7 * rule.interval;
    if (jump > 0) cur.setDate(cur.getDate() + jump);
  } else if (rule.freq === "MONTHLY") {
    const monthsDiff =
      (winDate.getFullYear() - start.getFullYear()) * 12 + (winDate.getMonth() - start.getMonth());
    const jump = (Math.floor(monthsDiff / rule.interval) - 1) * rule.interval;
    if (jump > 0) cur.setMonth(cur.getMonth() + jump);
  } else if (rule.freq === "YEARLY") {
    const yearsDiff = winDate.getFullYear() - start.getFullYear();
    const jump = (Math.floor(yearsDiff / rule.interval) - 1) * rule.interval;
    if (jump > 0) cur.setFullYear(cur.getFullYear() + jump);
  }

  return cur;
}

export function expandRRuleForDay(
  start: Date,
  durationMs: number,
  rule: RRuleSpec,
  targetDayStart: Date,
  targetDayEnd: Date,
  isAllDay: boolean
): Date[] {
  const results: Date[] = [];
  const effectiveDur = Math.max(durationMs, isAllDay ? 86400000 : 1);
  let cur = fastForwardStart(start, rule, targetDayStart.getTime() - durationMs);
  let emitted = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (rule.until && cur.getTime() > rule.until.getTime()) break;
    if (cur.getTime() >= targetDayEnd.getTime()) break;

    if (isValidOccurrence(cur, start, rule)) {
      emitted++;
      if (rule.count !== undefined && emitted > rule.count) break;
      const occEnd = cur.getTime() + effectiveDur;
      if (occEnd > targetDayStart.getTime() && cur.getTime() < targetDayEnd.getTime()) {
        results.push(new Date(cur.getTime()));
      }
    }

    const hasByDay = Boolean(rule.byDay && rule.byDay.length > 0);
    cur = getNextCandidate(cur, rule.freq, rule.interval, hasByDay);
  }

  return results;
}
