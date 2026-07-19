import { buildEventChain, canonicalize, sha256, verifyEventChain } from "@flight-recorder/crypto";
import { evidenceEventSchema, jsonValueSchema, type EvidenceEvent } from "@flight-recorder/schema";
import { z } from "zod";

const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const DEFAULT_MAX_STRING_LENGTH = 8_000;
const DEFAULT_MAX_COLLECTION_LENGTH = 100;
const DEFAULT_MAX_DEPTH = 8;
const MAX_FINAL_ARTIFACT_COUNT = 25;
const MAX_FINAL_ARTIFACT_BYTES = 100_000;
const MAX_FINAL_ENVELOPE_BYTES = 1_000_000;

const secretKeyPattern = /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|refresh[-_]?token|secret|session[-_]?token|token)/iu;

const inlineSecretPatterns: readonly RegExp[] = [
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/giu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/gu,
  /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/gu,
  /\b(?:OPENAI_API_KEY|GITHUB_TOKEN|NPM_TOKEN|VERCEL_TOKEN)\s*=\s*[^\s]+/giu,
  /\b(?:api[-_]?key|authorization|password|private[-_]?key|secret|token)\s*[:=]\s*(?:"[^"]{12,}"|'[^']{12,}'|(?=[A-Za-z0-9._~+\/-]{12,}(?=$|[\s,;}\]]))(?=[A-Za-z0-9._~+\/-]*[0-9.~+\/-])[A-Za-z0-9._~+\/-]+)/gimu,
];

// Final artifact bytes are cryptographically bound and cannot be redacted without invalidating the snapshot.
// These deliberately high-confidence patterns therefore reject unsafe content before remote transmission.
const finalArtifactSecretPatterns: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/u,
  /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/u,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/iu,
  /\b(?:OPENAI_API_KEY|GITHUB_TOKEN|NPM_TOKEN|VERCEL_TOKEN)\s*=\s*["']?[^\s"']{12,}/iu,
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

export const reviewableExecCaptureSchema = z.object({
  source: z.literal("codex-exec-json"),
  testedCodexVersion: z.string().min(1),
  complete: z.literal(true),
  approvalCoverage: z.literal("not-observed"),
  issues: z.array(z.string()).length(0),
  events: z.array(evidenceEventSchema).min(1),
}).strict();

const repositoryRelativePathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((path) => {
    const segments = path.split("/");
    return (
      path === path.normalize("NFC") &&
      !path.startsWith("/") &&
      !path.startsWith("\\") &&
      !path.includes("\\") &&
      !path.includes("\u0000") &&
      !/^[a-zA-Z]:/u.test(path) &&
      segments.every((segment) =>
        segment !== "" &&
        segment !== "." &&
        segment !== ".." &&
        !/[. ]$/u.test(segment) &&
        !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(segment)
      )
    );
  }, "Final-state paths must be Unicode-normalised, portable repository-relative paths without traversal or reserved segments.");

export const finalArtifactSnapshotSchema = z.object({
  path: repositoryRelativePathSchema,
  mediaType: z.string().min(1).max(200),
  byteSize: z.number().int().nonnegative().max(MAX_FINAL_ARTIFACT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  content: z.string().max(MAX_FINAL_ARTIFACT_BYTES),
}).strict().superRefine((artifact, context) => {
  const actualByteSize = Buffer.byteLength(artifact.content, "utf8");
  if (actualByteSize > MAX_FINAL_ARTIFACT_BYTES) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["content"],
      message: `Final artifact content may contain at most ${MAX_FINAL_ARTIFACT_BYTES} UTF-8 bytes.`,
    });
  }
  if (artifact.byteSize !== actualByteSize) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["byteSize"],
      message: "Final artifact byte size does not match its content.",
    });
  }
  if (artifact.sha256 !== sha256(Buffer.from(artifact.content, "utf8"))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sha256"],
      message: "Final artifact Secure Hash Algorithm 256-bit digest does not match its content.",
    });
  }
});

export const finalStateEvidenceEnvelopeSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  recordKind: z.literal("final-git-state"),
  finalCommit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u),
  scopedClean: z.literal(true),
  scopePaths: z.array(repositoryRelativePathSchema).min(1).max(100),
  postCommitPassingTestEvidenceId: z.string().min(1).max(200),
  artifacts: z.array(finalArtifactSnapshotSchema).min(1).max(MAX_FINAL_ARTIFACT_COUNT),
}).strict().superRefine((envelope, context) => {
  const portableScopePaths = new Set<string>();
  for (const [index, path] of envelope.scopePaths.entries()) {
    const portablePath = path.toLocaleLowerCase("en-US");
    if (portableScopePaths.has(portablePath)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["scopePaths", index], message: "Final-state scope paths must be unique after portable case folding." });
    }
    portableScopePaths.add(portablePath);
  }

  const portableArtifactPaths = new Set<string>();
  let totalBytes = 0;
  for (const [index, artifact] of envelope.artifacts.entries()) {
    const portablePath = artifact.path.toLocaleLowerCase("en-US");
    if (portableArtifactPaths.has(portablePath)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "path"], message: "Final artifact paths must be unique after portable case folding." });
    }
    if (!portableScopePaths.has(portablePath)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "path"], message: "Every final artifact must be explicitly included in the scoped-clean path set." });
    }
    portableArtifactPaths.add(portablePath);
    totalBytes += artifact.byteSize;
  }
  if (totalBytes > MAX_FINAL_ENVELOPE_BYTES) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts"], message: `Final-state artifact content may contain at most ${MAX_FINAL_ENVELOPE_BYTES} UTF-8 bytes in total.` });
  }
});

export const humanSealApprovalPayloadSchema = z.object({
  recordKind: z.literal("human-seal-approval"),
  decision: z.literal("approved-for-sealing"),
  passportId: z.string().trim().min(1).max(200),
  repositoryCommit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u),
  evidenceDigestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  findingDecisionIds: z.array(z.string().trim().min(1).max(200)).max(1_000),
  acknowledgedNarrowClaim: z.literal(true),
  acknowledgedResidualLimitations: z.literal(true),
  reason: z.string().trim().min(1).max(4_000),
}).strict().superRefine((approval, context) => {
  if (new Set(approval.findingDecisionIds).size !== approval.findingDecisionIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["findingDecisionIds"],
      message: "Human seal approval finding decision identifiers must be unique.",
    });
  }
});

export type EvidenceDraft = z.infer<typeof evidenceDraftSchema>;
export type EvidenceDigest = z.infer<typeof evidenceDigestSchema>;
export type CaptureSource = z.infer<typeof captureSourceSchema>;
export type FinalArtifactSnapshot = z.infer<typeof finalArtifactSnapshotSchema>;
export type FinalStateEvidenceEnvelope = z.infer<typeof finalStateEvidenceEnvelopeSchema>;
export type HumanSealApprovalPayload = z.infer<typeof humanSealApprovalPayloadSchema>;

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

export function createFinalArtifactSnapshot(path: string, mediaType: string, content: string): FinalArtifactSnapshot {
  const bytes = Buffer.from(content, "utf8");
  return finalArtifactSnapshotSchema.parse({
    path,
    mediaType,
    byteSize: bytes.byteLength,
    sha256: sha256(bytes),
    content,
  });
}

function assertFinalArtifactsSafeForRemoteReview(envelope: FinalStateEvidenceEnvelope): void {
  for (const artifact of envelope.artifacts) {
    if (finalArtifactSecretPatterns.some((pattern) => pattern.test(artifact.content))) {
      throw new Error(`Final artifact ${artifact.path} contains a high-confidence secret pattern and cannot be transmitted for remote review.`);
    }
  }
}

export function assertFinalStateEvidenceEnvelope(input: unknown, events: readonly EvidenceEvent[]): FinalStateEvidenceEnvelope {
  const envelope = finalStateEvidenceEnvelopeSchema.parse(input);
  const safeEvents = events.map((event) => evidenceEventSchema.parse(event));
  if (!verifyEventChain(safeEvents)) {
    throw new Error("Final-state evidence must bind to a complete, valid event hash chain.");
  }
  const matchingTests = safeEvents.filter((event) => event.id === envelope.postCommitPassingTestEvidenceId);
  if (matchingTests.length !== 1) {
    throw new Error("Final-state evidence must bind exactly one post-commit test evidence identifier.");
  }

  const testEvent = matchingTests[0];
  if (
    testEvent === undefined ||
    testEvent.type !== "test" ||
    inferTestStatus(testEvent.payload) !== "passed" ||
    testEvent.payload.phase !== "post-commit" ||
    testEvent.payload.repositoryCommit !== envelope.finalCommit
  ) {
    throw new Error("Final-state evidence must bind a passing post-commit test from the same final Git commit.");
  }
  return envelope;
}

