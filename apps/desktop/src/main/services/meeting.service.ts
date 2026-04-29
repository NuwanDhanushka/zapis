import { randomUUID } from "node:crypto";
import type { Meeting, MeetingDetail } from "../../shared/types";
import { AppError } from "../errors/app-error";
import { DatabaseService } from "./database.service";

export class MeetingService {
  private currentMeetingId: string | null = null;

  constructor(private readonly database: DatabaseService) {}

  async startMeeting(): Promise<Meeting> {
    if (this.currentMeetingId) {
      const activeMeeting = this.database.getMeeting(this.currentMeetingId);
      if (activeMeeting) {
        return activeMeeting;
      }
    }

    const timestamp = new Date();
    const meeting: Meeting = {
      id: randomUUID(),
      title: `Zapis Meeting ${formatTitleTimestamp(timestamp)}`,
      platform: "Local Demo Session",
      startedAt: timestamp.toISOString(),
      endedAt: null,
      status: "recording",
      audioPath: null,
      createdAt: timestamp.toISOString()
    };

    this.database.createMeeting(meeting);
    this.currentMeetingId = meeting.id;
    return meeting;
  }

  async stopMeeting(): Promise<Meeting> {
    const meetingId = this.currentMeetingId ?? this.database.listMeetings().find((meeting) => meeting.status === "recording")?.id;

    if (!meetingId) {
      throw new AppError("NO_ACTIVE_MEETING", "No active meeting is currently recording.");
    }

    const endedAt = new Date().toISOString();
    this.database.updateMeetingStatus(meetingId, "stopped", endedAt);
    this.currentMeetingId = null;

    const updatedMeeting = this.database.getMeeting(meetingId);
    if (!updatedMeeting) {
      throw new AppError("MEETING_STATE_ERROR", "Unable to load the stopped meeting.");
    }

    return updatedMeeting;
  }

  async listMeetings(): Promise<Meeting[]> {
    return this.database.listMeetings();
  }

  async getMeetingDetail(meetingId: string): Promise<MeetingDetail> {
    const detail = this.database.getMeetingDetail(meetingId);

    if (!detail) {
      throw new AppError("MEETING_NOT_FOUND", `Meeting ${meetingId} was not found.`);
    }

    return detail;
  }
}

function formatTitleTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
