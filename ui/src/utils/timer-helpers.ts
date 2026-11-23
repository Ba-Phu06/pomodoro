import {
  TimerMode,
  TimerState,
  PomodoroSettings,
  SummaryPeriod,
  AppSnapshot,
  DEFAULT_CALENDAR_FEEDS,
  DEFAULT_CALENDAR_SYNC,
} from '../types';

export const FALLBACK_SETTINGS: PomodoroSettings = {
  pomodoroMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  sound: 'bell',
  volume: 0.8,
  calendarFeeds: DEFAULT_CALENDAR_FEEDS.map((f) => ({ ...f })),
};

export const FALLBACK_TIMER: TimerState = {
  mode: 'pomodoro',
  status: 'idle',
  remainingSec: 25 * 60,
  endTimeMs: null,
  completedCount: 0,
  activeTaskId: null,
};

export const FALLBACK_SNAPSHOT: AppSnapshot = {
  initialTab: 'timer',
  timer: FALLBACK_TIMER,
  tasks: [],
  settings: FALLBACK_SETTINGS,
  calendarSync: DEFAULT_CALENDAR_SYNC,
  summary: {
    activitySummary: {
      hoursFocused: 0,
      daysAccessed: 1,
      dayStreak: 0,
      todayMinutes: 0,
      todaySessions: 0,
    },
    chart: {
      period: 'week',
      rangeLabel: 'This Week',
      buckets: [],
      projects: [],
    },
    recentSessions: [],
  },
};

export function getDurationSecForMode(mode: TimerMode, settings: PomodoroSettings): number {
  if (mode === 'pomodoro') return settings.pomodoroMin * 60;
  if (mode === 'short_break') return settings.shortBreakMin * 60;
  return settings.longBreakMin * 60;
}

export function getNextModeTransition(
  currentMode: TimerMode,
  completedCount: number,
  settings: PomodoroSettings
): { nextMode: TimerMode; nextCount: number; autoStart: boolean } {
  if (currentMode === 'pomodoro') {
    const nextCount = completedCount + 1;
    const isLong = nextCount % settings.longBreakInterval === 0;
    return {
      nextMode: isLong ? 'long_break' : 'short_break',
      nextCount,
      autoStart: settings.autoStartBreaks,
    };
  }
  return {
    nextMode: 'pomodoro',
    nextCount: completedCount,
    autoStart: settings.autoStartPomodoros,
  };
}

export function shiftAnchorDate(currentDateStr: string, period: SummaryPeriod, delta: number): string {
  const date = new Date(currentDateStr || new Date().toISOString());
  if (period === 'week') {
    date.setDate(date.getDate() + delta * 7);
  } else if (period === 'month') {
    date.setMonth(date.getMonth() + delta);
  } else {
    date.setFullYear(date.getFullYear() + delta);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
