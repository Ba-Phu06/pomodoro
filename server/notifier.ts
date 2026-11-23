import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { BellSound, FocusSession, PomodoroStorageData, TimerMode } from "../shared/types.js";
import { PomodoroStorage, getLocalDateStr } from "./storage.js";

let lastNotifyMs = 0;

function getPopupScriptPath(): string {
  const nextTo = path.resolve(__dirname, "notify-popup.ps1");
  if (fs.existsSync(nextTo)) return nextTo;
  return path.resolve(__dirname, "../server/notify-popup.ps1");
}

function getAccentHex(mode: TimerMode): string {
  if (mode === "short_break") return "#389E8B";
  if (mode === "long_break") return "#4A7FC1";
  return "#E05A4F";
}

function getModeMinutes(data: PomodoroStorageData, mode: TimerMode): number {
  if (mode === "short_break") return data.settings.shortBreakMin || 5;
  if (mode === "long_break") return data.settings.longBreakMin || 15;
  return data.settings.pomodoroMin || 25;
}

export function getNextModeInfo(data: PomodoroStorageData, currentMode: TimerMode): {
  nextMode: TimerMode;
  nextCount: number;
  autoStart: boolean;
  nextMinutes: number;
} {
  const interval = Math.max(1, data.settings.longBreakInterval || 4);
  if (currentMode === "pomodoro") {
    const nextCount = (data.timer.completedCount || 0) + 1;
    const nextMode: TimerMode = nextCount % interval === 0 ? "long_break" : "short_break";
    return { nextMode, nextCount, autoStart: Boolean(data.settings.autoStartBreaks), nextMinutes: getModeMinutes(data, nextMode) };
  }
  return {
    nextMode: "pomodoro",
    nextCount: data.timer.completedCount || 0,
    autoStart: Boolean(data.settings.autoStartPomodoros),
    nextMinutes: getModeMinutes(data, "pomodoro"),
  };
}

export function getCompletionAlertText(mode: TimerMode, durationMinutes: number, nextMinutes: number): {
  title: string;
  body: string;
} {
  if (mode === "pomodoro") {
    return {
      title: "Pomodoro hoàn thành!",
      body: `Bạn đã tập trung xong ${durationMinutes} phút. Nghỉ ngơi ${nextMinutes} phút nhé!`,
    };
  }
  return {
    title: "Hết giờ nghỉ!",
    body: `Đã xong ${durationMinutes} phút nghỉ. Sẵn sàng cho phiên tập trung ${nextMinutes} phút tiếp theo.`,
  };
}

export function showDesktopNotification(opts: {
  title: string;
  body: string;
  mode: TimerMode;
  sound: BellSound;
  volume: number;
  dataFile?: string;
  actionLabel?: string;
}): boolean {
  if (process.platform !== "win32" || process.env.POMODORO_DISABLE_GUI === "1") return false;
  const scriptPath = getPopupScriptPath();
  if (!fs.existsSync(scriptPath)) return false;

  const titleB64 = Buffer.from(opts.title, "utf-8").toString("base64");
  const bodyB64 = Buffer.from(opts.body, "utf-8").toString("base64");
  const args = [
    "-NoProfile", "-WindowStyle", "Hidden", "-STA", "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
    "-TitleB64", titleB64, "-BodyB64", bodyB64,
    "-AccentHex", getAccentHex(opts.mode),
    "-Sound", opts.sound, "-Volume", String(opts.volume),
  ];
  if (opts.dataFile) {
    args.push("-DataFile", opts.dataFile);
  }
  if (opts.actionLabel) {
    args.push("-ActionLabelB64", Buffer.from(opts.actionLabel, "utf-8").toString("base64"));
  }
  const child = spawn("powershell.exe", args, { detached: false, stdio: "ignore", windowsHide: true });
  return Boolean(child.pid);
}

export function maybeNotifyCompletion(
  data: PomodoroStorageData,
  finishedMode: TimerMode,
  durationMinutes: number,
  nextMinutes: number,
  opts?: { dataFile?: string; autoStart?: boolean }
): void {
  const now = Date.now();
  if (now - lastNotifyMs < 6000) return;
  lastNotifyMs = now;
  const alert = getCompletionAlertText(finishedMode, durationMinutes, nextMinutes);
  const actionLabel = !opts?.autoStart
    ? (finishedMode === "pomodoro"
      ? `Bắt đầu nghỉ (${nextMinutes}p)`
      : `Bắt đầu tập trung (${nextMinutes}p)`)
    : undefined;
  showDesktopNotification({
    title: alert.title,
    body: alert.body,
    mode: finishedMode,
    sound: data.settings.sound || "bell",
    volume: data.settings.volume ?? 0.8,
    dataFile: opts?.dataFile,
    actionLabel,
  });
}

export function hasRecentSession(data: PomodoroStorageData, mode: TimerMode, windowMs = 6000): boolean {
  const last = data.sessions[data.sessions.length - 1];
  if (!last || last.mode !== mode) return false;
  const diff = Math.abs(Date.now() - Date.parse(last.completedAt));
  return Number.isFinite(diff) && diff < windowMs;
}

function handleExpiredTimer(storage: PomodoroStorage): void {
  const data = storage.loadData();
  const t = data.timer;
  if (t.status !== "running" || t.endTimeMs === null || Date.now() < t.endTimeMs) return;

  const finishedMode = t.mode || "pomodoro";
  const durMin = getModeMinutes(data, finishedMode);
  const next = getNextModeInfo(data, finishedMode);

  if (!hasRecentSession(data, finishedMode)) {
    const activeTask = t.activeTaskId ? data.tasks.find((item) => item.id === t.activeTaskId) : undefined;
    const session: FocusSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mode: finishedMode,
      durationMinutes: durMin,
      completedAt: new Date().toISOString(),
      project: activeTask?.project?.trim() || "General",
      taskId: activeTask?.id,
      taskTitle: activeTask?.title,
    };
    data.sessions.push(session);
    if (finishedMode === "pomodoro" && activeTask) {
      activeTask.completedPomodoros = (activeTask.completedPomodoros || 0) + 1;
    }
  }

  const today = getLocalDateStr();
  if (!data.accessedDates.includes(today)) data.accessedDates.push(today);
  const nextSec = next.nextMinutes * 60;
  data.timer = {
    mode: next.nextMode,
    status: next.autoStart ? "running" : "idle",
    remainingSec: nextSec,
    endTimeMs: next.autoStart ? Date.now() + nextSec * 1000 : null,
    completedCount: next.nextCount,
    activeTaskId: t.activeTaskId,
  };
  storage.saveData(data);
  maybeNotifyCompletion(data, finishedMode, durMin, next.nextMinutes, {
    dataFile: path.join(storage.getDataDir(), "pomodoro-data.json"),
    autoStart: next.autoStart,
  });
}

export function startTimerWatcher(storage: PomodoroStorage): NodeJS.Timeout {
  const handle = setInterval(() => {
    try {
      handleExpiredTimer(storage);
    } catch (err) {
      console.error("Timer watcher error:", err);
    }
  }, 1000);
  handle.unref();
  return handle;
}
