import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function distDir(): string {
  return moduleDir;
}

export function repoRoot(): string {
  return path.resolve(moduleDir, "..");
}

export function composerApiRoot(): string {
  return path.join(repoRoot(), "vendor", "composer-api");
}

export function bridgeScriptPath(): string {
  return path.join(composerApiRoot(), "scripts", "cursor-sdk-local-agent-bridge.mjs");
}

export function viteElectronConfigPath(): string {
  return path.join(composerApiRoot(), "vite.electron.config.ts");
}
