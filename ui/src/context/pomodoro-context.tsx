import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { TimerMode, TimerState, TaskItem, PomodoroSettings, SummaryResponse, SummaryPeriod, AppSnapshot, CalendarSyncStatus, DEFAULT_CALENDAR_SYNC } from '../types';
import { unlockAudio, playBell } from '../utils/audio';
import { mcpBridge, callAppTool } from '../utils/mcp-client';
import { FALLBACK_SNAPSHOT, getDurationSecForMode, getNextModeTransition, shiftAnchorDate } from '../utils/timer-helpers';
import { getTodayLocalKey } from '../utils/format';
import { PomodoroContextValue } from './context-types';
import { createNewTask, updateTaskDone, removeTask, fetchSummaryPeriod, persistUpdatedSession, persistDeletedSession, recordManualSession, queryMiniPillStatus, toggleMiniPillTool, syncGoogleCalendarTool } from './data-actions';

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export const PomodoroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tab, setTab] = useState<'timer' | 'summary' | 'settings'>('timer');
  const [floatingPinned, setFloatingPinned] = useState(false);
  const [timer, setTimer] = useState<TimerState>(FALLBACK_SNAPSHOT.timer);
  const [tasks, setTasks] = useState<TaskItem[]>(FALLBACK_SNAPSHOT.tasks);
  const [settings, setSettings] = useState<PomodoroSettings>(FALLBACK_SNAPSHOT.settings);
  const [summary, setSummary] = useState<SummaryResponse>(FALLBACK_SNAPSHOT.summary);
  const [calendarSync, setCalendarSync] = useState<CalendarSyncStatus>(DEFAULT_CALENDAR_SYNC);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState<string>(getTodayLocalKey());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const timerRef = useRef(timer);
  timerRef.current = timer;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const handleSnapshot = useCallback((snap: Partial<AppSnapshot>) => {
    if (snap.initialTab) setTab(snap.initialTab);
    if (snap.timer) setTimer(snap.timer);
    if (snap.tasks) setTasks(snap.tasks);
    if (snap.settings) setSettings(snap.settings);
    if (snap.summary) setSummary(snap.summary);
    if (snap.calendarSync) setCalendarSync(snap.calendarSync);
  }, []);

  const syncCalendarTasks = useCallback(async (silent = false) => {
    if (!mcpBridge.isConnected()) {
      if (!silent) setSyncError('Đồng bộ lịch cần chạy trong Antigravity MCP host.');
      return;
    }
    setSyncingCalendar(true);
    setSyncError(null);
    try {
      const res = await syncGoogleCalendarTool();
      if (!res) return;
      setTasks(res.tasks);
      setCalendarSync(res.calendarSync);
      if (res.timer) setTimer(res.timer);
      const errCount = Object.keys(res.calendarSync.errors || {}).length;
      if (errCount > 0) {
        setSyncError(`Có ${errCount} lịch đồng bộ lỗi. Kiểm tra link .ics trong Settings.`);
      } else if (!silent) {
        setToast(`Đã đồng bộ ${res.syncedCount} công việc hôm nay`);
      }
    } catch (err) {
      if (!silent) {
        const rawMsg = err instanceof Error ? err.message : '';
        if (/not found|unknown tool|-32602/i.test(rawMsg)) {
          setSyncError('Server plugin Pomodoro đang chạy bản cũ. Hãy tắt/bật lại plugin Pomodoro hoặc khởi động lại Antigravity để cập nhật.');
        } else {
          setSyncError(rawMsg ? 'Lỗi đồng bộ: ' + rawMsg : 'Không thể kết nối Google Calendar.');
        }
      }
    } finally {
      setSyncingCalendar(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    mcpBridge.init({
      onInput: (args) => {
        const tabArg = (args as { tab?: 'timer' | 'summary' | 'settings' })?.tab;
        if (tabArg) setTab(tabArg);
      },
      onResult: (data) => handleSnapshot(data as Partial<AppSnapshot>),
    }).then((connected) => {
      if (!mounted) return;
      if (connected) {
        callAppTool<AppSnapshot>('pomodoro_get_state')
          .then((snap) => {
            if (!mounted) return;
            handleSnapshot(snap);
            const hasFeed = (snap.settings?.calendarFeeds || []).some((f) => f.enabled && f.url.trim());
            if (hasFeed) syncCalendarTasks(true);
          })
          .catch(() => {})
          .finally(() => mounted && setLoading(false));
        queryMiniPillStatus().then((p) => mounted && p !== null && setFloatingPinned(p));
      } else {
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [handleSnapshot]);

  const onSessionFinished = useCallback(async () => {
    const curTimer = timerRef.current;
    const curSettings = settingsRef.current;
    playBell(curSettings.sound, curSettings.volume);
    setToast(`${curTimer.mode === 'pomodoro' ? 'Focus session' : 'Break'} complete`);

    const activeTask = tasksRef.current.find((t) => t.id === curTimer.activeTaskId);
    const durationMin = curTimer.mode === 'pomodoro' ? curSettings.pomodoroMin : curSettings.shortBreakMin;
    const transition = getNextModeTransition(curTimer.mode, curTimer.completedCount, curSettings);
    const nextDurationSec = getDurationSecForMode(transition.nextMode, curSettings);
    const nextTimer: TimerState = {
      mode: transition.nextMode,
      status: transition.autoStart ? 'running' : 'idle',
      remainingSec: nextDurationSec,
      endTimeMs: transition.autoStart ? Date.now() + nextDurationSec * 1000 : null,
      completedCount: transition.nextCount,
      activeTaskId: curTimer.activeTaskId,
    };

    setTimer(nextTimer);
    if (mcpBridge.isConnected()) {
      const res = await callAppTool<{ summary: SummaryResponse; tasks?: TaskItem[] }>('pomodoro_record_session', {
        mode: curTimer.mode,
        durationMinutes: durationMin,
        project: activeTask?.project || 'General',
        taskId: activeTask?.id,
        taskTitle: activeTask?.title,
      }).catch(() => null);
      if (res?.summary) setSummary(res.summary);
      if (res?.tasks) setTasks(res.tasks);
      await callAppTool('pomodoro_save_timer', { timer: nextTimer }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (timer.status !== 'running' || !timer.endTimeMs) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((timer.endTimeMs! - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(interval);
        onSessionFinished();
      } else {
        setTimer((prev) => ({ ...prev, remainingSec: remaining }));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [timer.status, timer.endTimeMs, onSessionFinished]);

  const startTimer = useCallback(() => {
    unlockAudio();
    const updated: TimerState = { ...timer, status: 'running', endTimeMs: Date.now() + timer.remainingSec * 1000 };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer]);

  const pauseTimer = useCallback(() => {
    const remaining = timer.endTimeMs ? Math.max(0, Math.round((timer.endTimeMs - Date.now()) / 1000)) : timer.remainingSec;
    const updated: TimerState = { ...timer, status: 'paused', remainingSec: remaining, endTimeMs: null };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer]);

  const resetTimer = useCallback(() => {
    const sec = getDurationSecForMode(timer.mode, settings);
    const updated: TimerState = { ...timer, status: 'idle', remainingSec: sec, endTimeMs: null };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer, settings]);

  const skipTimer = useCallback(() => {
    const transition = getNextModeTransition(timer.mode, timer.completedCount, settings);
    const sec = getDurationSecForMode(transition.nextMode, settings);
    const updated: TimerState = { ...timer, mode: transition.nextMode, status: 'idle', remainingSec: sec, endTimeMs: null, completedCount: transition.nextCount };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer, settings]);

  const changeMode = useCallback((m: TimerMode) => {
    const sec = getDurationSecForMode(m, settings);
    const updated: TimerState = { ...timer, mode: m, status: 'idle', remainingSec: sec, endTimeMs: null };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer, settings]);

  const applyPreset = useCallback((pMin: number, sMin: number) => {
    const newSettings = { ...settings, pomodoroMin: pMin, shortBreakMin: sMin };
    setSettings(newSettings);
    if (timer.status === 'idle') {
      const sec = getDurationSecForMode(timer.mode, newSettings);
      const updated = { ...timer, remainingSec: sec };
      setTimer(updated);
      if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
    }
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_settings', { settings: newSettings }).catch(() => {});
  }, [settings, timer]);

  const selectActiveTask = useCallback((id: string | null) => {
    const updated = { ...timer, activeTaskId: id };
    setTimer(updated);
    if (mcpBridge.isConnected()) callAppTool('pomodoro_save_timer', { timer: updated }).catch(() => {});
  }, [timer]);

  const addTask = useCallback(async (title: string, project: string, est: number) => {
    const newTask = createNewTask(title, project, est);
    const updated = [...tasks, newTask];
    setTasks(updated);
    if (!timer.activeTaskId) selectActiveTask(newTask.id);
    if (mcpBridge.isConnected()) await callAppTool('pomodoro_save_tasks', { tasks: updated });
  }, [tasks, timer.activeTaskId, selectActiveTask]);

  const toggleTask = useCallback(async (id: string) => {
    const updated = updateTaskDone(tasks, id);
    setTasks(updated);
    if (mcpBridge.isConnected()) await callAppTool('pomodoro_save_tasks', { tasks: updated });
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const updated = removeTask(tasks, id);
    setTasks(updated);
    if (timer.activeTaskId === id) selectActiveTask(null);
    if (mcpBridge.isConnected()) await callAppTool('pomodoro_save_tasks', { tasks: updated });
  }, [tasks, timer.activeTaskId, selectActiveTask]);

  const updateSettings = useCallback(async (newSettings: PomodoroSettings) => {
    setSettings(newSettings);
    if (timer.status === 'idle') {
      const sec = getDurationSecForMode(timer.mode, newSettings);
      setTimer((prev) => ({ ...prev, remainingSec: sec }));
    }
    if (mcpBridge.isConnected()) await callAppTool('pomodoro_save_settings', { settings: newSettings });
  }, [timer]);

  const changeSummaryPeriod = useCallback(async (p: SummaryPeriod) => {
    const res = await fetchSummaryPeriod(p, anchorDate);
    if (res) setSummary(res);
  }, [anchorDate]);

  const navigateSummary = useCallback(async (delta: number) => {
    const newAnchor = shiftAnchorDate(anchorDate, summary.chart.period, delta);
    setAnchorDate(newAnchor);
    const res = await fetchSummaryPeriod(summary.chart.period, newAnchor);
    if (res) setSummary(res);
  }, [anchorDate, summary.chart.period]);

  const updateSession = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const res = await persistUpdatedSession(id, updates);
    if (res) setSummary(res);
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    const res = await persistDeletedSession(id);
    if (res) setSummary(res);
  }, []);

  useEffect(() => {
    if ((!floatingPinned && timer.status !== 'running') || !mcpBridge.isConnected()) return;
    const syncId = setInterval(() => {
      callAppTool<AppSnapshot>('pomodoro_get_state')
        .then((snap) => {
          if (snap?.timer) setTimer(snap.timer);
          if (snap?.summary) setSummary(snap.summary);
          if (snap?.tasks) setTasks(snap.tasks);
        })
        .catch(() => {});
      if (floatingPinned) queryMiniPillStatus().then((p) => p !== null && setFloatingPinned(p));
    }, 2000);
    return () => clearInterval(syncId);
  }, [floatingPinned, timer.status]);

  const toggleFloatingPill = useCallback(async () => {
    if (!mcpBridge.isConnected()) { setToast('Floating pill requires Antigravity MCP host.'); return; }
    try {
      const pinned = await toggleMiniPillTool();
      if (pinned !== null) setFloatingPinned(pinned);
    } catch { setToast('Could not toggle floating mini pill.'); }
  }, []);

  const addManualSession = useCallback(async (durationMin: number, project: string, taskTitle?: string) => {
    const res = await recordManualSession(durationMin, project, taskTitle);
    if (res?.summary) setSummary(res.summary);
    if (res?.tasks) setTasks(res.tasks);
  }, []);

  return (
    <PomodoroContext.Provider
      value={{
        tab, setTab, floatingPinned, toggleFloatingPill,
        timer, tasks, settings, summary, calendarSync, syncingCalendar, syncError, loading, toast,
        clearToast: () => setToast(null), startTimer, pauseTimer, resetTimer, skipTimer,
        changeMode, applyPreset, selectActiveTask, addTask, toggleTask, deleteTask,
        updateSettings, changeSummaryPeriod, navigateSummary, updateSession, deleteSession,
        addManualSession, syncCalendarTasks,
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = (): PomodoroContextValue => {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
};
