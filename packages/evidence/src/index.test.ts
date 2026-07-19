import { describe, expect, it } from "vitest";
import {
  createEvidenceChain,
  createEvidenceDigest,
  createFinalArtifactSnapshot,
  createReviewDigestFromExecCapture,
  finalStateEvidenceEnvelopeSchema,
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

  it("rejects a genuine review capture with evidence after its final Git-state record", () => {
    const { envelope } = createBoundFinalStateEvents();
    const events = createEvidenceChain([
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
      events,
    })).toThrow("must end with its authoritative final Git-state");
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
