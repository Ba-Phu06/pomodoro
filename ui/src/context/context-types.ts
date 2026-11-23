import {
  TimerMode,
  TimerState,
  TaskItem,
  PomodoroSettings,
  SummaryResponse,
  SummaryPeriod,
  CalendarSyncStatus,
} from '../types';

export interface PomodoroContextValue {
  tab: 'timer' | 'summary' | 'settings';
  setTab: (tab: 'timer' | 'summary' | 'settings') => void;
  floatingPinned: boolean;
  toggleFloatingPill: () => Promise<void>;
  timer: TimerState;
  tasks: TaskItem[];
  settings: PomodoroSettings;
  summary: SummaryResponse;
  calendarSync: CalendarSyncStatus;
  syncingCalendar: boolean;
  syncError: string | null;
  loading: boolean;
  toast: string | null;
  clearToast: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  skipTimer: () => void;
  changeMode: (mode: TimerMode) => void;
  applyPreset: (pMin: number, sMin: number) => void;
  selectActiveTask: (id: string | null) => void;
  addTask: (title: string, project: string, est: number) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateSettings: (s: PomodoroSettings) => Promise<void>;
  changeSummaryPeriod: (p: SummaryPeriod) => Promise<void>;
  navigateSummary: (delta: number) => Promise<void>;
  updateSession: (id: string, updates: Record<string, unknown>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  addManualSession: (durationMin: number, project: string, taskTitle?: string) => Promise<void>;
  syncCalendarTasks: (silent?: boolean) => Promise<void>;
}
