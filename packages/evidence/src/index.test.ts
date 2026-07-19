import { describe, expect, it } from "vitest";
import { buildEventChain } from "@flight-recorder/crypto";
import {
  createEvidenceChain,
  createEvidenceDigest,
  createFinalArtifactSnapshot,
  createReviewDigestFromExecCapture,
  finalStateEvidenceEnvelopeSchema,
  getReviewedEventPrefix,
  sanitiseEvidenceValue,
  verifyFinalStateEvidenceEnvelope,
} from "./index.js";

const FINAL_COMMIT = "a".repeat(40);

function createBoundFinalStateEvents() {
  const artifact = createFinalArtifactSnapshot(
    "src/password-reset.ts",
    "text/typescript",
    "export const syntheticReset = true;\n",
  );
  const envelope = finalStateEvidenceEnvelopeSchema.parse({
    schemaVersion: "0.1.0",
    recordKind: "final-git-state",
    finalCommit: FINAL_COMMIT,
    scopedClean: true,
    scopePaths: [artifact.path],
    postCommitPassingTestEvidenceId: "ev_post_commit_test",
    artifacts: [artifact],
  });
  const events = createEvidenceChain([
    {
      id: "ev_post_commit_test",
      recordedAt: "2026-07-19T10:00:00.000Z",
      type: "test",
      summary: "Final scoped tests passed after commit",
      payload: { command: "npm test", exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
    },
    {
      id: "ev_final_git_state",
      recordedAt: "2026-07-19T10:01:00.000Z",
      type: "completion",
      summary: "Final Git state recorded",
      payload: envelope,
    },
  ]);
  return { artifact, envelope, events };
}

describe("evidence sanitisation", () => {
  it("redacts named secret fields and inline credentials before hashing", () => {
    const safe = sanitiseEvidenceValue({
      authorization: "Bearer secret-value",
      output: "OPENAI_API_KEY=sk-examplevalue123456789",
      nested: { password: "correct horse battery staple" },
    });

    expect(JSON.stringify(safe)).not.toContain("secret-value");
    expect(JSON.stringify(safe)).not.toContain("sk-examplevalue");
    expect(JSON.stringify(safe)).not.toContain("correct horse");
  });

  it("bounds untrusted output and nested collections", () => {
    const safe = sanitiseEvidenceValue({ output: "a".repeat(50), values: [1, 2, 3] }, {
      maxStringLength: 10,
      maxCollectionLength: 2,
    });
    expect(safe).toEqual({ output: "aaaaaaaaaa\n[TRUNCATED]", values: [1, 2, "[TRUNCATED]"] });
  });

  it("preserves source expressions while redacting literal secret assignments", () => {
    const source = "const token = dependencies.tokenStore.issue(account.id);";
    expect(sanitiseEvidenceValue(source)).toBe(source);
    expect(sanitiseEvidenceValue("deliveries.push({ accountId, token: SYNTHETIC_TOKEN });")).toBe(
      "deliveries.push({ accountId, token: SYNTHETIC_TOKEN });",
    );
    expect(sanitiseEvidenceValue("token=unsafe-example-token-value")).toBe("[REDACTED]");
  });
});

describe("evidence digest", () => {
  it("creates stable, redacted evidence references and transmission categories", () => {
    const events = createEvidenceChain([
      {
        id: "ev_task",
        recordedAt: "2026-07-18T12:00:00.000Z",
        type: "task",
        summary: "Implement reset flow",
        payload: { acceptanceCriteria: ["Do not expose accounts"] },
      },
      {
        id: "ev_test",
        recordedAt: "2026-07-18T12:01:00.000Z",
        type: "test",
        summary: "Test command completed",
        payload: { command: "pnpm test", exitCode: 0, output: "token=unsafe-example-token-value" },
      },
    ]);

    const first = createEvidenceDigest("fixture", events);
    const second = createEvidenceDigest("fixture", events);
    expect(first).toEqual(second);
    expect(first.testResults).toEqual([{ evidenceId: "ev_test", status: "passed", command: "pnpm test" }]);
    expect(first.transmissionCategories).toEqual(["commands-and-tests", "task-and-criteria"]);
    expect(JSON.stringify(first)).not.toContain("unsafe-example-token-value");
  });

  it("rejects incomplete or tampered captures before review", () => {
    const events = createEvidenceChain([{
      id: "ev_task",
      recordedAt: "2026-07-18T12:00:00.000Z",
      type: "task",
      summary: "Implement reset flow",
      payload: {},
    }]);
    const base = {
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events,
    } as const;

    expect(() => createReviewDigestFromExecCapture({ ...base, complete: false })).toThrow();
    expect(() => createReviewDigestFromExecCapture({ ...base, source: "fixture" })).toThrow();
    expect(() => createReviewDigestFromExecCapture({ ...base, issues: ["missing terminal event"] })).toThrow();
    expect(() => createReviewDigestFromExecCapture({
      ...base,
      events: [{ ...events[0]!, summary: "Tampered" }],
    })).toThrow("valid event hash chain");
  });

  it("rejects genuine review captures with missing or duplicate final-state envelopes", () => {
    const { envelope } = createBoundFinalStateEvents();
    const base = {
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
    } as const;
    const missingFinalState = createEvidenceChain([{
      id: "ev_post_commit_test",
      recordedAt: "2026-07-19T10:00:00.000Z",
      type: "test",
      summary: "Final scoped tests passed after commit",
      payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
    }]);
    expect(() => createReviewDigestFromExecCapture({ ...base, events: missingFinalState })).toThrow("exactly one explicit final Git-state");

    const duplicateFinalState = createEvidenceChain([
      {
        id: "ev_post_commit_test",
        recordedAt: "2026-07-19T10:00:00.000Z",
        type: "test",
        summary: "Final scoped tests passed after commit",
        payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
      },
      {
        id: "ev_final_git_state_one",
        recordedAt: "2026-07-19T10:01:00.000Z",
        type: "completion",
        summary: "Final Git state recorded",
        payload: envelope,
      },
      {
        id: "ev_final_git_state_two",
        recordedAt: "2026-07-19T10:02:00.000Z",
        type: "completion",
        summary: "Duplicate final Git state recorded",
        payload: envelope,
      },
    ]);
    expect(() => createReviewDigestFromExecCapture({ ...base, events: duplicateFinalState })).toThrow("exactly one explicit final Git-state");
  });

  it("allows one typed human approval after review while rejecting an arbitrary tail", () => {
    const { envelope } = createBoundFinalStateEvents();
    const baseDrafts = [
      {
        id: "ev_post_commit_test",
        recordedAt: "2026-07-19T10:00:00.000Z",
        type: "test",
        summary: "Final scoped tests passed after commit",
        payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
      },
      {
        id: "ev_final_git_state",
        recordedAt: "2026-07-19T10:01:00.000Z",
        type: "completion",
        summary: "Final Git state recorded",
        payload: envelope,
      },
    ] as const;
    const approvedEvents = createEvidenceChain([
      ...baseDrafts,
      {
        id: "ev_human_seal_approval",
        recordedAt: "2026-07-19T10:02:00.000Z",
        type: "approval",
        summary: "Human approved the reviewed evidence for sealing",
        payload: {
          recordKind: "human-seal-approval",
          decision: "approved-for-sealing",
          passportId: "passport-genuine-001",
          repositoryCommit: FINAL_COMMIT,
          evidenceDigestSha256: "b".repeat(64),
          findingDecisionIds: [],
          acknowledgedNarrowClaim: true,
          acknowledgedResidualLimitations: true,
          reason: "The bounded claim and residual limitations were reviewed.",
        },
      },
    ]);
    const reviewedPrefix = getReviewedEventPrefix(approvedEvents);
    expect(reviewedPrefix.map((event) => event.id)).toEqual(["ev_post_commit_test", "ev_final_git_state"]);
    const digest = createReviewDigestFromExecCapture({
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events: approvedEvents,
    });
    expect(digest.eventCount).toBe(2);
    expect(digest.transmissionCategories).not.toContain("approvals");

    const arbitraryTail = createEvidenceChain([
      ...baseDrafts,
      {
        id: "ev_late_plan",
        recordedAt: "2026-07-19T10:02:00.000Z",
        type: "plan",
        summary: "Unexpected evidence after finalisation",
        payload: {},
      },
    ]);

    expect(() => createReviewDigestFromExecCapture({
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events: arbitraryTail,
    })).toThrow("must be a typed human seal approval");
  });

  it("reapplies redaction immediately before creating a remote review digest", () => {
    const { envelope } = createBoundFinalStateEvents();
    const events = createEvidenceChain([
      {
        id: "ev_command",
        recordedAt: "2026-07-18T12:00:00.000Z",
        type: "command",
        summary: "Synthetic credential leaked after import: sk-examplevalue123456789",
        payload: { output: "Authorization: Bearer synthetic-secret-value" },
      },
      {
        id: "ev_post_commit_test",
        recordedAt: "2026-07-19T10:00:00.000Z",
        type: "test",
        summary: "Final scoped tests passed after commit",
        payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
      },
      {
        id: "ev_final_git_state",
        recordedAt: "2026-07-19T10:01:00.000Z",
        type: "completion",
        summary: "Final Git state recorded",
        payload: envelope,
      },
    ]);
    const digest = createReviewDigestFromExecCapture({
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events,
    });

    expect(JSON.stringify(digest)).not.toContain("sk-examplevalue");
    expect(JSON.stringify(digest)).not.toContain("synthetic-secret-value");
  });

  it("preserves validated final artifact bytes while rejecting high-confidence secrets", () => {
    const safeSource = "const token = dependencies.tokenStore.issue(account.id);\n";
    const artifact = createFinalArtifactSnapshot("src/password-reset.ts", "text/typescript", safeSource);
    const envelope = finalStateEvidenceEnvelopeSchema.parse({
      schemaVersion: "0.1.0",
      recordKind: "final-git-state",
      finalCommit: FINAL_COMMIT,
      scopedClean: true,
      scopePaths: [artifact.path],
      postCommitPassingTestEvidenceId: "ev_post_commit_test",
      artifacts: [artifact],
    });
    const createCapture = (finalEnvelope: typeof envelope, preserveRawPayload = false) => ({
      source: "codex-exec-json" as const,
      testedCodexVersion: "codex-cli synthetic-version",
      complete: true as const,
      approvalCoverage: "not-observed" as const,
      issues: [],
      events: (preserveRawPayload ? buildEventChain : createEvidenceChain)([
        {
          id: "ev_post_commit_test",
          recordedAt: "2026-07-19T10:00:00.000Z",
          type: "test" as const,
          summary: "Final scoped tests passed after commit",
          payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
        },
        {
          id: "ev_final_git_state",
          recordedAt: "2026-07-19T10:01:00.000Z",
          type: "completion" as const,
          summary: "Final Git state recorded",
          payload: finalEnvelope,
        },
      ]),
    });

    const digest = createReviewDigestFromExecCapture(createCapture(envelope));
    const finalEvidence = digest.evidence.at(-1);
    expect(finalEvidence?.payload).toEqual(envelope);
    expect((finalEvidence?.payload.artifacts as Array<{ content: string }>)[0]?.content).toBe(safeSource);

    const unsafeArtifact = createFinalArtifactSnapshot(
      "src/password-reset.ts",
      "text/typescript",
      `export const key = "${["sk", "1234567890abcdef1234567890abcdef"].join("-")}";\n`,
    );
    const unsafeEnvelope = finalStateEvidenceEnvelopeSchema.parse({
      ...envelope,
      scopePaths: [unsafeArtifact.path],
      artifacts: [unsafeArtifact],
    });
    expect(() => createReviewDigestFromExecCapture(createCapture(unsafeEnvelope, true))).toThrow(
      "contains a high-confidence secret pattern",
    );
  });

  it("binds bounded final artifacts, a scoped-clean commit, and a post-commit passing test", () => {
    const { artifact, envelope, events } = createBoundFinalStateEvents();

    expect(artifact.byteSize).toBe(Buffer.byteLength(artifact.content, "utf8"));
    expect(verifyFinalStateEvidenceEnvelope(envelope, events)).toBe(true);
    expect(createEvidenceDigest("fixture", events).transmissionCategories).toEqual(["commands-and-tests", "git-state"]);
  });

  it("rejects missing, mismatched, or unbound final-state evidence", () => {
    const { artifact, envelope, events } = createBoundFinalStateEvents();

    expect(() => finalStateEvidenceEnvelopeSchema.parse({ ...envelope, artifacts: [{ ...artifact, content: `${artifact.content}changed` }] })).toThrow("digest does not match");
    expect(() => finalStateEvidenceEnvelopeSchema.parse({ ...envelope, artifacts: [{ ...artifact, byteSize: artifact.byteSize + 1 }] })).toThrow("byte size does not match");
    expect(() => finalStateEvidenceEnvelopeSchema.parse({ ...envelope, scopePaths: ["test/password-reset.test.ts"] })).toThrow("explicitly included");
    expect(verifyFinalStateEvidenceEnvelope({ ...envelope, postCommitPassingTestEvidenceId: "ev_missing" }, events)).toBe(false);

    const wrongCommitEvents = createEvidenceChain([
      {
        id: "ev_post_commit_test",
        recordedAt: "2026-07-19T10:00:00.000Z",
        type: "test",
        summary: "Final scoped tests passed after another commit",
        payload: { exitCode: 0, phase: "post-commit", repositoryCommit: "b".repeat(40) },
      },
    ]);
    expect(verifyFinalStateEvidenceEnvelope(envelope, wrongCommitEvents)).toBe(false);
    expect(verifyFinalStateEvidenceEnvelope(envelope, [{ ...events[0]!, summary: "Tampered passing test" }, events[1]!])).toBe(false);
  });

  it("adds git-state transmission only for an explicit, bound final Git-state record", () => {
    const ordinaryCompletionEvents = createEvidenceChain([{
      id: "ev_completion",
      recordedAt: "2026-07-19T10:00:00.000Z",
      type: "completion",
      summary: "Turn completed",
      payload: { status: "completed" },
    }]);
    expect(createEvidenceDigest("fixture", ordinaryCompletionEvents).transmissionCategories).toEqual([]);

    const { envelope } = createBoundFinalStateEvents();
    const reversedEvents = createEvidenceChain([
      {
        id: "ev_final_git_state",
        recordedAt: "2026-07-19T10:00:00.000Z",
        type: "completion",
        summary: "Premature final Git state",
        payload: envelope,
      },
      {
        id: "ev_post_commit_test",
        recordedAt: "2026-07-19T10:01:00.000Z",
        type: "test",
        summary: "Final scoped tests passed after commit",
        payload: { exitCode: 0, phase: "post-commit", repositoryCommit: FINAL_COMMIT },
      },
    ]);
    expect(() => createEvidenceDigest("fixture", reversedEvents)).toThrow("must follow");
  });
});
