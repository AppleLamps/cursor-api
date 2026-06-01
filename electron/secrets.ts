import { safeStorage } from "electron";

const ENCRYPTED_PREFIX = "enc:";

/** How the Cursor API key is persisted in settings.json. */
export type ApiKeyStorageMode = "encrypted" | "plaintext";

export function apiKeyStorageMode(): ApiKeyStorageMode {
  return safeStorage.isEncryptionAvailable() ? "encrypted" : "plaintext";
}

export function isApiKeyConfigured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function encryptApiKey(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return "";
  if (safeStorage.isEncryptionAvailable()) {
    return ENCRYPTED_PREFIX + safeStorage.encryptString(trimmed).toString("base64");
  }
  return trimmed;
}

export function decryptApiKey(stored: string): string {
  if (!stored) return "";
  if (stored.startsWith(ENCRYPTED_PREFIX) && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), "base64"));
    } catch {
      return "";
    }
  }
  return stored;
}
