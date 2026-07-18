import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const DEFAULT_MAX_LINE_BYTES = 1_000_000;
const DEFAULT_MAX_TOTAL_BYTES = 25_000_000;

type RequestId = string | number;

interface ProtocolMessage {
  id?: unknown;
  method?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface AppServerClientOptions {
  executable: string;
  argumentsPrefix?: readonly string[];
  requestTimeoutMs?: number;
  maxLineBytes?: number;
  maxTotalBytes?: number;
  onNotification?: (method: string, params: unknown) => void;
  onServerRequest?: (request: { id: RequestId; method: string; params: unknown }) => void;
}

export interface AppServerInitialisation {
  userAgent: string;
  platformFamily: string;
  platformOs: string;
}

export interface AppServerThread {
  id: string;
}

export interface AppServerTurn {
  id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is RequestId {
  return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value));
}

function reasoningMessage(method: string, params: unknown): boolean {
  if (method.startsWith("item/reasoning/")) return true;
  if (!isRecord(params)) return false;
  const item = isRecord(params.item) ? params.item : undefined;
  return item?.type === "reasoning";
}

export class AppServerClient {
  readonly #options: AppServerClientOptions;
  readonly #pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  #child: ChildProcessWithoutNullStreams | undefined;
  #nextRequestId = 1;
  #stdoutBuffer = "";
  #totalBytes = 0;
  #closed = false;

  constructor(options: AppServerClientOptions) {
    this.#options = options;
  }

  async start(): Promise<AppServerInitialisation> {
    if (this.#child !== undefined) throw new Error("The App Server client has already started.");
    const child = spawn(this.#options.executable, [...(this.#options.argumentsPrefix ?? []), "app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    this.#child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.#consumeStdout(chunk));
    // Standard error may contain local plugin diagnostics. Drain it without persisting or forwarding raw content.
    child.stderr.on("data", () => undefined);
    child.once("error", () => this.#failAll("Codex App Server could not be started."));
    child.once("close", () => {
      if (!this.#closed) this.#failAll("Codex App Server closed before the client finished.");
    });

    const result = await this.#request("initialize", {
      clientInfo: { name: "flight-recorder", version: "0.1.0" },
      capabilities: { experimentalApi: false },
    });
    if (!isRecord(result) || typeof result.userAgent !== "string" || typeof result.platformFamily !== "string" || typeof result.platformOs !== "string") {
      throw new Error("Codex App Server returned incomplete initialisation metadata.");
    }
    this.#notify("initialized");
    return { userAgent: result.userAgent, platformFamily: result.platformFamily, platformOs: result.platformOs };
  }

  async startThread(repositoryPath: string, options: { ephemeral?: boolean } = {}): Promise<AppServerThread> {
    const result = await this.#request("thread/start", {
      cwd: repositoryPath,
      sandbox: "workspace-write",
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      ephemeral: options.ephemeral ?? false,
    });
    if (!isRecord(result) || !isRecord(result.thread) || typeof result.thread.id !== "string") {
      throw new Error("Codex App Server returned an invalid thread/start response.");
    }
    return { id: result.thread.id };
  }

  async startTurn(threadId: string, task: string): Promise<AppServerTurn> {
    const result = await this.#request("turn/start", { threadId, input: [{ type: "text", text: task }] });
    if (!isRecord(result) || !isRecord(result.turn) || typeof result.turn.id !== "string") {
      throw new Error("Codex App Server returned an invalid turn/start response.");
    }
    return { id: result.turn.id };
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.#request("turn/interrupt", { threadId, turnId });
  }

  respondToServerRequest(id: RequestId, result: unknown): void {
    this.#write({ id, result });
  }

  respondToApproval(id: RequestId, decision: "accept" | "acceptForSession" | "decline" | "cancel"): void {
    this.respondToServerRequest(id, { decision });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const child = this.#child;
    if (child === undefined) return;
    child.stdin.end();
    if (child.exitCode !== null) return;
    await new Promise<void>((resolveClose) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolveClose();
      }, 1_000);
      child.once("close", () => {
        clearTimeout(timeout);
        resolveClose();
      });
      child.kill("SIGTERM");
    });
  }

  #notify(method: string, params?: unknown): void {
    this.#write(params === undefined ? { method } : { method, params });
  }

  #request(method: string, params: unknown): Promise<unknown> {
    const id = this.#nextRequestId++;
    const timeoutMs = this.#options.requestTimeoutMs ?? 15_000;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        rejectRequest(new Error(`Codex App Server request timed out: ${method}.`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timeout });
      try {
        this.#write({ id, method, params });
      } catch (error) {
        clearTimeout(timeout);
        this.#pending.delete(id);
        rejectRequest(error instanceof Error ? error : new Error("Codex App Server request failed."));
      }
    });
  }

  #write(message: unknown): void {
    if (this.#closed || this.#child?.stdin.writable !== true) throw new Error("Codex App Server transport is not writable.");
    this.#child.stdin.write(`${JSON.stringify(message)}\n`, "utf8");
  }

  #consumeStdout(chunk: string): void {
    this.#totalBytes += Buffer.byteLength(chunk, "utf8");
    if (this.#totalBytes > (this.#options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES)) {
      this.#failAll("Codex App Server output exceeded the total safety limit.");
      this.#child?.kill("SIGTERM");
      return;
    }
    this.#stdoutBuffer += chunk;
    let newline = this.#stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.#stdoutBuffer.slice(0, newline).replace(/\r$/u, "");
      this.#stdoutBuffer = this.#stdoutBuffer.slice(newline + 1);
      if (Buffer.byteLength(line, "utf8") > (this.#options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES)) {
        this.#failAll("Codex App Server output exceeded the line safety limit.");
        this.#child?.kill("SIGTERM");
        return;
      }
      if (line !== "") this.#handleLine(line);
      newline = this.#stdoutBuffer.indexOf("\n");
    }
  }

  #handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      this.#failAll("Codex App Server emitted malformed JavaScript Object Notation.");
      this.#child?.kill("SIGTERM");
      return;
    }
    if (!isRecord(parsed)) return;
    const message = parsed as ProtocolMessage;
    if (typeof message.id === "number" && this.#pending.has(message.id) && message.method === undefined) {
      const pending = this.#pending.get(message.id)!;
      clearTimeout(pending.timeout);
      this.#pending.delete(message.id);
      if (message.error !== undefined) pending.reject(new Error("Codex App Server returned a request error."));
      else pending.resolve(message.result);
      return;
    }
    if (typeof message.method !== "string") return;
    if (reasoningMessage(message.method, message.params)) return;
    if (isRequestId(message.id)) {
      this.#options.onServerRequest?.({ id: message.id, method: message.method, params: message.params });
      return;
    }
    this.#options.onNotification?.(message.method, message.params);
  }

  #failAll(message: string): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.#pending.clear();
  }
}
