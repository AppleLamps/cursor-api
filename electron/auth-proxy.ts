import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isPlaceholderToken } from "./auth-tokens.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade"
]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, OpenAI-Beta, OpenAI-Organization, OpenAI-Project, X-Request-ID, X-Session-Affinity, X-OpenCode-Session-Id, X-OpenCode-Session, X-CursorAPI-Session, X-CursorAPI-Project, X-Project-Path, X-Workspace-Path, X-Working-Directory",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

export interface AuthProxyOptions {
  listenHost: string;
  listenPort: number;
  upstreamOrigin: string;
  getCursorApiKey: () => string | undefined;
}

export function createAuthProxy(options: AuthProxyOptions): http.Server {
  return http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }
    proxyRequest(req, res, options).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(502, { ...CORS_HEADERS, "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : "Proxy error",
              type: "proxy_error"
            }
          })
        );
      }
    });
  });
}

async function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AuthProxyOptions
): Promise<void> {
  const upstream = new URL(req.url || "/", options.upstreamOrigin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      for (const part of value) headers.append(key, part);
    } else {
      headers.set(key, value);
    }
  }

  const auth = headers.get("authorization");
  if (auth) {
    const token = parseBearer(auth);
    if (isPlaceholderToken(token)) {
      const apiKey = options.getCursorApiKey()?.trim();
      if (!apiKey) {
        res.writeHead(401, { ...CORS_HEADERS, "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "Cursor API key is not configured in API for Cursor.",
              type: "invalid_request_error",
              code: "unauthorized"
            }
          })
        );
        return;
      }
      headers.set("authorization", `Bearer ${apiKey}`);
    }
  }

  const method = req.method || "GET";
  const body =
    method === "GET" || method === "HEAD" ? undefined : await readBody(req);

  const controller = new AbortController();
  req.on("aborted", () => controller.abort());
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  const upstreamResponse = await fetch(upstream, {
    method,
    headers,
    body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    signal: controller.signal
  });

  const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    responseHeaders[key] = value;
  });

  res.writeHead(upstreamResponse.status, responseHeaders);

  if (!upstreamResponse.body) {
    res.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.writableEnded) break;
      res.write(value);
    }
  } catch (error) {
    if (!controller.signal.aborted && !res.headersSent) throw error;
  } finally {
    if (!res.writableEnded) res.end();
  }
}

function parseBearer(header: string): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim();
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function listenAuthProxy(
  server: http.Server,
  host: string,
  port: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}
