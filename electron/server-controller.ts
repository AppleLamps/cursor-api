import crypto from "node:crypto";
import type http from "node:http";
import { createAuthProxy, listenAuthProxy } from "./auth-proxy.js";
import {
  stopProcess,
  waitForHttpOk,
  type ManagedProcess,
  type ProcessExitHandler
} from "./process-manager.js";
import { startBridgeUntilReady, startWorkerUntilReady } from "./service-start.js";
import { apiKeyStorageMode } from "./secrets.js";
import { apiKeyStatus, getSettings, saveSettings } from "./settings.js";

export interface ServerStatus {
  running: boolean;
  ready: boolean;
  publicPort: number;
  baseUrl: string;
  bridgePort: number;
  workerPort: number;
  apiKeyConfigured: boolean;
  apiKeyUnlocked: boolean;
  /** `encrypted` when Windows DPAPI is available; otherwise key is stored as plaintext in settings.json. */
  apiKeyStorage: "encrypted" | "plaintext";
  error?: string;
  logs: string[];
}

export class ServerController {
  /** Called when status changes (e.g. child process exit). */
  onUpdate?: () => void;

  private bridge: ManagedProcess | null = null;
  private worker: ManagedProcess | null = null;
  private proxy: http.Server | null = null;
  private bridgeToken = "";
  private logs: string[] = [];
  private stopping = false;
  private status: ServerStatus = {
    running: false,
    ready: false,
    publicPort: 8787,
    baseUrl: "http://127.0.0.1:8787/v1",
    bridgePort: 8792,
    workerPort: 18787,
    apiKeyConfigured: false,
    apiKeyUnlocked: false,
    apiKeyStorage: apiKeyStorageMode(),
    logs: []
  };

  getStatus(): ServerStatus {
    const key = apiKeyStatus();
    return {
      ...this.status,
      apiKeyConfigured: key.configured,
      apiKeyUnlocked: key.unlocked,
      apiKeyStorage: apiKeyStorageMode(),
      logs: [...this.logs]
    };
  }

  private pushLog(line: string): void {
    this.logs.push(line);
    if (this.logs.length > 200) this.logs.shift();
    this.status.logs = [...this.logs];
  }

  private onProcessExit: ProcessExitHandler = (name, code, signal) => {
    if (this.stopping) return;
    const detail = signal ? `signal ${signal}` : `code ${code ?? "?"}`;
    this.status.error = `${name} process exited (${detail})`;
    this.pushLog(`[fatal] ${this.status.error}`);
    void this.stop().then(() => this.onUpdate?.());
  };

  async start(): Promise<ServerStatus> {
    if (this.status.running) return this.getStatus();

    const key = apiKeyStatus();
    if (!key.unlocked) {
      const message = "Save a Cursor API key before starting the server.";
      this.status.error = message;
      throw new Error(message);
    }

    const settings = getSettings();
    this.bridgeToken = crypto.randomBytes(16).toString("hex");

    const usedPorts = new Set<number>();
    let bridgePort = 0;
    let workerPort = 0;
    let publicPort = 0;

    this.status = {
      ...this.status,
      running: true,
      ready: false,
      publicPort: settings.publicPort,
      bridgePort: settings.bridgePort,
      workerPort: settings.workerPort,
      baseUrl: `http://127.0.0.1:${settings.publicPort}/v1`,
      error: undefined
    };

    try {
      this.pushLog("Starting Cursor SDK bridge…");
      const bridge = await startBridgeUntilReady(
        settings.bridgePort,
        this.bridgeToken,
        usedPorts,
        this.onProcessExit,
        (line) => this.pushLog(line)
      );
      this.bridge = bridge.process;
      bridgePort = bridge.port;
      this.status.bridgePort = bridgePort;

      this.pushLog("Starting API worker (Vite + Cloudflare)…");
      const worker = await startWorkerUntilReady(
        settings.workerPort,
        bridgePort,
        this.bridgeToken,
        usedPorts,
        this.onProcessExit,
        (line) => this.pushLog(line)
      );
      this.worker = worker.process;
      workerPort = worker.port;
      this.status.workerPort = workerPort;

      this.pushLog("Starting public API proxy…");
      this.proxy = createAuthProxy({
        listenHost: "127.0.0.1",
        listenPort: settings.publicPort,
        upstreamOrigin: `http://127.0.0.1:${workerPort}`,
        getCursorApiKey: () => getSettings().cursorApiKey
      });
      publicPort = await listenAuthProxy(
        this.proxy,
        "127.0.0.1",
        settings.publicPort,
        usedPorts
      );
      usedPorts.add(publicPort);
      this.status.publicPort = publicPort;
      this.status.baseUrl = `http://127.0.0.1:${publicPort}/v1`;
      await waitForHttpOk(`http://127.0.0.1:${publicPort}/v1/models`);

      if (
        bridgePort !== settings.bridgePort ||
        workerPort !== settings.workerPort ||
        publicPort !== settings.publicPort
      ) {
        saveSettings({ bridgePort, workerPort, publicPort });
        this.pushLog(
          `Using ports bridge=${bridgePort}, worker=${workerPort}, public=${publicPort} (defaults were busy)`
        );
      }

      this.status.ready = true;
      this.pushLog(`Server ready at ${this.status.baseUrl}`);
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : String(error);
      this.pushLog(`Error: ${this.status.error}`);
      await this.stop();
      throw error;
    }
    return this.getStatus();
  }

  async stop(): Promise<ServerStatus> {
    this.stopping = true;
    if (this.proxy) {
      await new Promise<void>((resolve) => this.proxy!.close(() => resolve()));
      this.proxy = null;
    }
    stopProcess(this.worker);
    stopProcess(this.bridge);
    this.worker = null;
    this.bridge = null;
    this.status.running = false;
    this.status.ready = false;
    this.pushLog("Server stopped");
    this.stopping = false;
    return this.getStatus();
  }
}
