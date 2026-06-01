import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isPlaceholderToken } from "./auth-tokens.js";
import { listenWithPortRetry } from "./port-utils.js";

/** Reject oversized bodies before buffering (local DoS / accidental huge uploads). */
export const MAX_REQUEST_BODY_BYTES = 32 * 1024 * 1024;

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
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, OpenAI-Beta, OpenAI-Organization, OpenAI-Project, X-Request-ID, X-Session-Affinity, X-OpenCode-Session-Id, X-OpenCode-Session, X-CursorAPI-Session, X-CursorAPI-Project, X-Project-Path, X-Workspace-Path, X-Working-Directory",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

/**
 * Only browser pages served from localhost (or `file:`/`null` origins like the Electron
 * renderer) may use this key-injecting proxy cross-origin. Native clients (curl, codex,
 * opencode, …) send no Origin header and are always allowed; a remote web page that tries
 * to spend the user's key via `Bearer cursor-local` is rejected.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || origin === "null") return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "file:") return true;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const headers = { ...CORS_HEADERS };
  // Reflect the specific allowed origin rather than `*` so only vetted callers can read responses.
  if (origin && origin !== "null") {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

export interface AuthProxyOptions {
  listenHost: string;
  listenPort: number;
  upstreamOrigin: string;
  getCursorApiKey: () => string | undefined;
}

export function createAuthProxy(options: AuthProxyOptions): http.Server {
  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "Cross-origin requests are not allowed for this local API.",
            type: "invalid_request_error",
            code: "forbidden"
          }
        })
      );
      return;
    }
    const cors = corsHeaders(origin);
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    proxyRequest(req, res, options, cors).catch((error) => {
      if (!res.headersSent) {
        res.writeHead(502, { ...cors, "Content-Type": "application/json" });
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
  options: AuthProxyOptions,
  cors: Record<string, string>
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
        res.writeHead(401, { ...cors, "Content-Type": "application/json" });
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
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await readBody(req, MAX_REQUEST_BODY_BYTES);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        res.writeHead(413, { ...cors, "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`,
              type: "invalid_request_error",
              code: "payload_too_large"
            }
          })
        );
        return;
      }
      throw error;
    }
  }

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

  const responseHeaders: Record<string, string> = { ...cors };
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

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function listenAuthProxy(
  server: http.Server,
  host: string,
  preferredPort: number,
  exclude: ReadonlySet<number> = new Set(),
  maxAttempts = 32
): Promise<number> {
  return listenWithPortRetry(server, host, preferredPort, exclude, maxAttempts);
}
