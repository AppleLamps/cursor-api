import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decryptApiKey, encryptApiKey, isApiKeyConfigured } from "./secrets.js";

export interface AppSettings {
  /** Stored encrypted when OS DPAPI/keychain is available. */
  cursorApiKey: string;
  publicPort: number;
  workerPort: number;
  bridgePort: number;
  autoStartServer: boolean;
}

const defaults: AppSettings = {
  cursorApiKey: "",
  publicPort: 8787,
  workerPort: 18787,
  bridgePort: 8792,
  autoStartServer: true
};

function settingsDir(): string {
  const override = process.env.API_FOR_CURSOR_HOME?.trim();
  if (override) return override;
  return path.join(os.homedir(), ".api-for-cursor");
}

function settingsPath(): string {
  return path.join(settingsDir(), "settings.json");
}

function readStore(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = { ...defaults, ...JSON.parse(raw) } as AppSettings;
    return parsed;
  } catch {
    return { ...defaults };
  }
}

function writeStore(settings: AppSettings): void {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export function getSettings(): AppSettings {
  const stored = readStore();
  return {
    ...stored,
    cursorApiKey: decryptApiKey(stored.cursorApiKey)
  };
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = readStore();
  const next: AppSettings = { ...current, ...partial };
  if (partial.cursorApiKey !== undefined) {
    next.cursorApiKey = encryptApiKey(partial.cursorApiKey);
  }
  writeStore(next);
  return getSettings();
}

export function publicBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}/v1`;
}

export function apiKeyStatus(): { configured: boolean; unlocked: boolean } {
  const stored = readStore();
  const plain = decryptApiKey(stored.cursorApiKey);
  return {
    configured: isApiKeyConfigured(stored.cursorApiKey),
    unlocked: isApiKeyConfigured(plain)
  };
}
