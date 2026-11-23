import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppSnapshot, FocusSession, SummaryPeriod } from "../shared/types.js";
import { PomodoroStorage } from "./storage.js";
import { syncCalendarTasks } from "./calendar-sync.js";
import { computeSummary } from "./summary.js";
import { toggleMiniPill } from "./mini-pill.js";
import {
  getNextModeInfo,
  hasRecentSession,
  maybeNotifyCompletion,
  showDesktopNotification,
} from "./notifier.js";
import {
  recordSessionInputSchema,
  settingsSchema,
  taskItemSchema,
  timerSchema,
} from "./schemas.js";

const APP_URI = "ui://pomodoro/app.html";
const APP_ONLY = { ui: { visibility: ["app"] } };

function getAppHtml(): string {
  const envPath = process.env.POMODORO_APP_HTML;
  if (envPath && fs.existsSync(envPath)) return fs.readFileSync(envPath, "utf-8");
  const nextTo = path.resolve(__dirname, "app.html");
  if (fs.existsSync(nextTo)) return fs.readFileSync(nextTo, "utf-8");
  const inDist = path.resolve(__dirname, "../dist/app.html");
  if (fs.existsSync(inDist)) return fs.readFileSync(inDist, "utf-8");
  return "<!DOCTYPE html><html><body><p>Pomodoro App</p></body></html>";
}

function buildSnapshot(storage: PomodoroStorage, tab: "timer" | "summary" | "settings" = "timer"): AppSnapshot {
  const data = storage.loadData();
  return {
    initialTab: tab,
    timer: data.timer,
    tasks: data.tasks,
    settings: data.settings,
    summary: computeSummary(data, "week"),
    calendarSync: data.calendarSync,
  };
}

