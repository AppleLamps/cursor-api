import net from "node:net";

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
  maxAttempts = 32
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = preferred + offset;
    if (port > 65535) break;
    if (await isPortAvailable(host, port)) return port;
  }
  throw new Error(`No free port found near ${preferred} on ${host}`);
}
