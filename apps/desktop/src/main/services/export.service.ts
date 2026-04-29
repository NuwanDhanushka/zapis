import fs from "node:fs";
import path from "node:path";
import { exportResultSchema } from "../../shared/schemas";
import type { ExportResult } from "../../shared/types";
import { AppError } from "../errors/app-error";
import { DatabaseService } from "./database.service";

export class ExportService {
  constructor(
    private readonly database: DatabaseService,
    private readonly exportsPath: string
  ) {}

  async exportMeetingMarkdown(meetingId: string): Promise<ExportResult> {
    const detail = this.database.getMeetingDetail(meetingId);

    if (!detail) {
      throw new AppError("MEETING_NOT_FOUND", `Meeting ${meetingId} was not found.`);
    }

    if (!detail.notes) {
      throw new AppError("NOTES_REQUIRED", "Generate notes before exporting markdown.");
    }

    fs.mkdirSync(this.exportsPath, { recursive: true });

    const fileName = `${slugify(detail.meeting.title)}-${detail.meeting.id}.md`;
    const filePath = path.join(this.exportsPath, fileName);
    fs.writeFileSync(filePath, buildMarkdown(detail), "utf8");

    return exportResultSchema.parse({
      meetingId,
      filePath
    });
  }
}

function buildMarkdown(detail: NonNullable<ReturnType<DatabaseService["getMeetingDetail"]>>): string {
  const notes = detail.notes;

  if (!notes) {
    throw new Error("Meeting notes are required to export markdown.");
  }

  const transcriptLines = detail.transcriptChunks.map((chunk) => {
    const speakerLabel = chunk.speaker ? `**${chunk.speaker}:** ` : "";
    return `- ${speakerLabel}${chunk.text}`;
  });

  return [
    `# ${detail.meeting.title}`,
    "",
    `- Status: ${detail.meeting.status}`,
    `- Platform: ${detail.meeting.platform ?? "Unknown"}`,
    `- Started: ${detail.meeting.startedAt}`,
    `- Ended: ${detail.meeting.endedAt ?? "In progress"}`,
    "",
    "## Summary",
    "",
    notes.summary,
    "",
    "## Decisions",
    "",
    ...notes.decisions.map((item) => `- ${item}`),
    "",
    "## Action Items",
    "",
    ...notes.actionItems.map((item) => `- ${item}`),
    "",
    "## Open Questions",
    "",
    ...notes.openQuestions.map((item) => `- ${item}`),
    "",
    "## Follow-up Email",
    "",
    notes.followUpEmail,
    "",
    "## Transcript",
    "",
    ...transcriptLines
  ].join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
