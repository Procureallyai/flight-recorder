import { sha256 } from "@flight-recorder/crypto";
import { createEvidenceChain, sanitiseEvidenceValue, type EvidenceDraft } from "@flight-recorder/evidence";
import type { EvidenceEvent, JsonValue } from "@flight-recorder/schema";

const DEFAULT_MAX_LINE_BYTES = 1_000_000;
const DEFAULT_MAX_TOTAL_BYTES = 25_000_000;
const TEST_COMMAND_PATTERN = /(?:^|\s)(?:pnpm|npm|yarn|bun|pytest|python\s+-m\s+pytest|cargo\s+test|go\s+test|dotnet\s+test)(?:\s|$)/u;

export interface ExecInvocation {
  executable: string;
  args: string[];
  stdin: string;
}

export interface ImportOptions {
  testedCodexVersion: string;
  recordedAt?: () => string;
  maxLineBytes?: number;
  maxTotalBytes?: number;
}

export interface CaptureImportResult {
  source: "codex-exec-json";
  testedCodexVersion: string;
  complete: boolean;
  approvalCoverage: "not-observed";
  issues: string[];
  events: EvidenceEvent[];
}

export function buildExecInvocation(repositoryPath: string, prompt: string, executable = "codex"): ExecInvocation {
  return {
    executable,
    args: [
      "exec",
      "--json",
      "--color", "never",
      "--sandbox", "workspace-write",
      "--ask-for-approval", "never",
      "--cd", repositoryPath,
      "-",
    ],
    stdin: prompt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}

function getNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    if (typeof record[key] === "number" && Number.isFinite(record[key])) return record[key];
  }
  return undefined;
}

function pseudonymousReference(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? `sha256:${sha256(value)}` : undefined;
}

function safeRecord(value: unknown): Record<string, JsonValue> {
  const sanitised = sanitiseEvidenceValue(value);
  return isRecord(sanitised) ? sanitised as Record<string, JsonValue> : { value: String(sanitised) };
}

function itemRecord(envelope: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(envelope.item) ? envelope.item : isRecord(envelope.payload) && isRecord(envelope.payload.item) ? envelope.payload.item : undefined;
}

function eventTimestamp(envelope: Record<string, unknown>, now: () => string): string {
  const candidate = getString(envelope, "timestamp", "created_at", "createdAt", "recordedAt");
  return candidate !== undefined && !Number.isNaN(Date.parse(candidate)) ? new Date(candidate).toISOString() : now();
}

function commandPayload(item: Record<string, unknown>): Record<string, JsonValue> {
  const command = getString(item, "command", "cmd") ?? "[command unavailable]";
  return safeRecord({
    command,
    cwd: getString(item, "cwd", "working_directory", "workingDirectory") ?? ".",
    status: getString(item, "status") ?? "unknown",
    exitCode: getNumber(item, "exit_code", "exitCode"),
    durationMs: getNumber(item, "duration_ms", "durationMs"),
    output: getString(item, "aggregated_output", "output", "stdout"),
  });
}

function mapCompletedItem(envelope: Record<string, unknown>, draftBase: Pick<EvidenceDraft, "id" | "recordedAt">): EvidenceDraft | undefined {
  const item = itemRecord(envelope);
  if (item === undefined) return undefined;
  const itemType = getString(item, "type") ?? "unknown";
  if (itemType === "reasoning") return undefined;

  const sourceReference = pseudonymousReference(item.id);
  if (itemType === "command_execution" || itemType === "commandExecution") {
    const payload = commandPayload(item);
    const command = typeof payload.command === "string" ? payload.command : "[command unavailable]";
    return {
      ...draftBase,
      type: TEST_COMMAND_PATTERN.test(command) ? "test" : "command",
      summary: TEST_COMMAND_PATTERN.test(command) ? "A recognised test command completed." : "A command execution completed.",
      payload: { ...payload, sourceReference: sourceReference ?? null },
    };
  }
  if (itemType === "file_change" || itemType === "fileChange") {
    return {
      ...draftBase,
      type: "file-change",
      summary: "A file change completed.",
      payload: safeRecord({
        status: getString(item, "status") ?? "unknown",
        changes: item.changes,
        patch: getString(item, "patch", "diff"),
        sourceReference,
      }),
    };
  }
  if (itemType === "todo_list" || itemType === "plan") {
    return { ...draftBase, type: "plan", summary: "The authoritative plan state changed.", payload: safeRecord({ items: item.items, sourceReference }) };
  }
  if (itemType === "agent_message" || itemType === "agentMessage") {
    return {
      ...draftBase,
      type: "completion",
      summary: "Codex completed an observable agent message.",
      payload: safeRecord({ text: getString(item, "text", "message"), sourceReference }),
    };
  }
  if (["mcp_tool_call", "mcpToolCall", "dynamic_tool_call", "dynamicToolCall", "collab_tool_call", "collabToolCall", "web_search"].includes(itemType)) {
    return {
      ...draftBase,
      type: "command",
      summary: "A tool call completed; only safe metadata was retained.",
      payload: safeRecord({ itemType, tool: getString(item, "tool", "name", "server"), status: getString(item, "status"), sourceReference }),
    };
  }

  return {
    ...draftBase,
    type: "completion",
    summary: "An unknown completed item was retained as envelope metadata only.",
    payload: safeRecord({ itemType, sourceReference, topLevelKeys: Object.keys(item).sort() }),
  };
}

