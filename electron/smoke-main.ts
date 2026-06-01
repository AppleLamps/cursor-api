/**
 * Headless Electron entry: start full stack, GET /v1/models via auth proxy, exit.
 * Local: reads repo-root `.env`. CI: set repository secret CURSOR_API_KEY.
 */
import { app } from "electron";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "./env-file.js";
import { repoRoot } from "./paths.js";
import { saveSettings } from "./settings.js";
import { ServerController } from "./server-controller.js";

const DEADLINE_MS = Number(process.env.SMOKE_DEADLINE_MS ?? 300_000);

function resolveApiKey(): string | undefined {
  const candidates = [
    process.env.CURSOR_API_KEY,
    process.env.CURSOR_API_KEY_TOKEN,
    process.env.CURSOR_KEY
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function prepareSmokeHome(): void {
  if (!process.env.API_FOR_CURSOR_HOME?.trim()) {
    process.env.API_FOR_CURSOR_HOME = path.join(os.tmpdir(), "api-for-cursor-smoke");
  }
}

loadEnvFile(path.join(repoRoot(), ".env"));
prepareSmokeHome();

app.commandLine.appendSwitch("disable-gpu");
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error(
      "[smoke] Missing CURSOR_API_KEY. Add it to .env at repo root or export it before npm run smoke."
    );
    app.exit(1);
    return;
  }

  const server = new ServerController();
  const started = Date.now();

  try {
    saveSettings({ cursorApiKey: apiKey, autoStartServer: false });
    console.log("[smoke] Starting server stack…");

    const status = await Promise.race([
      server.start(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Smoke deadline exceeded (${DEADLINE_MS}ms)`)), DEADLINE_MS);
      })
    ]);

    if (!status.ready) {
      throw new Error(`Server not ready: ${status.error ?? "unknown"}`);
    }

    console.log(`[smoke] Ready at ${status.baseUrl} (${Date.now() - started}ms)`);

    const modelsUrl = `${status.baseUrl}/models`;
    const response = await fetch(modelsUrl, {
      headers: { Authorization: "Bearer cursor-local" }
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`GET ${modelsUrl} → HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    const parsed = JSON.parse(body) as { data?: unknown[] };
    if (!Array.isArray(parsed.data) || parsed.data.length === 0) {
      throw new Error(`GET ${modelsUrl} returned no models`);
    }

    console.log(`[smoke] OK — ${parsed.data.length} model(s) via auth proxy`);
    for (const entry of status.logs.slice(-15)) {
      console.log(entry);
    }
  } catch (error) {
    console.error("[smoke] FAILED:", error instanceof Error ? error.message : error);
    for (const entry of server.getStatus().logs.slice(-25)) {
      console.error(entry);
    }
    app.exit(1);
    return;
  } finally {
    try {
      await server.stop();
    } catch {
      // ignore cleanup errors
    }
  }

  app.exit(0);
});
