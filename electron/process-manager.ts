import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bridgeScriptPath, composerApiRoot, viteElectronConfigPath } from "./paths.js";

export type ServiceName = "bridge" | "worker";

export interface ManagedProcess {
  name: ServiceName;
  child: ChildProcess;
  command: string;
  args: string[];
}

export type ProcessExitHandler = (name: ServiceName, code: number | null, signal: NodeJS.Signals | null) => void;

function viteBinPath(): string {
  return path.join(composerApiRoot(), "node_modules", "vite", "bin", "vite.js");
}

function attachExitHandler(child: ChildProcess, name: ServiceName, onExit?: ProcessExitHandler): void {
  if (!onExit) return;
  child.once("exit", (code, signal) => {
    onExit(name, code, signal);
  });
}

export function startBridge(port: number, token: string, onExit?: ProcessExitHandler): ManagedProcess {
  const cwd = composerApiRoot();
  const env = {
    ...process.env,
    CURSOR_SDK_BRIDGE_HOST: "127.0.0.1",
    CURSOR_SDK_BRIDGE_PORT: String(port),
    CURSOR_SDK_BRIDGE_TOKEN: token
  };
  const child = spawn(process.execPath, [bridgeScriptPath()], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  attachExitHandler(child, "bridge", onExit);
  return {
    name: "bridge",
    child,
    command: process.execPath,
    args: [bridgeScriptPath()]
  };
}

export function startWorkerDev(
  workerPort: number,
  bridgePort: number,
  bridgeToken: string,
  onExit?: ProcessExitHandler
): ManagedProcess {
  const cwd = composerApiRoot();
  const env = {
    ...process.env,
    CURSOR_SDK_BRIDGE_URL: `http://127.0.0.1:${bridgePort}/sdk`,
    CURSOR_SDK_BRIDGE_TOKEN: bridgeToken
  };
  const args = [
    viteBinPath(),
    "--config",
    viteElectronConfigPath(),
    "--host",
    "127.0.0.1",
    "--port",
    String(workerPort),
    "--strictPort"
  ];
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  attachExitHandler(child, "worker", onExit);
  return {
    name: "worker",
    child,
    command: process.execPath,
    args
  };
}

export function stopProcess(managed: ManagedProcess | null): void {
  if (!managed?.child.pid) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(managed.child.pid), "/f", "/t"], { windowsHide: true });
    } else {
      managed.child.kill("SIGTERM");
    }
  } catch {
    managed.child.kill("SIGKILL");
  }
}

export function tailProcessOutput(
  managed: ManagedProcess,
  onLine: (line: string, stream: "stdout" | "stderr") => void
): void {
  const attach = (stream: NodeJS.ReadableStream | null, name: "stdout" | "stderr") => {
    if (!stream) return;
    let buffer = "";
    stream.on("data", (chunk: Buffer | string) => {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onLine(line, name);
      }
    });
  };
  attach(managed.child.stdout, "stdout");
  attach(managed.child.stderr, "stderr");
}

export async function waitForHttpOk(
  url: string,
  timeoutMs = 60_000,
  intervalMs = 400
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "timeout";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 401) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

export function ensureDevVars(bridgePort: number, bridgeToken: string): void {
  const devVarsPath = path.join(composerApiRoot(), ".dev.vars");
  const content = [
    'ENCRYPTION_KEY="local-dev-secret-with-enough-entropy-for-encryption"',
    `CURSOR_SDK_BRIDGE_URL="http://127.0.0.1:${bridgePort}/sdk"`,
    `CURSOR_SDK_BRIDGE_TOKEN="${bridgeToken}"`,
    'CURSOR_SDK_BRIDGE_TIMEOUT_MS="180000"',
    ""
  ].join("\n");
  fs.writeFileSync(devVarsPath, content, "utf8");
}
