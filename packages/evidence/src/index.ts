import { buildEventChain, canonicalize, sha256 } from "@flight-recorder/crypto";
import { evidenceEventSchema, jsonValueSchema, type EvidenceEvent } from "@flight-recorder/schema";
import { z } from "zod";

const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const DEFAULT_MAX_STRING_LENGTH = 8_000;
const DEFAULT_MAX_COLLECTION_LENGTH = 100;
const DEFAULT_MAX_DEPTH = 8;

const secretKeyPattern = /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|refresh[-_]?token|secret|session[-_]?token|token)/iu;

const inlineSecretPatterns: readonly RegExp[] = [
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/giu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/gu,
  /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/gu,
  /\b(?:OPENAI_API_KEY|GITHUB_TOKEN|NPM_TOKEN|VERCEL_TOKEN)\s*=\s*[^\s]+/giu,
  /\b(?:api[-_]?key|authorization|password|private[-_]?key|secret|token)\s*[:=]\s*(?:"[^"]{12,}"|'[^']{12,}'|[A-Za-z0-9._~+\/-]{12,})/giu,
];

export const captureSourceSchema = z.enum(["codex-app-server", "codex-exec-json", "fixture"]);

export const evidenceDraftSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime({ offset: true }),
  type: evidenceEventSchema.shape.type,
  summary: z.string().min(1),
  payload: z.record(jsonValueSchema),
});

export const evidenceDigestSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  source: captureSourceSchema,
  eventCount: z.number().int().nonnegative(),
  eventTypes: z.record(z.number().int().nonnegative()),
  testResults: z.array(z.object({
    evidenceId: z.string().min(1),
    status: z.enum(["passed", "failed", "unknown"]),
    command: z.string().min(1).optional(),
  })),
  evidence: z.array(z.object({
    evidenceId: z.string().min(1),
    type: evidenceEventSchema.shape.type,
    summary: z.string().min(1),
    payload: z.record(jsonValueSchema),
  })),
  transmissionCategories: z.array(z.enum([
    "task-and-criteria",
    "plans",
    "commands-and-tests",
    "file-changes",
    "approvals",
    "git-state",
  ])),
  inputDigestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

export type EvidenceDraft = z.infer<typeof evidenceDraftSchema>;
export type EvidenceDigest = z.infer<typeof evidenceDigestSchema>;
export type CaptureSource = z.infer<typeof captureSourceSchema>;

export interface SanitiseOptions {
  maxStringLength?: number;
  maxCollectionLength?: number;
  maxDepth?: number;
}

function redactInlineSecrets(value: string): string {
  let redacted = value;
  for (const pattern of inlineSecretPatterns) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  return redacted;
}

function boundString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n${TRUNCATED}`;
}

export function sanitiseEvidenceValue(value: unknown, options: SanitiseOptions = {}, depth = 0): unknown {
  const maxStringLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const maxCollectionLength = options.maxCollectionLength ?? DEFAULT_MAX_COLLECTION_LENGTH;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  if (depth > maxDepth) {
    return "[MAX_DEPTH]";
  }

  if (typeof value === "string") {
    return boundString(redactInlineSecrets(value), maxStringLength);
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (Array.isArray(value)) {
    const bounded = value.slice(0, maxCollectionLength).map((entry) => sanitiseEvidenceValue(entry, options, depth + 1));
    return value.length > bounded.length ? [...bounded, TRUNCATED] : bounded;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, maxCollectionLength);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      if (entry === undefined) continue;
      // Secret-bearing fields are replaced wholesale so short or unfamiliar token formats do not evade pattern matching.
      result[key] = secretKeyPattern.test(key) ? REDACTED : sanitiseEvidenceValue(entry, options, depth + 1);
    }
    if (Object.keys(value).length > entries.length) {
      result.__truncated__ = true;
    }
    return result;
  }

  return `[UNSUPPORTED_${typeof value}]`;
}

export function createEvidenceChain(drafts: readonly EvidenceDraft[]): EvidenceEvent[] {
  const validated = drafts.map((draft) => evidenceDraftSchema.parse({
    ...draft,
    summary: sanitiseEvidenceValue(draft.summary),
    payload: sanitiseEvidenceValue(draft.payload),
  }));

  return buildEventChain(validated);
}

function inferTestStatus(payload: Record<string, unknown>): "passed" | "failed" | "unknown" {
  if (payload.exitCode === 0 || payload.status === "passed") {
    return "passed";
  }
  if (typeof payload.exitCode === "number" || payload.status === "failed") {
    return "failed";
  }
  return "unknown";
}

function categoryFor(event: EvidenceEvent): EvidenceDigest["transmissionCategories"][number] | undefined {
  switch (event.type) {
    case "task": return "task-and-criteria";
    case "plan": return "plans";
    case "command":
    case "test": return "commands-and-tests";
    case "file-change": return "file-changes";
    case "approval": return "approvals";
    case "completion": return "git-state";
    case "review": return undefined;
  }
}

export function createEvidenceDigest(source: CaptureSource, events: readonly EvidenceEvent[]): EvidenceDigest {
  const safeEvents = events.map((event) => evidenceEventSchema.parse(event));
  const eventTypes: Record<string, number> = {};
  const categories = new Set<EvidenceDigest["transmissionCategories"][number]>();

  for (const event of safeEvents) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
    const category = categoryFor(event);
    if (category !== undefined) {
      categories.add(category);
    }
  }

  const digestWithoutHash = {
    schemaVersion: "0.1.0" as const,
    source,
    eventCount: safeEvents.length,
    eventTypes,
    testResults: safeEvents
      .filter((event) => event.type === "test")
      .map((event) => ({
        evidenceId: event.id,
        status: inferTestStatus(event.payload),
        ...(typeof event.payload.command === "string" ? { command: event.payload.command } : {}),
      })),
    evidence: safeEvents.map((event) => ({
      evidenceId: event.id,
      type: event.type,
      summary: event.summary,
      payload: event.payload,
    })),
    transmissionCategories: [...categories].sort(),
  };

  return evidenceDigestSchema.parse({
    ...digestWithoutHash,
    inputDigestSha256: sha256(canonicalize(digestWithoutHash)),
  });
}