export function registerPomodoroTools(server: McpServer, storage: PomodoroStorage) {
  server.registerResource(
    "Pomodoro app",
    APP_URI,
    { mimeType: "text/html;profile=mcp-app", _meta: { ui: { prefersBorder: false } } },
    async () => ({ contents: [{ uri: APP_URI, mimeType: "text/html;profile=mcp-app", text: getAppHtml() }] })
  );

  server.registerTool(
    "open_pomodoro",
    {
      description: "Opens Pomodoro timer, tasks, and productivity summary panel.",
      inputSchema: { tab: z.enum(["timer", "summary", "settings"]).optional() },
      _meta: {
        ui: { resourceUri: APP_URI },
        "com.google.antigravity/ui": {
          entrypoints: [
            { type: "global", title: "Pomodoro" },
          ],
        },
      },
    },
    async (args) => {
      const tab = args?.tab || "timer";
      const data = storage.loadData();
      storage.recordAccess(data);
      const snapshot = buildSnapshot(storage, tab);
      const text = `Pomodoro Focus (${tab}): ${snapshot.summary.activitySummary.hoursFocused}h focused, ${snapshot.summary.activitySummary.dayStreak} day streak.`;
      return { content: [{ type: "text", text }], structuredContent: snapshot as unknown as Record<string, unknown> };
    }
  );

  server.registerTool("pomodoro_get_state", { description: "Retrieves full state.", _meta: APP_ONLY }, async () => {
    return { content: [{ type: "text", text: "OK" }], structuredContent: buildSnapshot(storage, "timer") as unknown as Record<string, unknown> };
  });

  server.registerTool(
    "pomodoro_save_timer",
    {
      description: "Saves current timer state.",
      inputSchema: { timer: timerSchema },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      data.timer = args.timer;
      storage.saveData(data);
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, timer: data.timer } };
    }
  );

  server.registerTool(
    "pomodoro_record_session",
    {
      description: "Records completed focus session and updates tasks.",
      inputSchema: recordSessionInputSchema,
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      const raw = args.session ?? {
        id: args.id,
        mode: args.mode ?? "pomodoro",
        durationMinutes: args.durationMinutes ?? data.settings.pomodoroMin,
        completedAt: args.completedAt,
        project: args.project,
        taskId: args.taskId,
        taskTitle: args.taskTitle,
      };
      const isManual = Boolean(raw.id?.startsWith("manual_"));
      const duplicate = !isManual && !raw.completedAt && hasRecentSession(data, raw.mode);
      let session = data.sessions[data.sessions.length - 1];
      if (!duplicate) {
        session = {
          id: raw.id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          mode: raw.mode,
          durationMinutes: raw.durationMinutes,
          completedAt: raw.completedAt || new Date().toISOString(),
          project: (raw.project && raw.project.trim()) ? raw.project.trim() : "Default",
          taskId: raw.taskId,
          taskTitle: raw.taskTitle,
        };
        data.sessions.push(session);
        if (session.mode === "pomodoro" && session.taskId) {
          const t = data.tasks.find((item) => item.id === session.taskId);
          if (t) t.completedPomodoros = (t.completedPomodoros || 0) + 1;
        }
        storage.recordAccess(data);
        storage.saveData(data);
        if (!isManual && !raw.completedAt) {
          const next = getNextModeInfo(data, session.mode);
          maybeNotifyCompletion(data, session.mode, session.durationMinutes, next.nextMinutes);
        }
      }
      const summary = computeSummary(data, "week");
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, deduplicated: duplicate, session, summary, tasks: data.tasks } };
    }
  );

  server.registerTool(
    "pomodoro_update_session",
    {
      description: "Updates existing focus session.",
      inputSchema: {
        id: z.string(),
        durationMinutes: z.number().optional(),
        project: z.string().optional(),
        completedAt: z.string().optional(),
        taskTitle: z.string().optional(),
      },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      const s = data.sessions.find((item) => item.id === args.id);
      if (s) {
        if (args.durationMinutes !== undefined) s.durationMinutes = args.durationMinutes;
        if (args.project !== undefined) s.project = args.project.trim() || "Default";
        if (args.completedAt !== undefined) s.completedAt = args.completedAt;
        if (args.taskTitle !== undefined) s.taskTitle = args.taskTitle;
        storage.saveData(data);
      }
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, summary: computeSummary(data, "week") } };
    }
  );

  server.registerTool(
    "pomodoro_delete_session",
    { description: "Deletes a focus session.", inputSchema: { id: z.string() }, _meta: APP_ONLY },
    async (args) => {
      const data = storage.loadData();
      data.sessions = data.sessions.filter((item) => item.id !== args.id);
      storage.saveData(data);
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, summary: computeSummary(data, "week") } };
    }
  );

  server.registerTool(
    "pomodoro_save_tasks",
    {
      description: "Saves task list.",
      inputSchema: { tasks: z.array(taskItemSchema) },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      data.tasks = args.tasks;
      storage.saveData(data);
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, tasks: data.tasks } };
    }
  );

  server.registerTool(
    "pomodoro_save_settings",
    {
      description: "Saves user settings.",
      inputSchema: { settings: settingsSchema },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      data.settings = args.settings;
      storage.saveData(data);
      return { content: [{ type: "text", text: "OK" }], structuredContent: { ok: true, settings: data.settings } };
    }
  );

  server.registerTool(
    "pomodoro_get_summary",
    {
      description: "Computes activity summary and chart buckets.",
      inputSchema: { period: z.enum(["week", "month", "year"]).default("week"), anchorDate: z.string().optional() },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      const period = (args.period as SummaryPeriod) || "week";
      const summary = computeSummary(data, period, args.anchorDate);
      return { content: [{ type: "text", text: "OK" }], structuredContent: summary as unknown as Record<string, unknown> };
    }
  );

  server.registerTool(
    "pomodoro_sync_calendar",
    {
      description: "Syncs today's tasks from configured Google Calendar iCal (.ics) feeds.",
      inputSchema: { date: z.string().optional() },
      _meta: APP_ONLY,
    },
    async (args) => {
      const data = storage.loadData();
      const result = await syncCalendarTasks(data, args?.date);
      storage.saveData(data);
      return {
        content: [{ type: "text", text: result.ok ? "OK" : "SYNC_PARTIAL_ERROR" }],
        structuredContent: {
          ...result,
          timer: data.timer,
        } as unknown as Record<string, unknown>,
      };
    }
  );

  server.registerTool(
    "pomodoro_toggle_mini_pill",
    {
      description: "Opens, closes, toggles, or checks the floating always-on-top mini Pomodoro pill at the top-right corner of the screen.",
      inputSchema: { action: z.enum(["toggle", "open", "close", "status"]).default("toggle") },
      _meta: { ui: { visibility: ["model", "app"] } },
    },
    async (args) => {
      const pinned = toggleMiniPill(storage.getDataDir(), args?.action || "toggle");
      const text = pinned
        ? "Floating Pomodoro Mini Pill is pinned at top-right."
        : "Floating Pomodoro Mini Pill is closed.";
      return { content: [{ type: "text", text }], structuredContent: { ok: true, pinned } };
    }
  );

  server.registerTool(
    "pomodoro_test_notification",
    {
      description: "Triggers a sample desktop notification popup and bell chime using current sound settings.",
      inputSchema: {},
      _meta: { ui: { visibility: ["model", "app"] } },
    },
    async () => {
      const data = storage.loadData();
      showDesktopNotification({
        title: "Pomodoro Focus · Thông báo thử",
        body: "Chuông và thông báo Pomodoro đã sẵn sàng hoạt động khi hết giờ!",
        mode: data.timer.mode || "pomodoro",
        sound: data.settings.sound || "bell",
        volume: data.settings.volume ?? 0.8,
      });
      return { content: [{ type: "text", text: "Test notification triggered." }], structuredContent: { ok: true } };
    }
  );
}
