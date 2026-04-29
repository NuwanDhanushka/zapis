import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, shell } from "electron";
import { createAppPaths } from "./config/paths";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { DatabaseService } from "./services/database.service";
import { ExportService } from "./services/export.service";
import { MeetingService } from "./services/meeting.service";
import { NotesService } from "./services/notes.service";
import { TranscriptionService } from "./services/transcription.service";

const isDev = !app.isPackaged;
app.setName("Zapis");

function getRendererEntryUrl(): string {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return pathToFileURL(path.join(app.getAppPath(), "dist/renderer/index.html")).toString();
}

function isTrustedRendererUrl(url: string): boolean {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    return url.startsWith(process.env.VITE_DEV_SERVER_URL);
  }

  return url === getRendererEntryUrl();
}

function configureWindowSecurity(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault();
    }
  });
}

async function createMainWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, "preload.js");

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "Zapis",
    backgroundColor: "#0B1220",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  configureWindowSecurity(window);
  await window.loadURL(getRendererEntryUrl());
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const appPaths = createAppPaths(app.getPath("appData"), app.getPath("documents"));
  const database = new DatabaseService({
    userDataPath: appPaths.userDataPath
  });

  await database.initialize();

  const meetingService = new MeetingService(database);
  const transcriptionService = new TranscriptionService(database);
  const notesService = new NotesService(database);
  const exportService = new ExportService(database, appPaths.exportsPath);

  registerIpcHandlers({
    isTrustedSender: (event) => {
      const senderUrl = event.senderFrame?.url;
      return typeof senderUrl === "string" && isTrustedRendererUrl(senderUrl);
    },
    meetingService,
    transcriptionService,
    notesService,
    exportService
  });

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });

  app.on("before-quit", () => {
    database.close();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrap();
