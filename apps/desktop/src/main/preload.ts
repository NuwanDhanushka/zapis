import { contextBridge, ipcRenderer } from "electron";
import type { ExportResult, Meeting, MeetingDetail, MeetingNotes, TranscriptChunk, ZapisApi } from "../shared/types";

const api: ZapisApi = {
  startMeeting: () => ipcRenderer.invoke("zapis:startMeeting") as Promise<Meeting>,
  stopMeeting: () => ipcRenderer.invoke("zapis:stopMeeting") as Promise<Meeting>,
  listMeetings: () => ipcRenderer.invoke("zapis:listMeetings") as Promise<Meeting[]>,
  getMeeting: (id: string) => ipcRenderer.invoke("zapis:getMeeting", id) as Promise<MeetingDetail>,
  transcribeMeeting: (id: string) => ipcRenderer.invoke("zapis:transcribeMeeting", id) as Promise<TranscriptChunk[]>,
  generateNotes: (id: string) => ipcRenderer.invoke("zapis:generateNotes", id) as Promise<MeetingNotes>,
  exportMeetingMarkdown: (id: string) => ipcRenderer.invoke("zapis:exportMeetingMarkdown", id) as Promise<ExportResult>
};

contextBridge.exposeInMainWorld("zapis", api);