export function verifyFinalStateEvidenceEnvelope(input: unknown, events: readonly EvidenceEvent[]): boolean {
  try {
    assertFinalStateEvidenceEnvelope(input, events);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the only evidence prefix that GPT-5.6 is allowed to have reviewed.
 * A later human seal approval is independently hash-linked and signed, but is not
 * retroactively included in the model review digest that it acknowledges.
 */
export function getReviewedEventPrefix(events: readonly EvidenceEvent[]): EvidenceEvent[] {
  const safeEvents = events.map((event) => evidenceEventSchema.parse(event));
  if (!verifyEventChain(safeEvents)) {
    throw new Error("Reviewed evidence must contain a complete, valid event hash chain.");
  }
  if (new Set(safeEvents.map((event) => event.id)).size !== safeEvents.length) {
    throw new Error("Reviewed evidence event identifiers must be unique.");
  }

  const finalStateRecords = safeEvents.filter(
    (event) => event.type === "completion" && event.payload.recordKind === "final-git-state",
  );
  if (finalStateRecords.length !== 1) {
    throw new Error("Reviewed evidence must contain exactly one explicit final Git-state evidence record.");
  }
  const finalStateRecord = finalStateRecords[0];
  if (finalStateRecord === undefined) {
    throw new Error("Reviewed evidence is missing its final Git-state evidence record.");
  }

  const finalStateEnvelope = assertFinalStateEvidenceEnvelope(finalStateRecord.payload, safeEvents);
  const boundTest = safeEvents.find((event) => event.id === finalStateEnvelope.postCommitPassingTestEvidenceId);
  if (boundTest === undefined || boundTest.index >= finalStateRecord.index) {
    throw new Error("Reviewed evidence must record its bound post-commit passing test before its final Git-state evidence record.");
  }

  const tail = safeEvents.slice(finalStateRecord.index + 1);
  if (tail.length > 1) {
    throw new Error("Reviewed evidence may contain only one typed human seal approval after its final Git-state record.");
  }
  const approvalEvent = tail[0];
  if (approvalEvent !== undefined) {
    if (approvalEvent.type !== "approval") {
      throw new Error("Evidence after the final Git-state record must be a typed human seal approval.");
    }
    const approval = humanSealApprovalPayloadSchema.parse(approvalEvent.payload);
    if (approval.repositoryCommit !== finalStateEnvelope.finalCommit) {
      throw new Error("Human seal approval must reference the final Git-state repository commit.");
    }
  }

  return safeEvents.slice(0, finalStateRecord.index + 1);
}

function categoryFor(event: EvidenceEvent, events: readonly EvidenceEvent[]): EvidenceDigest["transmissionCategories"][number] | undefined {
  switch (event.type) {
    case "task": return "task-and-criteria";
    case "plan": return "plans";
    case "command":
    case "test": return "commands-and-tests";
    case "file-change": return "file-changes";
    case "approval": return "approvals";
    case "completion": {
      if (event.payload.recordKind !== "final-git-state") return undefined;
      const envelope = assertFinalStateEvidenceEnvelope(event.payload, events);
      const testEvent = events.find((candidate) => candidate.id === envelope.postCommitPassingTestEvidenceId);
      if (testEvent === undefined || testEvent.index >= event.index) {
        throw new Error("The final Git-state record must follow its bound post-commit passing test evidence.");
      }
      return "git-state";
    }
    case "review": return undefined;
  }
}

export function createEvidenceDigest(source: CaptureSource, events: readonly EvidenceEvent[]): EvidenceDigest {
  const safeEvents = events.map((event) => evidenceEventSchema.parse(event));
  const eventTypes: Record<string, number> = {};
  const categories = new Set<EvidenceDigest["transmissionCategories"][number]>();

  for (const event of safeEvents) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
    const category = categoryFor(event, safeEvents);
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

export function createReviewDigestFromExecCapture(input: unknown): EvidenceDigest {
  const capture = reviewableExecCaptureSchema.parse(input);
  if (!verifyEventChain(capture.events)) {
    throw new Error("A reviewable Codex capture must contain a complete, valid event hash chain.");
  }

  const reviewedEvents = getReviewedEventPrefix(capture.events);
  const finalStateRecord = reviewedEvents.at(-1);
  if (finalStateRecord === undefined || finalStateRecord.payload.recordKind !== "final-git-state") {
    throw new Error("A reviewable Codex capture is missing its authoritative final Git-state evidence record.");
  }
  const finalStateEnvelope = assertFinalStateEvidenceEnvelope(finalStateRecord.payload, reviewedEvents);
  assertFinalArtifactsSafeForRemoteReview(finalStateEnvelope);
  const boundTest = reviewedEvents.find((event) => event.id === finalStateEnvelope.postCommitPassingTestEvidenceId);
  if (boundTest === undefined || boundTest.index >= finalStateRecord.index) {
    throw new Error("A reviewable Codex capture must record its bound post-commit passing test before its final Git-state evidence record.");
  }

  const safeEvents = reviewedEvents.map((event) => evidenceEventSchema.parse({
    ...event,
    // Apply a second mandatory redaction boundary immediately before remote transmission.
    summary: sanitiseEvidenceValue(event.summary),
    // The validated final snapshot must remain byte-for-byte identical to its bound size and digest.
    payload: event.id === finalStateRecord.id ? finalStateEnvelope : sanitiseEvidenceValue(event.payload),
  }));
  return createEvidenceDigest(capture.source, safeEvents);
}
