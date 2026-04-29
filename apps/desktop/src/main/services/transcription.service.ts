import { randomUUID } from "node:crypto";
import type { TranscriptChunk } from "../../shared/types";
import { AppError } from "../errors/app-error";
import { DatabaseService } from "./database.service";

export class TranscriptionService {
  constructor(private readonly database: DatabaseService) {}

  async transcribeMeeting(meetingId: string): Promise<TranscriptChunk[]> {
    const meeting = this.database.getMeeting(meetingId);

    if (!meeting) {
      throw new AppError("MEETING_NOT_FOUND", `Meeting ${meetingId} was not found.`);
    }

    this.database.updateMeetingStatus(meetingId, "transcribing", meeting.endedAt);

    // TODO: Replace this demo transcript with whisper.cpp output backed by real audio capture.
    const createdAt = new Date().toISOString();
    const chunks: TranscriptChunk[] = [
      {
        id: randomUUID(),
        meetingId,
        speaker: "Alex",
        text: "Thanks everyone for joining. Today we need to finalize the onboarding rollout plan for the desktop app.",
        startTime: 0,
        endTime: 7.2,
        createdAt
      },
      {
        id: randomUUID(),
        meetingId,
        speaker: "Mira",
        text: "The engineering team can ship the MVP this Friday if we keep system audio capture out of the first release.",
        startTime: 7.3,
        endTime: 15.6,
        createdAt
      },
      {
        id: randomUUID(),
        meetingId,
        speaker: "Alex",
        text: "That works. We will position microphone capture as the supported path and document the native audio helper as a follow-up.",
        startTime: 15.8,
        endTime: 24.7,
        createdAt
      },
      {
        id: randomUUID(),
        meetingId,
        speaker: "Sam",
        text: "I will prepare the user testing script and send feedback by Thursday afternoon.",
        startTime: 24.8,
        endTime: 31.5,
        createdAt
      },
      {
        id: randomUUID(),
        meetingId,
        speaker: "Mira",
        text: "Open question from my side: do we want markdown export only in the MVP, or should PDF export also be scheduled next?",
        startTime: 31.8,
        endTime: 40.9,
        createdAt
      }
    ];

    this.database.replaceTranscriptChunks(meetingId, chunks);
    this.database.updateMeetingStatus(meetingId, "stopped", meeting.endedAt);

    return chunks;
  }
}
