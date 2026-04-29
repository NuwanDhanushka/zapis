import type { z } from "zod";
import {
  exportResultSchema,
  meetingDetailSchema,
  meetingNotesSchema,
  meetingSchema,
  meetingStatusSchema,
  transcriptChunkSchema
} from "./schemas";

export type MeetingStatus = z.infer<typeof meetingStatusSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;
export type MeetingNotes = z.infer<typeof meetingNotesSchema>;
export type MeetingDetail = z.infer<typeof meetingDetailSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;

export interface ZapisApi {
  startMeeting: () => Promise<Meeting>;
  stopMeeting: () => Promise<Meeting>;
  listMeetings: () => Promise<Meeting[]>;
  getMeeting: (id: string) => Promise<MeetingDetail>;
  transcribeMeeting: (id: string) => Promise<TranscriptChunk[]>;
  generateNotes: (id: string) => Promise<MeetingNotes>;
  exportMeetingMarkdown: (id: string) => Promise<ExportResult>;
}

declare global {
  interface Window {
    zapis: ZapisApi;
  }
}
