import { randomUUID } from "node:crypto";
import type { MeetingNotes } from "../../shared/types";
import { AppError } from "../errors/app-error";
import { DatabaseService } from "./database.service";

export class NotesService {
  constructor(private readonly database: DatabaseService) {}

  async generateNotes(meetingId: string): Promise<MeetingNotes> {
    const meeting = this.database.getMeeting(meetingId);

    if (!meeting) {
      throw new AppError("MEETING_NOT_FOUND", `Meeting ${meetingId} was not found.`);
    }

    const transcript = this.database.listTranscriptChunks(meetingId);

    if (transcript.length === 0) {
      throw new AppError("TRANSCRIPT_REQUIRED", "Generate a transcript before creating notes.");
    }

    // TODO: Replace this deterministic generator with Ollama/OpenAI-compatible summarization.
    const notes: MeetingNotes = {
      id: randomUUID(),
      meetingId,
      summary:
        "The team aligned on shipping the Zapis desktop MVP with microphone-first capture, keeping native system audio capture out of the first release to protect delivery confidence.",
      decisions: [
        "Ship the MVP on Friday with microphone capture as the supported recording path.",
        "Document native macOS system audio capture as a follow-up milestone.",
        "Keep markdown export in scope for MVP and defer PDF export."
      ],
      actionItems: [
        "Engineering to ship the MVP build by Friday.",
        "Sam to send user testing feedback by Thursday afternoon.",
        "Product to update launch messaging around supported capture modes."
      ],
      openQuestions: [
        "Should PDF export be prioritized immediately after markdown export?",
        "What validation is needed before enabling a native macOS audio helper by default?"
      ],
      followUpEmail: [
        "Subject: Zapis MVP rollout plan",
        "",
        "Hi team,",
        "",
        "We aligned on shipping the Zapis desktop MVP this Friday with microphone capture as the supported recording path.",
        "Native system audio capture will remain a follow-up item, and we will document that roadmap clearly.",
        "",
        "Action items:",
        "- Engineering to finalize the MVP build by Friday.",
        "- Sam to send user testing feedback by Thursday afternoon.",
        "- Product to update the launch messaging around supported capture modes.",
        "",
        "Open question:",
        "- Whether PDF export should be scheduled immediately after markdown export.",
        "",
        "Thanks,"
      ].join("\n"),
      createdAt: new Date().toISOString()
    };

    this.database.saveMeetingNotes(notes);
    this.database.updateMeetingStatus(meetingId, "notes_generated", meeting.endedAt);

    return notes;
  }
}
