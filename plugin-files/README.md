# Pomodoro Focus MCP App

A full-featured Pomodoro timer, task manager, and focus productivity analytics plugin for Google Antigravity.

## Features

- **Interactive Focus Timer**:
  - Configurable focus, short break, and long break intervals.
  - Quick duration presets (`25 / 5` and `40 / 5`).
  - Audio bell chime/alarm synthesized via Web Audio API.
  - Background-safe countdown synchronization.
- **Task Management**:
  - Organize tasks by title and project tags.
  - Track estimated vs. completed pomodoro counts.
  - Directly associate active tasks with focus sessions.
- **Productivity Analytics & Charts**:
  - Live activity metrics: hours focused, total days accessed, consecutive day streak.
  - Interactive SVG stacked bar chart by project across Week, Month, and Year periods.
  - Complete session history editor to adjust or review past sessions.
- **Antigravity UI Integration**:
  - Opens in Antigravity's side pane (`aux_pane`) or full-page global view.
  - Live timer pill visible while navigating between tabs.
  - Clean light and dark theme adaptation.

## Usage

You can launch Pomodoro by opening the `+` menu in Antigravity's side pane or running prompts such as:
- *"Open Pomodoro timer"*
- *"Show my focus hours and productivity summary"*
- *"Add a task to my Pomodoro list and start focusing"*

## Storage

Data is automatically and atomically stored locally in `pomodoro-data.json` inside the plugin's data directory.
