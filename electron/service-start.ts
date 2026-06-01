import type { ManagedProcess, ProcessExitHandler } from "./process-manager.js";
import {
  ensureDevVars,
  startBridge,
  startWorkerDev,
  stopProcess,
  tailProcessOutput,
  waitForHttpOk
} from "./process-manager.js";
import { isPortAvailable } from "./port-utils.js";

const HOST = "127.0.0.1";
const MAX_PORT_ATTEMPTS = 32;

function healthTimeoutMs(): number {
  const fromEnv = Number(process.env.SMOKE_HEALTH_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 25_000;
}

export async function startBridgeUntilReady(
  preferredPort: number,
  bridgeToken: string,
  usedPorts: Set<number>,
  onExit: ProcessExitHandler | undefined,
  onLog: (line: string) => void
): Promise<{ process: ManagedProcess; port: number }> {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = preferredPort + offset;
    if (port > 65535) break;
    if (usedPorts.has(port)) continue;
    if (!(await isPortAvailable(HOST, port))) continue;

    usedPorts.add(port);
    ensureDevVars(port, bridgeToken);
    const proc = startBridge(port, bridgeToken, onExit);
    tailProcessOutput(proc, (line) => onLog(`[bridge] ${line}`));

    try {
      await waitForHttpOk(`http://${HOST}:${port}/health`, healthTimeoutMs());
      return { process: proc, port };
    } catch {
      stopProcess(proc);
      usedPorts.delete(port);
      onLog(`[bridge] Port ${port} not ready, trying next…`);
    }
  }
  throw new Error(`No free port for bridge near ${preferredPort} on ${HOST}`);
}

export async function startWorkerUntilReady(
  preferredPort: number,
  bridgePort: number,
  bridgeToken: string,
  usedPorts: Set<number>,
  onExit: ProcessExitHandler | undefined,
  onLog: (line: string) => void
): Promise<{ process: ManagedProcess; port: number }> {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = preferredPort + offset;
    if (port > 65535) break;
    if (usedPorts.has(port)) continue;
    if (!(await isPortAvailable(HOST, port))) continue;

    usedPorts.add(port);
    const proc = startWorkerDev(port, bridgePort, bridgeToken, onExit);
    tailProcessOutput(proc, (line) => onLog(`[worker] ${line}`));

    try {
      await waitForHttpOk(`http://${HOST}:${port}/v1/models`, healthTimeoutMs());
      return { process: proc, port };
    } catch {
      stopProcess(proc);
      usedPorts.delete(port);
      onLog(`[worker] Port ${port} not ready, trying next…`);
    }
  }
  throw new Error(`No free port for worker near ${preferredPort} on ${HOST}`);
}
