import { TaskItem, SummaryResponse, SummaryPeriod, CalendarSyncStatus, TimerState } from '../types';
import { callAppTool, mcpBridge } from '../utils/mcp-client';

export function createNewTask(title: string, project: string, est: number): TaskItem {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    project: project.trim() || 'General',
    estPomodoros: est > 0 ? est : 1,
    completedPomodoros: 0,
    done: false,
    createdAt: new Date().toISOString(),
  };
}

export function updateTaskDone(tasks: TaskItem[], id: string): TaskItem[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

export function removeTask(tasks: TaskItem[], id: string): TaskItem[] {
  return tasks.filter((t) => t.id !== id);
}

export async function fetchSummaryPeriod(period: SummaryPeriod, anchorDate: string): Promise<SummaryResponse | null> {
  if (!mcpBridge.isConnected()) return null;
  return callAppTool<SummaryResponse>('pomodoro_get_summary', { period, anchorDate });
}

export async function persistUpdatedSession(id: string, updates: Record<string, unknown>): Promise<SummaryResponse | null> {
  if (!mcpBridge.isConnected()) return null;
  const res = await callAppTool<{ summary: SummaryResponse }>('pomodoro_update_session', { id, ...updates });
  return res.summary ?? null;
}

export async function persistDeletedSession(id: string): Promise<SummaryResponse | null> {
  if (!mcpBridge.isConnected()) return null;
  const res = await callAppTool<{ summary: SummaryResponse }>('pomodoro_delete_session', { id });
  return res.summary ?? null;
}

export async function recordManualSession(
  durationMinutes: number,
  project: string,
  taskTitle?: string
): Promise<{ summary?: SummaryResponse; tasks?: TaskItem[] } | null> {
  if (!mcpBridge.isConnected()) return null;
  return callAppTool<{ summary?: SummaryResponse; tasks?: TaskItem[] }>('pomodoro_record_session', {
    mode: 'pomodoro',
    durationMinutes,
    project: project.trim() || 'General',
    taskTitle: taskTitle?.trim() || undefined,
    completedAt: new Date().toISOString(),
  });
}

export async function queryMiniPillStatus(): Promise<boolean | null> {
  if (!mcpBridge.isConnected()) return null;
  const res = await callAppTool<{ pinned?: boolean }>('pomodoro_toggle_mini_pill', { action: 'status' }).catch(() => null);
  return typeof res?.pinned === 'boolean' ? res.pinned : null;
}

export async function toggleMiniPillTool(): Promise<boolean | null> {
  if (!mcpBridge.isConnected()) return null;
  const res = await callAppTool<{ pinned?: boolean }>('pomodoro_toggle_mini_pill', { action: 'toggle' });
  return typeof res?.pinned === 'boolean' ? res.pinned : null;
}

export type CalendarSyncToolResponse = {
  ok: boolean;
  tasks: TaskItem[];
  calendarSync: CalendarSyncStatus;
  syncedCount: number;
  configuredCount: number;
  timer?: TimerState;
};

export async function syncGoogleCalendarTool(): Promise<CalendarSyncToolResponse | null> {
  if (!mcpBridge.isConnected()) return null;
  return callAppTool<CalendarSyncToolResponse>('pomodoro_sync_calendar', {});
}
