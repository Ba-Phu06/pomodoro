export type TimerMode = "pomodoro" | "short_break" | "long_break";
export type TimerStatus = "idle" | "running" | "paused";
export type BellSound = "bell" | "chime" | "beep";
export type SummaryPeriod = "week" | "month" | "year";
export type CalendarLabel = "Work" | "Read" | "Content Creation" | "Study";

export const CALENDAR_LABELS: CalendarLabel[] = [
  "Work",
  "Read",
  "Content Creation",
  "Study",
];

export type CalendarFeedConfig = {
  label: CalendarLabel;
  url: string;
  enabled: boolean;
};

export type CalendarSyncStatus = {
  lastSyncedAt: string | null;
  errors: Partial<Record<CalendarLabel, string>>;
};

export type TimerState = {
  mode: TimerMode;
  status: TimerStatus;
  remainingSec: number;
  endTimeMs: number | null;
  completedCount: number;
  activeTaskId: string | null;
};

export type TaskItem = {
  id: string;
  title: string;
  project: string;
  estPomodoros: number;
  completedPomodoros: number;
  done: boolean;
  createdAt: string;
  source?: "manual" | "gcalendar";
  calendarLabel?: CalendarLabel;
  calendarEventId?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  eventDate?: string;
};

export type FocusSession = {
  id: string;
  mode: TimerMode;
  durationMinutes: number;
  completedAt: string;
  project: string;
  taskId?: string;
  taskTitle?: string;
};

export type PomodoroSettings = {
  pomodoroMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  sound: BellSound;
  volume: number;
  calendarFeeds?: CalendarFeedConfig[];
};

export type SummaryBucket = {
  key: string;
  label: string;
  isToday: boolean;
  totalHours: number;
  byProject: Record<string, number>;
};

export type ActivitySummary = {
  hoursFocused: number;
  daysAccessed: number;
  dayStreak: number;
  todayMinutes: number;
  todaySessions: number;
};

export type SummaryChart = {
  period: SummaryPeriod;
  rangeLabel: string;
  buckets: SummaryBucket[];
  projects: string[];
};

export type SummaryResponse = {
  activitySummary: ActivitySummary;
  chart: SummaryChart;
  recentSessions: FocusSession[];
};

export type AppSnapshot = {
  initialTab: "timer" | "summary" | "settings";
  timer: TimerState;
  tasks: TaskItem[];
  settings: PomodoroSettings;
  summary: SummaryResponse;
  calendarSync?: CalendarSyncStatus;
};

export type PomodoroStorageData = {
  timer: TimerState;
  tasks: TaskItem[];
  settings: PomodoroSettings;
  sessions: FocusSession[];
  accessedDates: string[];
  calendarSync?: CalendarSyncStatus;
};

export const DEFAULT_CALENDAR_FEEDS: CalendarFeedConfig[] = CALENDAR_LABELS.map((label) => ({
  label,
  url: "",
  enabled: true,
}));

export const DEFAULT_CALENDAR_SYNC: CalendarSyncStatus = {
  lastSyncedAt: null,
  errors: {},
};

export const DEFAULT_SETTINGS: PomodoroSettings = {
  pomodoroMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  sound: "bell",
  volume: 0.8,
  calendarFeeds: DEFAULT_CALENDAR_FEEDS.map((f) => ({ ...f })),
};

export const DEFAULT_TIMER: TimerState = {
  mode: "pomodoro",
  status: "idle",
  remainingSec: 25 * 60,
  endTimeMs: null,
  completedCount: 0,
  activeTaskId: null,
};
