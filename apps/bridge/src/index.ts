import { execFile as execFileCallback } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
export const TESTED_CODEX_VERSION = "codex-cli 0.145.0-alpha.18";

export interface CodexPreflight {
  available: boolean;
  version?: string;
  supported: boolean;
  guidance?: string;
}

export async function inspectCodexExecutable(executable: string): Promise<CodexPreflight> {
  try {
    const result = await execFile(executable, ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 100_000,
    });
    const version = result.stdout.trim();
    if (!/^codex-cli \S+$/u.test(version)) {
      return { available: true, version, supported: false, guidance: "The executable did not return a recognised Codex version." };
    }
    const supported = version === TESTED_CODEX_VERSION;
    return {
      available: true,
      version,
      supported,
      ...(supported ? {} : { guidance: `Flight Recorder was tested with ${TESTED_CODEX_VERSION}.` }),
    };
  } catch {
    return { available: false, supported: false, guidance: "Codex could not be started. Confirm installation and signed-in authentication." };
  }
}

export interface LocalBridgeOptions {
  preflight: CodexPreflight;
  port?: number;
  knownOrigins?: readonly string[];
  tokenFactory?: () => string;
}

export interface LocalBridge {
  origin: string;
  launchUrl: string;
  close: () => Promise<void>;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && parsed.pathname === "/";
  } catch {
    return false;
  }
}

function secureHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("cross-origin-resource-policy", "same-origin");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  secureHeaders(response);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
}

function tokenMatches(candidate: string | undefined, expected: string): boolean {
  if (candidate === undefined) return false;
  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return candidateBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(candidateBytes, expectedBytes);
}

function cookieValue(request: IncomingMessage, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

const pairingScript = `(() => {
  const token = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  history.replaceState(null, "", "/pair");
  fetch("/pair", { method: "POST", headers: { "x-flight-recorder-pairing-token": token }, credentials: "same-origin" })
    .then((response) => { if (!response.ok) throw new Error("Pairing failed"); location.replace("/status"); })
    .catch(() => { document.body.textContent = "Flight Recorder pairing failed. Request a new one-time launch link."; });
})();\n`;

export async function startLocalBridge(options: LocalBridgeOptions): Promise<LocalBridge> {
  const requestedOrigins = options.knownOrigins ?? [];
  if (requestedOrigins.some((origin) => !isLoopbackOrigin(origin))) throw new Error("Local bridge origins must use loopback HTTP addresses.");
  const sessionToken = (options.tokenFactory ?? (() => randomBytes(32).toString("base64url")))();
  if (!/^[A-Za-z0-9_-]{43}$/u.test(sessionToken)) throw new Error("The local bridge requires a random 256-bit base64url session token.");
  let pairingAvailable = true;
  let allowedOrigins = new Set(requestedOrigins);

  const server: Server = createServer((request, response) => {
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      sendJson(response, 403, { error: "origin-not-allowed" });
      return;
    }
    if (origin !== undefined) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("access-control-allow-credentials", "true");
      response.setHeader("vary", "origin");
    }
    if (request.method === "OPTIONS") {
      secureHeaders(response);
      response.statusCode = 204;
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type, x-flight-recorder-pairing-token");
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/pair") {
      secureHeaders(response);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.setHeader("content-security-policy", "default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
      response.end("<!doctype html><html lang=\"en-GB\"><head><meta charset=\"utf-8\"><title>Pair Flight Recorder</title></head><body><p>Pairing Flight Recorder…</p><script src=\"/pair.js\"></script></body></html>");
      return;
    }
    if (request.method === "GET" && url.pathname === "/pair.js") {
      secureHeaders(response);
      response.statusCode = 200;
      response.setHeader("content-type", "text/javascript; charset=utf-8");
      response.end(pairingScript);
      return;
    }
    if (request.method === "POST" && url.pathname === "/pair") {
      if (!pairingAvailable) {
        sendJson(response, 409, { error: "pairing-link-already-used" });
        return;
      }
      const suppliedToken = Array.isArray(request.headers["x-flight-recorder-pairing-token"])
        ? request.headers["x-flight-recorder-pairing-token"][0]
        : request.headers["x-flight-recorder-pairing-token"];
      if (!tokenMatches(suppliedToken, sessionToken)) {
        sendJson(response, 401, { error: "invalid-pairing-token" });
        return;
      }
      pairingAvailable = false;
      secureHeaders(response);
      response.statusCode = 204;
      response.setHeader("set-cookie", `flight_recorder_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`);
      response.end();
      return;
    }

    const authenticated = tokenMatches(cookieValue(request, "flight_recorder_session"), sessionToken);
    if (!authenticated) {
      sendJson(response, 401, { error: "authentication-required" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/status") {
      sendJson(response, 200, {
        status: "ready",
        bindAddress: "127.0.0.1",
        codex: options.preflight,
        capabilities: ["status", "session-initialisation", "codex-exec-json-fallback"],
        appServer: { connected: false, status: "not-connected" },
      });
      return;
    }
    sendJson(response, 404, { error: "route-not-found" });
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("The local bridge did not expose a TCP loopback address.");
  const origin = `http://127.0.0.1:${address.port}`;
  allowedOrigins = new Set([...allowedOrigins, origin, `http://localhost:${address.port}`]);
  return {
    origin,
    launchUrl: `${origin}/pair#${sessionToken}`,
    close: async () => new Promise<void>((resolveClose, reject) => server.close((error) => error === undefined ? resolveClose() : reject(error))),
  };
}
