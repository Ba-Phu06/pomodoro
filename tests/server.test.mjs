import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "../dist/server.cjs");

class McpRpcClient {
  constructor(dataDir, extraEnv = { POMODORO_ALLOW_LOCAL_ICS: "1" }) {
    this.dataDir = dataDir;
    this.nextId = 0;
    this.pending = new Map();
    this.child = spawn(process.execPath, [SERVER_PATH, `--data-dir=${dataDir}`], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, POMODORO_DISABLE_GUI: "1", ...extraEnv },
    });

    let buffer = "";
    this.child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch {
          // ignore non-json log lines
        }
      }
    });

    this.child.stderr.on("data", (chunk) => {
      // stderr is preserved for errors
    });
  }

  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id ${id})`));
      }, 5000);

      this.pending.set(id, {
        resolve: (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  close() {
    this.child.kill();
  }
}

test("Pomodoro MCP Server - stdio JSON-RPC suite", async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pomodoro-test-"));
  const client = new McpRpcClient(tempDir);

  t.after(() => {
    client.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  await t.test("1. initialize succeeds with tools and resources capabilities", async () => {
    const initResult = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-verifier", version: "1.0.0" },
    });

    assert.ok(initResult, "Init result should be present");
    assert.ok(initResult.capabilities, "Capabilities should exist");
    assert.ok(initResult.capabilities.tools, "tools capability must be present");
    assert.ok(initResult.capabilities.resources, "resources capability must be present");
    assert.equal(initResult.serverInfo?.name, "pomodoro");

    client.notify("notifications/initialized");
  });

  await t.test("2. tools/list includes open_pomodoro with global entrypoint (and not aux_pane)", async () => {
    const listResult = await client.request("tools/list", {});
    assert.ok(Array.isArray(listResult.tools), "tools list must be an array");

    const openPomodoro = listResult.tools.find((tool) => tool.name === "open_pomodoro");
    assert.ok(openPomodoro, "open_pomodoro tool must exist in tools/list");

    const agyUi = openPomodoro._meta?.["com.google.antigravity/ui"];
    assert.ok(agyUi, "open_pomodoro must have com.google.antigravity/ui meta");
    assert.ok(Array.isArray(agyUi.entrypoints), "entrypoints must be an array");

    const types = agyUi.entrypoints.map((e) => e.type);
    assert.ok(!types.includes("aux_pane"), "entrypoints must NOT contain aux_pane so Swarm side pane stays free");
    assert.ok(types.includes("global"), "entrypoints must contain global");

    assert.equal(openPomodoro._meta?.ui?.resourceUri, "ui://pomodoro/app.html");
  });

  await t.test("3. resources/read returns valid HTML for ui://pomodoro/app.html", async () => {
    const readResult = await client.request("resources/read", { uri: "ui://pomodoro/app.html" });
    assert.ok(Array.isArray(readResult.contents), "contents must be an array");
    assert.ok(readResult.contents.length > 0, "at least one content item");

    const item = readResult.contents[0];
    assert.equal(item.uri, "ui://pomodoro/app.html");
    assert.equal(item.mimeType, "text/html;profile=mcp-app");
    assert.ok(typeof item.text === "string" && item.text.length > 100, "HTML text must be non-empty and substantial");
    assert.ok(item.text.includes("<!DOCTYPE html>") || item.text.includes("<html"), "Must contain HTML document markup");
  });

  await t.test("4. records sessions across multiple days/projects and computes accurate summary", async () => {
    const today = new Date();
    const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0);
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(d0);
    d2.setDate(d2.getDate() - 2);

    // Day 0 (today): 50 min Pomodoro (DeepWork) + 10 min break
    await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        session: {
          id: "sess_today_1",
          mode: "pomodoro",
          durationMinutes: 50,
          project: "DeepWork",
          completedAt: d0.toISOString(),
        },
      },
    });

    await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        session: {
          id: "sess_today_break",
          mode: "short_break",
          durationMinutes: 10,
          project: "DeepWork",
          completedAt: d0.toISOString(),
        },
      },
    });

    // Day -1 (yesterday): 25 min Pomodoro (Design)
    await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        session: {
          id: "sess_yesterday",
          mode: "pomodoro",
          durationMinutes: 25,
          project: "Design",
          completedAt: d1.toISOString(),
        },
      },
    });

    // Day -2: 25 min Pomodoro (Admin)
    await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        session: {
          id: "sess_prev2",
          mode: "pomodoro",
          durationMinutes: 25,
          project: "Admin",
          completedAt: d2.toISOString(),
        },
      },
    });

    // Query weekly summary
    const weekRes = await client.request("tools/call", {
      name: "pomodoro_get_summary",
      arguments: { period: "week", anchorDate: d0.toISOString() },
    });
    const weekSummary = weekRes.structuredContent;

    // Total focus: (50 + 25 + 25) / 60 = 100 / 60 = 1.666... -> 1.7
    assert.equal(weekSummary.activitySummary.hoursFocused, 1.7);
    assert.ok(weekSummary.activitySummary.daysAccessed >= 3);
    assert.equal(weekSummary.activitySummary.dayStreak, 3);
    assert.equal(weekSummary.activitySummary.todayMinutes, 50);
    assert.equal(weekSummary.activitySummary.todaySessions, 1);

    // Chart buckets
    assert.equal(weekSummary.chart.period, "week");
    assert.equal(weekSummary.chart.buckets.length, 7);
    assert.ok(weekSummary.chart.projects.includes("DeepWork"));
    assert.ok(weekSummary.chart.projects.includes("Design"));
    assert.ok(weekSummary.chart.projects.includes("Admin"));

    // Monthly summary
    const monthRes = await client.request("tools/call", {
      name: "pomodoro_get_summary",
      arguments: { period: "month", anchorDate: d0.toISOString() },
    });
    assert.equal(monthRes.structuredContent.chart.period, "month");
    assert.ok(monthRes.structuredContent.chart.buckets.length >= 28);

    // Yearly summary
    const yearRes = await client.request("tools/call", {
      name: "pomodoro_get_summary",
      arguments: { period: "year", anchorDate: d0.toISOString() },
    });
    assert.equal(yearRes.structuredContent.chart.period, "year");
    assert.equal(yearRes.structuredContent.chart.buckets.length, 12);
  });

  await t.test("5. updating and deleting sessions updates summary accurately", async () => {
    // Update sess_today_1 duration from 50 to 60 min (+10 min => total 110 min = 1.8h)
    const updateRes = await client.request("tools/call", {
      name: "pomodoro_update_session",
      arguments: { id: "sess_today_1", durationMinutes: 60 },
    });
    assert.ok(updateRes.structuredContent.ok);

    const summaryAfterUpdate = await client.request("tools/call", {
      name: "pomodoro_get_summary",
      arguments: { period: "week" },
    });
    assert.equal(summaryAfterUpdate.structuredContent.activitySummary.hoursFocused, 1.8);

    // Delete sess_prev2 (25 min => remaining 60 + 25 = 85 min = 1.4h)
    const deleteRes = await client.request("tools/call", {
      name: "pomodoro_delete_session",
      arguments: { id: "sess_prev2" },
    });
    assert.ok(deleteRes.structuredContent.ok);

    const summaryAfterDelete = await client.request("tools/call", {
      name: "pomodoro_get_summary",
      arguments: { period: "week" },
    });
    assert.equal(summaryAfterDelete.structuredContent.activitySummary.hoursFocused, 1.4);
  });

  await t.test("6. mini-pill status and flat-argument pomodoro_record_session work", async () => {
    const pillRes = await client.request("tools/call", {
      name: "pomodoro_toggle_mini_pill",
      arguments: { action: "status" },
    });
    assert.equal(pillRes.structuredContent.ok, true);
    assert.equal(pillRes.structuredContent.pinned, false);

    const flatRes = await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        mode: "pomodoro",
        durationMinutes: 25,
        project: "FlatTest",
      },
    });
    assert.equal(flatRes.structuredContent.ok, true);
    assert.equal(flatRes.structuredContent.session.project, "FlatTest");
  });

  await t.test("7. test notification succeeds and rapid duplicate session is deduplicated", async () => {
    const testNotif = await client.request("tools/call", {
      name: "pomodoro_test_notification",
      arguments: {},
    });
    assert.equal(testNotif.structuredContent.ok, true);

    const dupRes = await client.request("tools/call", {
      name: "pomodoro_record_session",
      arguments: {
        mode: "pomodoro",
        durationMinutes: 25,
        project: "FlatTest",
      },
    });
    assert.equal(dupRes.structuredContent.ok, true);
    assert.equal(dupRes.structuredContent.deduplicated, true);
  });

  await t.test("8. Google Calendar ICS sync imports today's events, RRULE/EXDATE, and preserves manual tasks", async () => {
    const todayStr = "2026-11-23";
    const workIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:work-daily-1",
      "SUMMARY:Daily Standup",
      "DTSTART:20261120T090000",
      "DTEND:20261120T092500",
      "RRULE:FREQ=DAILY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:work-excluded-1",
      "SUMMARY:Excluded Meeting",
      "DTSTART:20261120T100000",
      "DTEND:20261120T103000",
      "RRULE:FREQ=DAILY",
      "EXDATE:20261123T100000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const studyIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:study-swe-1",
      "SUMMARY:Scrum Framework",
      "DTSTART:20261123T073000",
      "DTEND:20261123T093000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const readIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:read-allday-1",
      "SUMMARY:Read Clean Architecture",
      "DTSTART;VALUE=DATE:20261123",
      "DTEND;VALUE=DATE:20261124",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const contentIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:content-other-day",
      "SUMMARY:Film Video Tomorrow",
      "DTSTART:20261124T140000",
      "DTEND:20261124T150000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const icsServer = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" });
      if (req.url === "/work.ics") res.end(workIcs);
      else if (req.url === "/study.ics") res.end(studyIcs);
      else if (req.url === "/read.ics") res.end(readIcs);
      else res.end(contentIcs);
    });

    await new Promise((resolve) => icsServer.listen(0, "127.0.0.1", resolve));
    const port = icsServer.address().port;

    try {
      await client.request("tools/call", {
        name: "pomodoro_save_settings",
        arguments: {
          settings: {
            pomodoroMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            longBreakInterval: 4,
            autoStartBreaks: false,
            autoStartPomodoros: false,
            sound: "bell",
            volume: 0.8,
            calendarFeeds: [
              { label: "Work", url: `http://127.0.0.1:${port}/work.ics`, enabled: true },
              { label: "Read", url: `http://127.0.0.1:${port}/read.ics`, enabled: true },
              { label: "Content Creation", url: `http://127.0.0.1:${port}/content.ics`, enabled: true },
              { label: "Study", url: `http://127.0.0.1:${port}/study.ics`, enabled: true },
            ],
          },
        },
      });

      await client.request("tools/call", {
        name: "pomodoro_save_tasks",
        arguments: {
          tasks: [
            {
              id: "manual_1",
              title: "Manual Task",
              project: "General",
              estPomodoros: 2,
              completedPomodoros: 0,
              done: false,
              createdAt: "2026-11-23T00:00:00.000Z",
            },
          ],
        },
      });

      const syncRes = await client.request("tools/call", {
        name: "pomodoro_sync_calendar",
        arguments: { date: todayStr },
      });
      const sc = syncRes.structuredContent;
      assert.equal(sc.ok, true);
      assert.equal(sc.syncedCount, 3);

      const tasks = sc.tasks;
      assert.ok(tasks.some((x) => x.id === "manual_1"), "Manual task must be preserved");
      assert.ok(!tasks.some((x) => x.title === "Excluded Meeting"), "EXDATE must be excluded");
      assert.ok(!tasks.some((x) => x.title === "Film Video Tomorrow"), "Other day event must be excluded");

      const studyTask = tasks.find((x) => x.title === "Scrum Framework");
      assert.ok(studyTask);
      assert.equal(studyTask.calendarLabel, "Study");
      assert.equal(studyTask.project, "Study");
      assert.equal(studyTask.estPomodoros, 5);
      assert.equal(studyTask.startTime, "07:30");
      assert.equal(studyTask.endTime, "09:30");

      const readTask = tasks.find((x) => x.title === "Read Clean Architecture");
      assert.ok(readTask);
      assert.equal(readTask.allDay, true);
      assert.equal(readTask.estPomodoros, 1);

      // Mark studyTask done and record 1 session, then re-sync to verify preservation
      studyTask.done = true;
      await client.request("tools/call", {
        name: "pomodoro_save_tasks",
        arguments: { tasks },
      });
      await client.request("tools/call", {
        name: "pomodoro_record_session",
        arguments: {
          id: "manual_gcal_test",
          mode: "pomodoro",
          durationMinutes: 25,
          project: studyTask.project,
          taskId: studyTask.id,
          taskTitle: studyTask.title,
        },
      });

      const resync = await client.request("tools/call", {
        name: "pomodoro_sync_calendar",
        arguments: { date: todayStr },
      });
      const studyAfter = resync.structuredContent.tasks.find((x) => x.id === studyTask.id);
      assert.equal(studyAfter.done, true);
      assert.equal(studyAfter.completedPomodoros, 1);
    } finally {
      icsServer.close();
    }
  });

  await t.test("9. regression: multi-year recurrence, quoted TZID, and public ics 404 hint", async () => {
    const todayStr = "2026-11-23";
    const regressionIcs = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:multiyear-daily-2005",
      "SUMMARY:Morning Routine Multiyear",
      "DTSTART:20050101T080000",
      "DTEND:20050101T083000",
      "RRULE:FREQ=DAILY",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:quoted-tzid-event",
      "SUMMARY:Quoted TZ Meeting",
      'DTSTART;TZID="Asia/Ho_Chi_Minh":20261123T140000',
      'DTEND;TZID="Asia/Ho_Chi_Minh":20261123T150000',
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const icsServer = http.createServer((req, res) => {
      if (req.url === "/regression.ics") {
        res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" });
        res.end(regressionIcs);
      } else if (req.url === "/calendar/public/basic.ics") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    await new Promise((resolve) => icsServer.listen(0, "127.0.0.1", resolve));
    const port = icsServer.address().port;

    try {
      await client.request("tools/call", {
        name: "pomodoro_save_settings",
        arguments: {
          settings: {
            pomodoroMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            longBreakInterval: 4,
            autoStartBreaks: false,
            autoStartPomodoros: false,
            sound: "bell",
            volume: 0.8,
            calendarFeeds: [
              { label: "Work", url: `http://127.0.0.1:${port}/regression.ics`, enabled: true },
              { label: "Study", url: `http://127.0.0.1:${port}/calendar/public/basic.ics`, enabled: true },
            ],
          },
        },
      });

      const syncRes = await client.request("tools/call", {
        name: "pomodoro_sync_calendar",
        arguments: { date: todayStr },
      });
      const sc = syncRes.structuredContent;

      // 1. Multi-year recurring event verification
      const multiYearTask = sc.tasks.find((t) => t.title === "Morning Routine Multiyear");
      assert.ok(multiYearTask, "Multi-year recurring event (DTSTART:20050101T080000) must expand for 2026-11-23");
      assert.equal(multiYearTask.startTime, "08:00");

      // 2. Quoted TZID verification
      const quotedTzTask = sc.tasks.find((t) => t.title === "Quoted TZ Meeting");
      assert.ok(quotedTzTask, "Quoted TZID event must parse properly without crashing");
      assert.equal(quotedTzTask.calendarLabel, "Work");

      // 3. HTTP 404 on /public/basic.ics error hint verification
      assert.ok(
        sc.calendarSync.errors?.Study?.includes("Link /public/basic.ics chỉ dùng cho lịch công khai"),
        "HTTP 404 on /public/basic.ics must return the Vietnamese secret-iCal hint"
      );
      assert.equal(
        sc.calendarSync.errors?.Study,
        "HTTP 404 — Link /public/basic.ics chỉ dùng cho lịch công khai. Hãy dán 'Địa chỉ bí mật ở định dạng iCal' (/private-.../basic.ics)."
      );
    } finally {
      icsServer.close();
    }
  });

  await t.test("10. SSRF protection blocks HTTP, loopback, and link-local URLs in production mode", async () => {
    const prodTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pomodoro-ssrf-"));
    const prodClient = new McpRpcClient(prodTempDir, { POMODORO_ALLOW_LOCAL_ICS: "0" });

    try {
      await prodClient.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ssrf-verifier", version: "1.0.0" },
      });
      prodClient.notify("notifications/initialized");

      await prodClient.request("tools/call", {
        name: "pomodoro_save_settings",
        arguments: {
          settings: {
            pomodoroMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            longBreakInterval: 4,
            autoStartBreaks: false,
            autoStartPomodoros: false,
            sound: "bell",
            volume: 0.8,
            calendarFeeds: [
              { label: "Work", url: "http://127.0.0.1:9999/test.ics", enabled: true },
              { label: "Read", url: "https://169.254.169.254/latest/meta-data", enabled: true },
              { label: "Content Creation", url: "https://localhost/test.ics", enabled: true },
            ],
          },
        },
      });

      const syncRes = await prodClient.request("tools/call", {
        name: "pomodoro_sync_calendar",
        arguments: { date: "2026-11-23" },
      });
      const errs = syncRes.structuredContent.calendarSync.errors;
      assert.equal(errs.Work, "URL phải sử dụng giao thức https://");
      assert.equal(errs.Read, "Không cho phép kết nối tới địa chỉ mạng nội bộ");
      assert.equal(errs["Content Creation"], "Không cho phép kết nối tới địa chỉ mạng nội bộ");
    } finally {
      prodClient.close();
      try {
        fs.rmSync(prodTempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  await t.test("17. pomodoro_get_state computes live remainingSec from endTimeMs when running", async () => {
    const endTimeMs = Date.now() + 600_000;
    await client.request("tools/call", {
      name: "pomodoro_save_timer",
      arguments: {
        timer: {
          mode: "pomodoro",
          status: "running",
          remainingSec: 1500,
          endTimeMs,
          completedCount: 0,
          activeTaskId: null,
        },
      },
    });

    const stateRes = await client.request("tools/call", {
      name: "pomodoro_get_state",
      arguments: {},
    });
    const timer = stateRes.structuredContent.timer;
    assert.equal(timer.status, "running");
    assert.ok(
      timer.remainingSec >= 595 && timer.remainingSec <= 605,
      `Expected live remainingSec near 600, got ${timer.remainingSec}`
    );
  });
});
