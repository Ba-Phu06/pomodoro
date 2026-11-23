import { z } from "zod";

export const timerSchema = z.object({
  mode: z.enum(["pomodoro", "short_break", "long_break"]),
  status: z.enum(["idle", "running", "paused"]),
  remainingSec: z.number(),
  endTimeMs: z.number().nullable(),
  completedCount: z.number(),
  activeTaskId: z.string().nullable(),
});

export const sessionPayloadSchema = z.object({
  id: z.string().optional(),
  mode: z.enum(["pomodoro", "short_break", "long_break"]),
  durationMinutes: z.number(),
  completedAt: z.string().optional(),
  project: z.string().optional(),
  taskId: z.string().optional(),
  taskTitle: z.string().optional(),
});

export const recordSessionInputSchema = {
  session: sessionPayloadSchema.optional(),
  id: z.string().optional(),
  mode: z.enum(["pomodoro", "short_break", "long_break"]).optional(),
  durationMinutes: z.number().optional(),
  completedAt: z.string().optional(),
  project: z.string().optional(),
  taskId: z.string().optional(),
  taskTitle: z.string().optional(),
};

export const calendarLabelSchema = z.enum([
  "Work",
  "Read",
  "Content Creation",
  "Study",
]);

export const calendarFeedSchema = z.object({
  label: calendarLabelSchema,
  url: z.string(),
  enabled: z.boolean(),
});

export const taskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string(),
  estPomodoros: z.number(),
  completedPomodoros: z.number(),
  done: z.boolean(),
  createdAt: z.string(),
  source: z.enum(["manual", "gcalendar"]).optional(),
  calendarLabel: calendarLabelSchema.optional(),
  calendarEventId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean().optional(),
  eventDate: z.string().optional(),
});

export const settingsSchema = z.object({
  pomodoroMin: z.number(),
  shortBreakMin: z.number(),
  longBreakMin: z.number(),
  longBreakInterval: z.number(),
  autoStartBreaks: z.boolean(),
  autoStartPomodoros: z.boolean(),
  sound: z.enum(["bell", "chime", "beep"]),
  volume: z.number(),
  calendarFeeds: z.array(calendarFeedSchema).optional(),
});
