import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("apiForCursor", {
  getState: () => ipcRenderer.invoke("get-state"),
  saveSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke("save-settings", partial),
  startServer: () => ipcRenderer.invoke("start-server"),
  stopServer: () => ipcRenderer.invoke("stop-server"),
  installIntegration: (id: string) => ipcRenderer.invoke("install-integration", id),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  }
});
