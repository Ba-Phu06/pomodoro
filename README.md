# Pomodoro Focus MCP App

A full-featured Pomodoro timer, task manager with **Google Calendar (`.ics`)** sync, and focus productivity analytics plugin for **Google Antigravity**.

## Features

- **Interactive Focus Timer**:
  - Configurable focus, short break, and long break durations (`25 / 5` and `40 / 5` presets).
  - Synthesized Web Audio API bell/chime/beep alerts and Windows desktop notifications.
  - Optional always-on-top floating Mini Pill (`Ghim Mini`) on Windows.
- **Task Management & Google Calendar Sync**:
  - Syncs today's events from 4 Google Calendar labels: **Work**, **Read**, **Content Creation**, and **Study**.
  - Zero-dependency RFC 5545 `.ics` & `RRULE` parser supporting recurring events, `EXDATE`, `RECURRENCE-ID`, all-day events, and `TZID`/UTC timezones.
  - Auto-calculates estimated Pomodoro sessions from event duration while preserving manual tasks and completion progress.
- **Productivity Analytics & Charts**:
  - Tracks hours focused, total days accessed, and consecutive day streak.
  - Interactive SVG stacked bar chart by project across Week, Month, and Year views.
  - Session history editor for manual adjustments.

## Quick Install (Antigravity Plugin)

1. Clone this repository or extract `pomodoro-plugin-v1.1.0.zip` into your Antigravity plugins folder:
   - Windows: `%USERPROFILE%\.gemini\config\plugins\pomodoro`
   - macOS / Linux: `~/.gemini/config/plugins/pomodoro`
2. Enable **Pomodoro Focus** in Antigravity Customizations.

## Connecting Google Calendar (`.ics`)

1. Open Google Calendar → click **⋮** next to each calendar (**Work**, **Read**, **Content Creation**, **Study**) → **Settings and sharing** → **Integrate calendar**.
2. Copy the **Secret address in iCal format** (`https://calendar.google.com/calendar/ical/.../private-.../basic.ics`).
3. Open **Pomodoro Focus** → **Settings** → **Google Calendar (.ics)** → paste the URLs → click **Lưu & Đồng bộ ngay**.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run package
```

`npm run package` outputs a clean distributable bundle in `release/pomodoro/` and `release/pomodoro-plugin-v1.1.0.zip`.

## Privacy & Security

- All timer state, tasks, sessions, and calendar URLs are stored locally in `pomodoro-data.json` inside `${PLUGIN_DATA}` (no telemetry or third-party backend).
- Calendar sync enforces `https://`, blocks private/loopback/metadata IP ranges (SSRF protection), caps `.ics` downloads at 5 MB, and redacts `/private-...` tokens from error messages.
- See [SECURITY.md](SECURITY.md) for details.
