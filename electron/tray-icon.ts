import { app, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

/** 16×16 PNG (blue tile) for the system tray. */
const TRAY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFUlEQVR42mNkYGD4z0ABYBw1KgEAAV0AAR0h1n0AAAAASUVORK5CYII=";

export function loadTrayIcon() {
  if (!app.isPackaged) {
    const assetPath = path.join(repoRoot(), "electron", "assets", "tray.png");
    if (fs.existsSync(assetPath)) {
      return nativeImage.createFromPath(assetPath);
    }
  }
  return nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_PNG_BASE64}`);
}
