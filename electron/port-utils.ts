import type http from "node:http";
import net from "node:net";

export function isAddrInUse(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}

export async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function pickPort(
  host: string,
  preferred: number,
  maxAttempts = 32,
  exclude: ReadonlySet<number> = new Set()
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferred + offset;
    if (port > 65535) break;
    if (exclude.has(port)) continue;
    if (await isPortAvailable(host, port)) return port;
  }
  throw new Error(`No free port found near ${preferred} on ${host}`);
}

/**
 * Bind `server` on the first free port at or above `preferred`, retrying on EADDRINUSE.
 * Returns the port actually bound.
 */
export async function listenWithPortRetry(
  server: net.Server | http.Server,
  host: string,
  preferred: number,
  exclude: ReadonlySet<number> = new Set(),
  maxAttempts = 32
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferred + offset;
    if (port > 65535) break;
    if (exclude.has(port)) continue;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => reject(error);
        server.once("error", onError);
        server.listen(port, host, () => {
          server.removeListener("error", onError);
          resolve();
        });
      });
      return port;
    } catch (error) {
      if (!isAddrInUse(error)) throw error;
    }
  }
  throw new Error(`Could not bind ${host} near port ${preferred}`);
}
