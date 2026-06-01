import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function packaged(): boolean {
  try {
    return app.isPackaged;
  } catch {
    return false;
  }
}

/** Compiled main/preload (`dist/`). */
export function distDir(): string {
  if (packaged()) {
    return path.join(app.getAppPath(), "dist");
  }
  return moduleDir;
}

/** Repo root (dev) or install folder containing `resources/` (packaged). */
export function repoRoot(): string {
  if (packaged()) {
    return path.join(process.resourcesPath, "..");
  }
  return path.resolve(moduleDir, "..");
}

export function composerApiRoot(): string {
  if (packaged()) {
    return path.join(process.resourcesPath, "vendor", "composer-api");
  }
  return path.join(repoRoot(), "vendor", "composer-api");
}

export function rendererIndexPath(): string {
  if (packaged()) {
    return path.join(process.resourcesPath, "renderer", "index.html");
  }
  return path.join(repoRoot(), "electron", "renderer", "index.html");
}

export function bridgeScriptPath(): string {
  return path.join(composerApiRoot(), "scripts", "cursor-sdk-local-agent-bridge.mjs");
}

export function viteElectronConfigPath(): string {
  return path.join(composerApiRoot(), "vite.electron.config.ts");
}
