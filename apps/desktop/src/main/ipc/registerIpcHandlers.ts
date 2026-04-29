import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import { meetingIdSchema } from "../../shared/schemas";
import { toSafeError } from "../errors/app-error";
import type { ExportService } from "../services/export.service";
import type { MeetingService } from "../services/meeting.service";
import type { NotesService } from "../services/notes.service";
import type { TranscriptionService } from "../services/transcription.service";

interface Services {
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean;
  meetingService: MeetingService;
  transcriptionService: TranscriptionService;
  notesService: NotesService;
  exportService: ExportService;
}

function assertTrustedSender(event: IpcMainInvokeEvent, isTrustedSender: Services["isTrustedSender"]): void {
  if (!isTrustedSender(event)) {
    throw new Error("Untrusted IPC sender.");
  }
}

export function registerIpcHandlers(services: Services): void {
  ipcMain.handle("zapis:startMeeting", async (event) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.meetingService.startMeeting();
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:stopMeeting", async (event) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.meetingService.stopMeeting();
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:listMeetings", async (event) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.meetingService.listMeetings();
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:getMeeting", async (event, id: unknown) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.meetingService.getMeetingDetail(meetingIdSchema.parse(id));
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:transcribeMeeting", async (event, id: unknown) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.transcriptionService.transcribeMeeting(meetingIdSchema.parse(id));
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:generateNotes", async (event, id: unknown) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.notesService.generateNotes(meetingIdSchema.parse(id));
    } catch (error) {
      throw toSafeError(error);
    }
  });

  ipcMain.handle("zapis:exportMeetingMarkdown", async (event, id: unknown) => {
    try {
      assertTrustedSender(event, services.isTrustedSender);
      return await services.exportService.exportMeetingMarkdown(meetingIdSchema.parse(id));
    } catch (error) {
      throw toSafeError(error);
    }
  });
}
