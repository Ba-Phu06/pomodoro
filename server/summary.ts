import {
  FocusSession,
  PomodoroStorageData,
  SummaryBucket,
  SummaryPeriod,
  SummaryResponse,
} from "../shared/types.js";
import { getLocalDateStr } from "./storage.js";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeDayStreak(sessions: FocusSession[], todayStr: string): number {
  const pomodoroDays = new Set<string>();
  for (const s of sessions) {
    if (s.mode === "pomodoro") {
      pomodoroDays.add(getLocalDateStr(new Date(s.completedAt)));
    }
  }

  const [y, m, d] = todayStr.split("-").map(Number);
  const curr = new Date(y, m - 1, d);

  if (!pomodoroDays.has(todayStr)) {
    curr.setDate(curr.getDate() - 1);
    if (!pomodoroDays.has(getLocalDateStr(curr))) {
      return 0;
    }
  }

  let streak = 0;
  while (pomodoroDays.has(getLocalDateStr(curr))) {
    streak++;
    curr.setDate(curr.getDate() - 1);
  }
  return streak;
}

function buildWeekBuckets(anchor: Date, todayStr: string) {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const dayOfWeek = d.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);

  const buckets: SummaryBucket[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const key = getLocalDateStr(dayDate);
    const label = `${MONTH_SHORT[dayDate.getMonth()]}-${String(dayDate.getDate()).padStart(2, "0")} (${DAY_SHORT[dayDate.getDay()]})`;
    buckets.push({ key, label, isToday: key === todayStr, totalHours: 0, byProject: {} });
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const rangeLabel = `${MONTH_SHORT[monday.getMonth()]} ${monday.getDate()} - ${MONTH_SHORT[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;
  return { buckets, rangeLabel };
}

function buildMonthBuckets(anchor: Date, todayStr: string) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets: SummaryBucket[] = [];

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayDate = new Date(year, month, dayNum);
    const key = getLocalDateStr(dayDate);
    buckets.push({ key, label: String(dayNum), isToday: key === todayStr, totalHours: 0, byProject: {} });
  }
  const rangeLabel = `${MONTH_FULL[month]} ${year}`;
  return { buckets, rangeLabel };
}

function buildYearBuckets(anchor: Date, todayStr: string) {
  const year = anchor.getFullYear();
  const [ty, tm] = todayStr.split("-").map(Number);
  const buckets: SummaryBucket[] = [];

  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const isToday = ty === year && tm === m + 1;
    buckets.push({ key, label: MONTH_SHORT[m], isToday, totalHours: 0, byProject: {} });
  }
  return { buckets, rangeLabel: String(year) };
}

function populateBuckets(buckets: SummaryBucket[], sessions: FocusSession[], period: SummaryPeriod) {
  for (const s of sessions) {
    if (s.mode !== "pomodoro") continue;
    const sessionDateStr = getLocalDateStr(new Date(s.completedAt));
    const hours = s.durationMinutes / 60;
    const proj = (s.project && s.project.trim()) ? s.project.trim() : "No Project";

    for (const b of buckets) {
      const matches = period === "year" ? sessionDateStr.startsWith(b.key) : sessionDateStr === b.key;
      if (matches) {
        b.totalHours = Math.round((b.totalHours + hours) * 100) / 100;
        b.byProject[proj] = Math.round(((b.byProject[proj] || 0) + hours) * 100) / 100;
      }
    }
  }
}

export function computeSummary(
  data: Pick<PomodoroStorageData, "sessions" | "accessedDates">,
  period: SummaryPeriod = "week",
  anchorDate: string | Date = new Date()
): SummaryResponse {
  const anchor = typeof anchorDate === "string" ? new Date(anchorDate) : anchorDate;
  const todayStr = getLocalDateStr(new Date());
  const sessions = data.sessions || [];
  const accessed = new Set(data.accessedDates || []);

  let totalPomodoroMin = 0;
  let todayPomodoroMin = 0;
  let todayPomodoroCount = 0;
  const projectSet = new Set<string>();

  for (const s of sessions) {
    const dateStr = getLocalDateStr(new Date(s.completedAt));
    accessed.add(dateStr);
    if (s.project && s.project.trim()) projectSet.add(s.project.trim());
    if (s.mode === "pomodoro") {
      totalPomodoroMin += s.durationMinutes;
      if (dateStr === todayStr) {
        todayPomodoroMin += s.durationMinutes;
        todayPomodoroCount++;
      }
    }
  }

  const { buckets, rangeLabel } =
    period === "month"
      ? buildMonthBuckets(anchor, todayStr)
      : period === "year"
        ? buildYearBuckets(anchor, todayStr)
        : buildWeekBuckets(anchor, todayStr);

  populateBuckets(buckets, sessions, period);

  const recentSessions = sessions
    .slice()
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 50);

  return {
    activitySummary: {
      hoursFocused: Math.round((totalPomodoroMin / 60) * 10) / 10,
      daysAccessed: accessed.size,
      dayStreak: computeDayStreak(sessions, todayStr),
      todayMinutes: todayPomodoroMin,
      todaySessions: todayPomodoroCount,
    },
    chart: {
      period,
      rangeLabel,
      buckets,
      projects: Array.from(projectSet).sort(),
    },
    recentSessions,
  };
}
