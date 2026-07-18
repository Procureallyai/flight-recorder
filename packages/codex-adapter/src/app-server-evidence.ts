import { sha256 } from "@flight-recorder/crypto";
import { createEvidenceChain, sanitiseEvidenceValue, type EvidenceDraft } from "@flight-recorder/evidence";
import type { EvidenceEvent, JsonValue } from "@flight-recorder/schema";
import { isLikelyTestCommand } from "./test-command.js";

type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export interface AppServerEvidenceOptions {
  repositoryRoot?: string;
  recordedAt?: () => string;
  additionalTestCommandPatterns?: readonly RegExp[];
}

export interface AppServerCaptureResult {
  source: "codex-app-server";
  complete: boolean;
  approvalCoverage: "observed" | "not-observed";
  issues: string[];
  events: EvidenceEvent[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) if (typeof record[key] === "string") return record[key];
  return undefined;
}

function numberValue(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) if (typeof record[key] === "number" && Number.isFinite(record[key])) return record[key];
  return undefined;
}

function pseudonymousReference(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? `sha256:${sha256(value)}` : undefined;
}

function replaceRepositoryPaths(value: unknown, repositoryRoot?: string): unknown {
  if (repositoryRoot === undefined) return value;
  if (typeof value === "string") return value.replaceAll(repositoryRoot, "<repository>").replaceAll(encodeURI(repositoryRoot), "<repository>");
  if (Array.isArray(value)) return value.map((entry) => replaceRepositoryPaths(entry, repositoryRoot));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceRepositoryPaths(entry, repositoryRoot)]));
  return value;
}

function safeRecord(value: unknown, repositoryRoot?: string): Record<string, JsonValue> {
  const safe = sanitiseEvidenceValue(replaceRepositoryPaths(value, repositoryRoot));
  return isRecord(safe) ? safe as Record<string, JsonValue> : { value: String(safe) };
}

function timestampFromMilliseconds(value: unknown, fallback: () => string): string {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : fallback();
}

export class AppServerEvidenceRecorder {
  readonly #options: AppServerEvidenceOptions;
  readonly #drafts: EvidenceDraft[] = [];
  readonly #issues: string[] = [];
  readonly #approvalRequests = new Map<string, string>();
  readonly #pendingApprovalRequests = new Set<string>();
  #terminalSeen = false;
  #terminalSuccessful = false;

  constructor(options: AppServerEvidenceOptions = {}) {
    this.#options = options;
  }

  recordTask(task: string, acceptanceCriteria: readonly string[] = []): void {
    this.#push("task", "The requested task and acceptance criteria were recorded before execution.", { task, acceptanceCriteria });
  }

