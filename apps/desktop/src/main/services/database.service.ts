import fs from "node:fs";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { z } from "zod";
import {
  meetingDetailSchema,
  meetingNotesSchema,
  meetingSchema,
  meetingStatusSchema,
  transcriptChunkSchema
} from "../../shared/schemas";
import type { Meeting, MeetingDetail, MeetingNotes, MeetingStatus, TranscriptChunk } from "../../shared/types";

interface DatabaseServiceOptions {
  userDataPath: string;
}

const meetingRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  platform: z.string().nullable(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  status: meetingStatusSchema,
  audio_path: z.string().nullable(),
  created_at: z.string()
});

const transcriptChunkRowSchema = z.object({
  id: z.string(),
  meeting_id: z.string(),
  speaker: z.string().nullable(),
  text: z.string(),
  start_time: z.number().nullable(),
  end_time: z.number().nullable(),
  created_at: z.string()
});

const meetingNotesRowSchema = z.object({
  id: z.string(),
  meeting_id: z.string(),
  summary: z.string().nullable(),
  decisions: z.string().nullable(),
  action_items: z.string().nullable(),
  open_questions: z.string().nullable(),
  follow_up_email: z.string().nullable(),
  created_at: z.string()
});

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  audio_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  start_time REAL,
  end_time REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL UNIQUE,
  summary TEXT,
  decisions TEXT,
  action_items TEXT,
  open_questions TEXT,
  follow_up_email TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meetings_started_at ON meetings(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_meeting_id ON transcript_chunks(meeting_id, start_time);
`;

export class DatabaseService {
  private readonly userDataPath: string;
  private readonly dbFilePath: string;
  private db: BetterSqlite3Database | null = null;

  constructor(options: DatabaseServiceOptions) {
    this.userDataPath = options.userDataPath;
    this.dbFilePath = path.join(this.userDataPath, "zapis.sqlite");
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.userDataPath, { recursive: true });

    const db = new DatabaseConstructor(this.dbFilePath, {
      timeout: 5_000
    });

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
    db.exec(SCHEMA_SQL);
    this.db = db;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  getDatabasePath(): string {
    return this.dbFilePath;
  }

  createMeeting(meeting: Meeting): Meeting {
    this.prepare(
      `INSERT INTO meetings (id, title, platform, started_at, ended_at, status, audio_path, created_at)
       VALUES (@id, @title, @platform, @started_at, @ended_at, @status, @audio_path, @created_at)`
    ).run({
      id: meeting.id,
      title: meeting.title,
      platform: meeting.platform,
      started_at: meeting.startedAt,
      ended_at: meeting.endedAt,
      status: meeting.status,
      audio_path: meeting.audioPath,
      created_at: meeting.createdAt
    });

    return meetingSchema.parse(meeting);
  }

  updateMeetingStatus(meetingId: string, status: MeetingStatus, endedAt?: string | null): void {
    this.prepare(
      `UPDATE meetings
       SET status = @status,
           ended_at = @ended_at
       WHERE id = @id`
    ).run({
      id: meetingId,
      status,
      ended_at: endedAt ?? null
    });
  }

  listMeetings(): Meeting[] {
    const rows = this.prepare<unknown[], Record<string, unknown>>(
      `SELECT id, title, platform, started_at, ended_at, status, audio_path, created_at
       FROM meetings
       ORDER BY started_at DESC`
    ).all();

    return rows.map((row) => mapMeetingRow(meetingRowSchema.parse(row)));
  }

  getMeeting(meetingId: string): Meeting | null {
    const row = this.prepare<{ id: string }, Record<string, unknown>>(
      `SELECT id, title, platform, started_at, ended_at, status, audio_path, created_at
       FROM meetings
       WHERE id = @id`
    ).get({ id: meetingId });

    return row ? mapMeetingRow(meetingRowSchema.parse(row)) : null;
  }

  getMeetingDetail(meetingId: string): MeetingDetail | null {
    const meeting = this.getMeeting(meetingId);

    if (!meeting) {
      return null;
    }

    return meetingDetailSchema.parse({
      meeting,
      transcriptChunks: this.listTranscriptChunks(meetingId),
      notes: this.getMeetingNotes(meetingId)
    });
  }

  replaceTranscriptChunks(meetingId: string, chunks: TranscriptChunk[]): void {
    const parsedChunks = chunks.map((chunk) => transcriptChunkSchema.parse(chunk));
    const replaceTranscriptTransaction = this.database.transaction((items: TranscriptChunk[]) => {
      this.prepare<{ meeting_id: string }>(`DELETE FROM transcript_chunks WHERE meeting_id = @meeting_id`).run({
        meeting_id: meetingId
      });

      const insertStatement = this.prepare(
        `INSERT INTO transcript_chunks (id, meeting_id, speaker, text, start_time, end_time, created_at)
         VALUES (@id, @meeting_id, @speaker, @text, @start_time, @end_time, @created_at)`
      );

      for (const chunk of items) {
        insertStatement.run({
          id: chunk.id,
          meeting_id: chunk.meetingId,
          speaker: chunk.speaker,
          text: chunk.text,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
          created_at: chunk.createdAt
        });
      }
    });

    replaceTranscriptTransaction(parsedChunks);
  }

  listTranscriptChunks(meetingId: string): TranscriptChunk[] {
    const rows = this.prepare<{ meeting_id: string }, Record<string, unknown>>(
      `SELECT id, meeting_id, speaker, text, start_time, end_time, created_at
       FROM transcript_chunks
       WHERE meeting_id = @meeting_id
       ORDER BY start_time ASC, created_at ASC`
    ).all({ meeting_id: meetingId });

    return rows.map((row) => mapTranscriptChunkRow(transcriptChunkRowSchema.parse(row)));
  }

  saveMeetingNotes(notes: MeetingNotes): MeetingNotes {
    const parsedNotes = meetingNotesSchema.parse(notes);

    this.prepare(
      `INSERT INTO meeting_notes (id, meeting_id, summary, decisions, action_items, open_questions, follow_up_email, created_at)
       VALUES (@id, @meeting_id, @summary, @decisions, @action_items, @open_questions, @follow_up_email, @created_at)
       ON CONFLICT(meeting_id) DO UPDATE SET
         id = excluded.id,
         summary = excluded.summary,
         decisions = excluded.decisions,
         action_items = excluded.action_items,
         open_questions = excluded.open_questions,
         follow_up_email = excluded.follow_up_email,
         created_at = excluded.created_at`
    ).run({
      id: parsedNotes.id,
      meeting_id: parsedNotes.meetingId,
      summary: parsedNotes.summary,
      decisions: JSON.stringify(parsedNotes.decisions),
      action_items: JSON.stringify(parsedNotes.actionItems),
      open_questions: JSON.stringify(parsedNotes.openQuestions),
      follow_up_email: parsedNotes.followUpEmail,
      created_at: parsedNotes.createdAt
    });

    return parsedNotes;
  }

  getMeetingNotes(meetingId: string): MeetingNotes | null {
    const row = this.prepare<{ meeting_id: string }, Record<string, unknown>>(
      `SELECT id, meeting_id, summary, decisions, action_items, open_questions, follow_up_email, created_at
       FROM meeting_notes
       WHERE meeting_id = @meeting_id`
    ).get({ meeting_id: meetingId });

    return row ? mapMeetingNotesRow(meetingNotesRowSchema.parse(row)) : null;
  }

  private get database(): BetterSqlite3Database {
    if (!this.db) {
      throw new Error("Database has not been initialized.");
    }

    return this.db;
  }

  private prepare<BindParameters extends {} | unknown[] = unknown[], Result = unknown>(sql: string) {
    return this.database.prepare<BindParameters, Result>(sql);
  }
}

function mapMeetingRow(row: z.infer<typeof meetingRowSchema>): Meeting {
  return meetingSchema.parse({
    id: row.id,
    title: row.title,
    platform: row.platform,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    audioPath: row.audio_path,
    createdAt: row.created_at
  });
}

function mapTranscriptChunkRow(row: z.infer<typeof transcriptChunkRowSchema>): TranscriptChunk {
  return transcriptChunkSchema.parse({
    id: row.id,
    meetingId: row.meeting_id,
    speaker: row.speaker,
    text: row.text,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at
  });
}

function mapMeetingNotesRow(row: z.infer<typeof meetingNotesRowSchema>): MeetingNotes {
  return meetingNotesSchema.parse({
    id: row.id,
    meetingId: row.meeting_id,
    summary: row.summary ?? "",
    decisions: parseStringArray(row.decisions),
    actionItems: parseStringArray(row.action_items),
    openQuestions: parseStringArray(row.open_questions),
    followUpEmail: row.follow_up_email ?? "",
    createdAt: row.created_at
  });
}

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return z.array(z.string()).parse(JSON.parse(value) as unknown);
}
