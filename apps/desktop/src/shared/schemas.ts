import { z } from "zod";

export const meetingStatusSchema = z.enum([
  "idle",
  "recording",
  "stopped",
  "transcribing",
  "notes_generated",
  "error"
]);

export const meetingIdSchema = z.uuid();

export const meetingSchema = z.object({
  id: meetingIdSchema,
  title: z.string().min(1),
  platform: z.string().nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  status: meetingStatusSchema,
  audioPath: z.string().nullable(),
  createdAt: z.iso.datetime()
});

export const transcriptChunkSchema = z.object({
  id: meetingIdSchema,
  meetingId: meetingIdSchema,
  speaker: z.string().nullable(),
  text: z.string().min(1),
  startTime: z.number().nullable(),
  endTime: z.number().nullable(),
  createdAt: z.iso.datetime()
});

export const meetingNotesSchema = z.object({
  id: meetingIdSchema,
  meetingId: meetingIdSchema,
  summary: z.string(),
  decisions: z.array(z.string()),
  actionItems: z.array(z.string()),
  openQuestions: z.array(z.string()),
  followUpEmail: z.string(),
  createdAt: z.iso.datetime()
});

export const meetingDetailSchema = z.object({
  meeting: meetingSchema,
  transcriptChunks: z.array(transcriptChunkSchema),
  notes: meetingNotesSchema.nullable()
});

export const exportResultSchema = z.object({
  meetingId: meetingIdSchema,
  filePath: z.string().min(1)
});
