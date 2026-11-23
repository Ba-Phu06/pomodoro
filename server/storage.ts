import fs from "node:fs";
import path from "node:path";
import {
  CALENDAR_LABELS,
  CalendarFeedConfig,
  DEFAULT_CALENDAR_SYNC,
  DEFAULT_SETTINGS,
  DEFAULT_TIMER,
  PomodoroStorageData,
} from "../shared/types.js";

export function normalizeCalendarFeeds(
  feeds?: CalendarFeedConfig[]
): CalendarFeedConfig[] {
  const byLabel = new Map<string, CalendarFeedConfig>();
  if (Array.isArray(feeds)) {
    for (const f of feeds) {
      if (f && typeof f.label === "string") {
        byLabel.set(f.label, {
          label: f.label,
          url: typeof f.url === "string" ? f.url : "",
          enabled: typeof f.enabled === "boolean" ? f.enabled : true,
        });
      }
    }
  }
  return CALENDAR_LABELS.map((label) => {
    const existing = byLabel.get(label);
    return existing ? { ...existing, label } : { label, url: "", enabled: true };
  });
}

export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultStorageData(): PomodoroStorageData {
  return {
    timer: { ...DEFAULT_TIMER },
    tasks: [],
    settings: {
      ...DEFAULT_SETTINGS,
      calendarFeeds: normalizeCalendarFeeds(),
    },
    sessions: [],
    accessedDates: [getLocalDateStr()],
    calendarSync: { ...DEFAULT_CALENDAR_SYNC, errors: {} },
  };
}

export class PomodoroStorage {
  private filePath: string;
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "pomodoro-data.json");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  getDataDir(): string {
    return this.dataDir;
  }

  loadData(): PomodoroStorageData {
    if (!fs.existsSync(this.filePath)) {
      const initial = getDefaultStorageData();
      this.saveData(initial);
      return initial;
    }
    try {
      const content = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(content) as Partial<PomodoroStorageData>;
      const settings = parsed.settings
        ? {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            calendarFeeds: normalizeCalendarFeeds(parsed.settings.calendarFeeds),
          }
        : {
            ...DEFAULT_SETTINGS,
            calendarFeeds: normalizeCalendarFeeds(),
          };
      return {
        timer: parsed.timer || { ...DEFAULT_TIMER },
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        settings,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        accessedDates: Array.isArray(parsed.accessedDates)
          ? parsed.accessedDates
          : [getLocalDateStr()],
        calendarSync: parsed.calendarSync
          ? {
              lastSyncedAt: parsed.calendarSync.lastSyncedAt ?? null,
              errors: parsed.calendarSync.errors ?? {},
            }
          : { ...DEFAULT_CALENDAR_SYNC, errors: {} },
      };
    } catch (err) {
      console.error("Failed to read storage data, resetting:", err);
      const fallback = getDefaultStorageData();
      this.saveData(fallback);
      return fallback;
    }
  }

  saveData(data: PomodoroStorageData): void {
    const tmpPath = path.join(
      this.dataDir,
      `pomodoro-data.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    );
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tmpPath, this.filePath);
  }

  recordAccess(data: PomodoroStorageData, dateStr?: string): PomodoroStorageData {
    const today = dateStr || getLocalDateStr();
    if (!data.accessedDates.includes(today)) {
      data.accessedDates.push(today);
      this.saveData(data);
    }
    return data;
  }
}
