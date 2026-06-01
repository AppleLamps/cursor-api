import { app, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import path from "node:path";
import { getSettings, saveSettings, type AppSettings } from "./settings.js";
import { ServerController } from "./server-controller.js";
import {
  installIntegration,
  listIntegrationStatuses,
  type IntegrationId
} from "./provisioner.js";
import { distDir, repoRoot } from "./paths.js";
import { loadTrayIcon } from "./tray-icon.js";

const server = new ServerController();
server.onUpdate = () => broadcastState();
let tray: Tray | null = null;
let window: BrowserWindow | null = null;
let quitting = false;

interface UiState {
  settings: AppSettings;
  server: ReturnType<ServerController["getStatus"]>;
  integrations: ReturnType<typeof listIntegrationStatuses>;
  integrationError?: string;
}

let integrationError: string | undefined;

function buildState(): UiState {
  const settings = getSettings();
  return {
    // Never send the decrypted Cursor API key to the renderer; the UI relies on
    // server.apiKeyConfigured / apiKeyUnlocked to know whether a key is saved.
    settings: { ...settings, cursorApiKey: "" },
    server: server.getStatus(),
    integrations: listIntegrationStatuses(settings.publicPort),
    integrationError
  };
}

function broadcastState(): void {
  const state = buildState();
  window?.webContents.send("state", state);
}

async function createWindow(): Promise<void> {
  window = new BrowserWindow({
    width: 720,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(distDir(), "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await window.loadFile(path.join(repoRoot(), "electron", "renderer", "index.html"));
  window.show();
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window?.hide();
    }
  });
}

function createTray(): void {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip("API for Cursor");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open dashboard", click: () => window?.show() },
      { type: "separator" },
      {
        label: "Start server",
        click: async () => {
          try {
            await server.start();
          } catch {
            // surfaced via server.status.error
          }
          broadcastState();
        }
      },
      {
        label: "Stop server",
        click: async () => {
          await server.stop();
          broadcastState();
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("double-click", () => window?.show());
}

app.whenReady().then(async () => {
  await createWindow();
  createTray();

  ipcMain.handle("get-state", () => buildState());
  ipcMain.handle("save-settings", (_event, partial: Partial<AppSettings>) => {
    saveSettings(partial);
    broadcastState();
    return buildState();
  });
  ipcMain.handle("start-server", async () => {
    try {
      await server.start();
    } catch {
      // Error is stored on server status for the UI.
    }
    broadcastState();
    return buildState();
  });
  ipcMain.handle("stop-server", async () => {
    await server.stop();
    broadcastState();
    return buildState();
  });
  ipcMain.handle("install-integration", (_event, id: string) => {
    const settings = getSettings();
    try {
      installIntegration(id as IntegrationId, settings.publicPort);
      integrationError = undefined;
    } catch (error) {
      integrationError = `Failed to install ${id}: ${error instanceof Error ? error.message : String(error)}`;
    }
    broadcastState();
    return buildState();
  });

  if (getSettings().autoStartServer) {
    server.start().catch(() => undefined).finally(broadcastState);
  } else {
    broadcastState();
  }
});

app.on("before-quit", async () => {
  quitting = true;
  await server.stop();
});

app.on("window-all-closed", () => {
  // Keep running in the tray on Windows.
});
