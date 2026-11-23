import crypto from "node:crypto";
import {
  CalendarFeedConfig,
  CalendarLabel,
  CalendarSyncStatus,
  PomodoroStorageData,
  TaskItem,
} from "../shared/types.js";
import { ParsedCalendarEvent, parseIcsForDate } from "./ics-parser.js";
import { getLocalDateStr, normalizeCalendarFeeds } from "./storage.js";

export type CalendarSyncResult = {
  ok: boolean;
  tasks: TaskItem[];
  calendarSync: CalendarSyncStatus;
  syncedCount: number;
  configuredCount: number;
};

function formatTimeHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildDeterministicId(calendarEventId: string): string {
  const hash = crypto.createHash("sha1").update(calendarEventId).digest("hex").slice(0, 12);
  return `gcal_${hash}`;
}

function toTaskItem(
  ev: ParsedCalendarEvent,
  label: CalendarLabel,
  todayStr: string,
  pomodoroMin: number,
  existing?: TaskItem
): TaskItem {
  const calendarEventId = `${label}:${ev.uid}:${ev.occurrenceDate}`;
  const durationMin = Math.max(0, Math.round((ev.end.getTime() - ev.start.getTime()) / 60000));
  const estPomodoros = ev.allDay
    ? 1
    : Math.max(1, Math.round(durationMin / Math.max(1, pomodoroMin)));

  return {
    id: existing?.id || buildDeterministicId(calendarEventId),
    title: ev.summary || "(Untitled event)",
    project: label,
    estPomodoros,
    completedPomodoros: existing?.completedPomodoros ?? 0,
    done: existing?.done ?? false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    source: "gcalendar",
    calendarLabel: label,
    calendarEventId,
    startTime: ev.allDay ? undefined : formatTimeHHMM(ev.start),
    endTime: ev.allDay ? undefined : formatTimeHHMM(ev.end),
    allDay: ev.allDay,
    eventDate: todayStr,
  };
}

const MAX_ICS_BYTES = 5 * 1024 * 1024;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^(fc|fd|fe80)/i.test(host)
  ) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function validateFeedUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "URL không hợp lệ" };
  }
  const allowLocal = process.env.POMODORO_ALLOW_LOCAL_ICS === "1";
  const host = parsed.hostname.toLowerCase();
  if (allowLocal && (host === "127.0.0.1" || host === "localhost") && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
    return { ok: true, url: parsed };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "URL phải sử dụng giao thức https://" };
  }
  if (isPrivateOrLocalHost(host)) {
    return { ok: false, error: "Không cho phép kết nối tới địa chỉ mạng nội bộ" };
  }
  return { ok: true, url: parsed };
}

function sanitizeErrorMsg(msg: string): string {
  return msg.replace(/\/private-[^/\s]+/gi, "/private-[REDACTED]");
}

async function fetchFeedEvents(
  feed: CalendarFeedConfig,
  todayStr: string
): Promise<{ label: CalendarLabel; events?: ParsedCalendarEvent[]; error?: string }> {
  const trimmed = feed.url.trim();
  const check = validateFeedUrl(trimmed);
  if (!check.ok) {
    return { label: feed.label, error: check.error };
  }
  try {
    const res = await fetch(check.url.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "text/calendar, text/plain" },
    });
    if (res.url) {
      const redirectCheck = validateFeedUrl(res.url);
      if (!redirectCheck.ok) {
        return { label: feed.label, error: redirectCheck.error };
      }
    }
    if (!res.ok) {
      const error =
        (res.status === 404 || res.status === 403) && /\/public\/basic\.ics/i.test(trimmed)
          ? `HTTP ${res.status} — Link /public/basic.ics chỉ dùng cho lịch công khai. Hãy dán 'Địa chỉ bí mật ở định dạng iCal' (/private-.../basic.ics).`
          : `HTTP ${res.status}`;
      return { label: feed.label, error };
    }
    const contentLen = Number(res.headers.get("content-length") || "0");
    if (Number.isFinite(contentLen) && contentLen > MAX_ICS_BYTES) {
      return { label: feed.label, error: "Tệp lịch .ics vượt quá giới hạn 5 MB" };
    }
    const text = await res.text();
    if (Buffer.byteLength(text, "utf-8") > MAX_ICS_BYTES) {
      return { label: feed.label, error: "Tệp lịch .ics vượt quá giới hạn 5 MB" };
    }
    if (!text.includes("BEGIN:VCALENDAR")) {
      return { label: feed.label, error: "Phản hồi không phải định dạng lịch .ics hợp lệ" };
    }
    return { label: feed.label, events: parseIcsForDate(text, todayStr) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối";
    return { label: feed.label, error: sanitizeErrorMsg(msg) };
  }
}

export async function syncCalendarTasks(
  data: PomodoroStorageData,
  targetDateStr?: string
): Promise<CalendarSyncResult> {
  const todayStr = targetDateStr || getLocalDateStr();
  const feeds = normalizeCalendarFeeds(data.settings.calendarFeeds);
  const activeFeeds = feeds.filter((f) => f.enabled && f.url.trim().length > 0);

  const manualTasks = data.tasks.filter((t) => t.source !== "gcalendar");
  const existingByEventId = new Map<string, TaskItem>();
  for (const t of data.tasks) {
    if (t.source === "gcalendar" && t.calendarEventId) {
      existingByEventId.set(t.calendarEventId, t);
    }
  }

  const results = await Promise.all(activeFeeds.map((f) => fetchFeedEvents(f, todayStr)));
  const errors: Partial<Record<CalendarLabel, string>> = {};
  const syncedTasks: TaskItem[] = [];

  for (const res of results) {
    if (res.error || !res.events) {
      errors[res.label] = res.error || "Không thể đồng bộ";
      for (const t of data.tasks) {
        if (t.source === "gcalendar" && t.calendarLabel === res.label && t.eventDate === todayStr) {
          syncedTasks.push(t);
        }
      }
      continue;
    }
    for (const ev of res.events) {
      const eventId = `${res.label}:${ev.uid}:${ev.occurrenceDate}`;
      const existing = existingByEventId.get(eventId);
      syncedTasks.push(toTaskItem(ev, res.label, todayStr, data.settings.pomodoroMin, existing));
    }
  }

  syncedTasks.sort((a, b) => {
    if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  data.tasks = [...syncedTasks, ...manualTasks];
  if (data.timer.activeTaskId && !data.tasks.some((t) => t.id === data.timer.activeTaskId)) {
    data.timer.activeTaskId = null;
  }

  const calendarSync: CalendarSyncStatus = {
    lastSyncedAt: new Date().toISOString(),
    errors,
  };
  data.calendarSync = calendarSync;

  return {
    ok: Object.keys(errors).length === 0,
    tasks: data.tasks,
    calendarSync,
    syncedCount: syncedTasks.length,
    configuredCount: activeFeeds.length,
  };
}