  recordNotification(method: string, params: unknown): void {
    if (method.includes("reasoning") || method === "rawResponseItem/completed") return;
    if (!isRecord(params)) return;

    if (method === "turn/started") {
      if (!isRecord(params.turn) || typeof params.threadId !== "string" || typeof params.turn.id !== "string") {
        this.#issues.push("A turn/started notification was missing required protocol fields.");
        return;
      }
      this.#push("task", "A Codex App Server turn started.", {
        threadReference: pseudonymousReference(params.threadId),
        turnReference: pseudonymousReference(params.turn.id),
      });
      return;
    }
    if (method === "turn/plan/updated") {
      if (!Array.isArray(params.plan) || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
        this.#issues.push("A turn/plan/updated notification was missing required protocol fields.");
        return;
      }
      this.#push("plan", "The authoritative Codex plan state changed.", { plan: params.plan, explanation: params.explanation }, params.startedAtMs);
      return;
    }
    if (method === "item/completed") {
      this.#recordCompletedItem(params);
      return;
    }
    if (method === "turn/completed") {
      const turn = isRecord(params.turn) ? params.turn : {};
      if (this.#terminalSeen) {
        this.#issues.push("App Server emitted more than one terminal turn event.");
        return;
      }
      if (typeof params.threadId !== "string" || typeof turn.id !== "string" || !Array.isArray(turn.items) || typeof turn.status !== "string") {
        this.#issues.push("A turn/completed notification was missing required protocol fields.");
        return;
      }
      const status = stringValue(turn, "status") ?? "unknown";
      this.#terminalSeen = true;
      this.#terminalSuccessful = status === "completed";
      if (!this.#terminalSuccessful) this.#issues.push(`App Server turn completed with status: ${status}.`);
      this.#push("completion", "The Codex App Server turn reached a terminal state.", {
        status,
        durationMs: numberValue(turn, "durationMs"),
        turnReference: pseudonymousReference(turn.id),
        errorPresent: turn.error !== null && turn.error !== undefined,
      }, typeof turn.completedAt === "number" ? turn.completedAt * 1_000 : undefined);
    }
  }

  recordApprovalRequest(requestId: string | number, method: string, params: unknown): void {
    if (!["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "item/permissions/requestApproval"].includes(method)) return;
    const record = isRecord(params) ? params : {};
    if (typeof record.itemId !== "string" || typeof record.threadId !== "string" || typeof record.turnId !== "string" || typeof record.startedAtMs !== "number") {
      this.#issues.push("An approval request was missing required protocol fields.");
      return;
    }
    const requestReference = `sha256:${sha256(String(requestId))}`;
    this.#approvalRequests.set(String(requestId), requestReference);
    this.#pendingApprovalRequests.add(String(requestId));
    if (method === "item/permissions/requestApproval") {
      this.#issues.push("Permission approval responses are not supported by the current typed client.");
    }
    this.#push("approval", "Codex requested an explicit operator approval.", {
      requestReference,
      method,
      itemReference: pseudonymousReference(record.itemId),
      command: stringValue(record, "command"),
      cwd: stringValue(record, "cwd"),
      reason: stringValue(record, "reason"),
      decision: "pending",
    }, record.startedAtMs);
  }

  recordApprovalDecision(requestId: string | number, decision: ApprovalDecision): void {
    const requestReference = this.#approvalRequests.get(String(requestId));
    if (requestReference === undefined) {
      this.#issues.push("An approval decision did not match a recorded approval request.");
      return;
    }
    this.#pendingApprovalRequests.delete(String(requestId));
    this.#push("approval", "The operator recorded an explicit approval decision.", { requestReference, decision });
  }

  finish(): AppServerCaptureResult {
    const finalIssues = [...this.#issues];
    if (!this.#terminalSeen) finalIssues.push("App Server capture ended without a terminal turn event.");
    if (this.#pendingApprovalRequests.size > 0) finalIssues.push("App Server capture ended with unresolved approval requests.");
    return {
      source: "codex-app-server",
      complete: this.#terminalSeen && this.#terminalSuccessful && finalIssues.length === 0,
      approvalCoverage: this.#approvalRequests.size > 0 ? "observed" : "not-observed",
      issues: finalIssues,
      events: createEvidenceChain(this.#drafts),
    };
  }

  #recordCompletedItem(params: Record<string, unknown>): void {
    const item = isRecord(params.item) ? params.item : undefined;
    if (item === undefined || typeof params.completedAtMs !== "number" || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
      this.#issues.push("An item/completed notification was missing required protocol fields.");
      return;
    }
    const itemType = stringValue(item, "type") ?? "unknown";
    if (itemType === "reasoning") return;
    const sourceReference = pseudonymousReference(item.id);
    const recordedAt = params.completedAtMs;

    if (["userMessage", "hookPrompt", "contextCompaction", "enteredReviewMode", "exitedReviewMode", "imageView", "sleep"].includes(itemType)) return;

    if (itemType === "commandExecution") {
      const command = stringValue(item, "command") ?? "[command unavailable]";
      const isTest = isLikelyTestCommand(command, this.#options.additionalTestCommandPatterns);
      this.#push(isTest ? "test" : "command", isTest ? "A recognised test command completed." : "A command execution completed.", {
        command,
        cwd: stringValue(item, "cwd") ?? ".",
        status: stringValue(item, "status") ?? "unknown",
        exitCode: numberValue(item, "exitCode"),
        durationMs: numberValue(item, "durationMs"),
        output: stringValue(item, "aggregatedOutput"),
        sourceReference,
      }, recordedAt);
      return;
    }
    if (itemType === "fileChange") {
      this.#push("file-change", "A file change completed.", { status: stringValue(item, "status") ?? "unknown", changes: item.changes, sourceReference }, recordedAt);
      return;
    }
    if (itemType === "plan") {
      this.#push("plan", "A Codex plan item completed.", { text: stringValue(item, "text"), sourceReference }, recordedAt);
      return;
    }
    if (itemType === "agentMessage") {
      this.#push("completion", "Codex completed an observable agent message.", { text: stringValue(item, "text"), phase: stringValue(item, "phase"), sourceReference }, recordedAt);
      return;
    }
    if (["mcpToolCall", "dynamicToolCall", "collabAgentToolCall", "webSearch"].includes(itemType)) {
      this.#push("command", "A tool call completed; only safe metadata was retained.", {
        itemType,
        tool: stringValue(item, "tool", "server"),
        status: stringValue(item, "status"),
        sourceReference,
      }, recordedAt);
      return;
    }
    this.#issues.push(`App Server emitted an unsupported completed item type: ${itemType}.`);
  }

  #push(type: EvidenceDraft["type"], summary: string, payload: unknown, timestampMs?: unknown): void {
    const now = this.#options.recordedAt ?? (() => new Date().toISOString());
    this.#drafts.push({
      id: `ev_${String(this.#drafts.length + 1).padStart(6, "0")}`,
      recordedAt: timestampFromMilliseconds(timestampMs, now),
      type,
      summary,
      payload: safeRecord(payload, this.#options.repositoryRoot),
    });
  }
}