export function importExecJsonLines(lines: readonly string[], options: ImportOptions): CaptureImportResult {
  const maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const now = options.recordedAt ?? (() => new Date().toISOString());
  const issues: string[] = [];
  const drafts: EvidenceDraft[] = [];
  let totalBytes = 0;
  let terminalSeen = false;

  for (const [lineIndex, line] of lines.entries()) {
    const lineBytes = Buffer.byteLength(line, "utf8");
    totalBytes += lineBytes;
    if (lineBytes > maxLineBytes || totalBytes > maxTotalBytes) {
      issues.push(lineBytes > maxLineBytes ? `Line ${lineIndex + 1} exceeded the capture limit.` : "Capture exceeded the total size limit.");
      break;
    }
    if (line.trim() === "") continue;

    let envelope: unknown;
    try {
      envelope = JSON.parse(line) as unknown;
    } catch {
      issues.push(`Line ${lineIndex + 1} was not valid JSON.`);
      continue;
    }
    if (!isRecord(envelope)) {
      issues.push(`Line ${lineIndex + 1} was not a JSON object.`);
      continue;
    }

    const envelopeType = getString(envelope, "type") ?? "unknown";
    const draftBase = { id: `ev_${String(drafts.length + 1).padStart(6, "0")}`, recordedAt: eventTimestamp(envelope, now) };
    if (envelopeType === "item.completed") {
      const draft = mapCompletedItem(envelope, draftBase);
      if (draft !== undefined) drafts.push(draft);
      continue;
    }
    if (envelopeType === "item.started" || envelopeType === "item.updated") {
      if (getString(itemRecord(envelope) ?? {}, "type") === "reasoning") continue;
      continue;
    }
    if (envelopeType === "thread.started") {
      drafts.push({ ...draftBase, type: "task", summary: "A non-interactive Codex capture thread started.", payload: safeRecord({ threadReference: pseudonymousReference(envelope.thread_id ?? envelope.threadId) }) });
      continue;
    }
    if (envelopeType === "turn.started") {
      drafts.push({ ...draftBase, type: "task", summary: "A Codex turn started.", payload: safeRecord({ turnReference: pseudonymousReference(envelope.turn_id ?? envelope.turnId) }) });
      continue;
    }
    if (envelopeType === "turn.completed") {
      terminalSeen = true;
      drafts.push({ ...draftBase, type: "completion", summary: "The Codex turn completed.", payload: safeRecord({ usage: envelope.usage, status: "completed" }) });
      continue;
    }
    if (envelopeType === "turn.failed" || envelopeType === "error") {
      terminalSeen = true;
      issues.push(`Capture reported terminal event: ${envelopeType}.`);
      drafts.push({ ...draftBase, type: "completion", summary: "The Codex capture failed.", payload: safeRecord({ status: "failed", message: envelope.message ?? envelope.error }) });
      continue;
    }

    drafts.push({
      ...draftBase,
      type: "completion",
      summary: "An unknown event was retained as envelope metadata only.",
      payload: safeRecord({ envelopeType, lineSha256: sha256(line), topLevelKeys: Object.keys(envelope).sort() }),
    });
  }

  if (!terminalSeen) issues.push("Capture ended without a terminal turn event.");
  return {
    source: "codex-exec-json",
    testedCodexVersion: options.testedCodexVersion,
    complete: terminalSeen && issues.length === 0,
    approvalCoverage: "not-observed",
    issues,
    events: createEvidenceChain(drafts),
  };
}
