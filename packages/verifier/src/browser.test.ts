import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildEventChain,
  calculateMerkleRoot,
  describeArtifact,
  generateSigningKeyPair,
  sealManifest,
} from "@flight-recorder/crypto";
import {
  createEvidenceDigest,
  createFinalArtifactSnapshot,
  finalStateEvidenceEnvelopeSchema,
} from "@flight-recorder/evidence";
import type { Passport, PassportManifest, ReviewProvenance } from "@flight-recorder/schema";
import { verifyPassport as verifyPassportWithNode } from "./index.js";
import { verifyPassportInBrowser } from "./browser.js";

const fixturePassportPath = "fixtures/demo-passport/passport.json";
const sourcePath = "fixtures/demo-passport/artifacts/src/password-reset.ts";
const testPath = "fixtures/demo-passport/artifacts/test/password-reset.test.ts";

function loadFixture(): Passport {
  return JSON.parse(readFileSync(fixturePassportPath, "utf8")) as Passport;
}

function loadFixtureArtifacts(): Record<string, Uint8Array> {
  return {
    "src/password-reset.ts": readFileSync(sourcePath),
    "test/password-reset.test.ts": readFileSync(testPath),
  };
}

function check(result: Awaited<ReturnType<typeof verifyPassportInBrowser>>, name: string) {
  return result.checks.find((candidate) => candidate.name === name);
}

function createGenuinePassport(tail: "approval" | "plan" = "approval"): { passport: Passport; artifacts: Record<string, string> } {
  const source = "export const reset = () => ({ accepted: true });\n";
  const test = "it('returns a neutral response', () => expect(true).toBe(true));\n";
  const finalCommit = "a".repeat(40);
  const artifacts = [
    describeArtifact("artifact-source", "src/reset.ts", "text/typescript", source),
    describeArtifact("artifact-test", "test/reset.test.ts", "text/typescript", test),
  ];
  const finalArtifacts = [
    createFinalArtifactSnapshot("src/reset.ts", "text/typescript", source),
    createFinalArtifactSnapshot("test/reset.test.ts", "text/typescript", test),
  ];
  const finalState = finalStateEvidenceEnvelopeSchema.parse({
    schemaVersion: "0.1.0",
    recordKind: "final-git-state",
    finalCommit,
    scopedClean: true,
    scopePaths: finalArtifacts.map((artifact) => artifact.path),
    postCommitPassingTestEvidenceId: "event-test",
    artifacts: finalArtifacts,
  });
  const reviewedDrafts = [
    {
      id: "event-task",
      recordedAt: "2026-07-18T12:00:00.000+00:00",
      type: "task",
      summary: "Implement a safe password-reset endpoint.",
      payload: { acceptanceCriteriaCount: 4 },
    },
    {
      id: "event-test",
      recordedAt: "2026-07-18T12:10:00.000+00:00",
      type: "test",
      summary: "Password-reset regression tests passed after commit.",
      payload: { command: "pnpm test", exitCode: 0, phase: "post-commit", repositoryCommit: finalCommit },
    },
    {
      id: "event-final-state",
      recordedAt: "2026-07-18T12:11:00.000+00:00",
      type: "completion",
      summary: "Final Git state recorded.",
      payload: finalState,
    },
  ] as const;
  const reviewedEvents = buildEventChain(reviewedDrafts);
  const evidenceDigestSha256 = createEvidenceDigest("codex-exec-json", reviewedEvents).inputDigestSha256;
  const tailDraft = tail === "approval" ? {
      id: "event-approval",
      recordedAt: "2026-07-18T12:12:00.000+00:00",
      type: "approval" as const,
      summary: "Human approved the reviewed evidence for sealing.",
      payload: {
        recordKind: "human-seal-approval",
        decision: "approved-for-sealing",
        passportId: "browser-genuine-001",
        repositoryCommit: finalCommit,
        evidenceDigestSha256,
        findingDecisionIds: [],
        acknowledgedNarrowClaim: true,
        acknowledgedResidualLimitations: true,
        reason: "The narrow claim and residual limitations were reviewed.",
      },
    } : {
      id: "event-late-plan",
      recordedAt: "2026-07-18T12:12:00.000+00:00",
      type: "plan" as const,
      summary: "Arbitrary post-review work.",
      payload: { status: "unexpected" },
    };
  const events = buildEventChain([...reviewedDrafts, tailDraft]);
  const manifest: PassportManifest = {
    schemaVersion: "0.1.0",
    passportId: "browser-genuine-001",
    createdAt: "2026-07-18T12:13:00.000+00:00",
    timestampType: "local-recorded-time",
    evidenceClassification: "genuine-session",
    project: { name: "Browser verifier parity", repositoryCommit: finalCommit },
    session: { task: "Implement a safe password-reset endpoint.", acceptanceCriteria: ["Return a neutral response."] },
    artifacts,
    events,
    findings: [],
    findingDecisions: [],
    eventChainHead: events.at(-1)?.hash ?? "",
    merkleRoot: calculateMerkleRoot(artifacts, events),
    sealDecision: { ready: true, blockingReasons: [], humanApproved: true },
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  };
  manifest.reviewProvenance = {
    evidenceSource: "codex-exec-json",
    evidenceDigestSha256,
    calls: ["requirements", "security", "tests", "evidence", "synthesis"].map((reviewer, index) => ({
      reviewer: reviewer as ReviewProvenance["calls"][number]["reviewer"],
      responseId: `resp_${index}`,
      createdAt: "2026-07-18T12:12:30.000Z",
      model: "gpt-5.6-sol",
      inputDigestSha256: evidenceDigestSha256,
    })),
  };
  const keys = generateSigningKeyPair();
  return { passport: sealManifest(manifest, keys.privateKey), artifacts: { "src/reset.ts": source, "test/reset.test.ts": test } };
}

describe("browser passport verifier", () => {
  it("matches the Node.js verifier for the existing signed fixture", async () => {
    const passport = loadFixture();
    const artifacts = loadFixtureArtifacts();
    const nodeResult = verifyPassportWithNode(passport, artifacts);
    const browserResult = await verifyPassportInBrowser(passport, artifacts);

    expect(nodeResult.valid).toBe(true);
    expect(browserResult.valid).toBe(nodeResult.valid);
    expect(browserResult.checks.every((candidate) => candidate.valid)).toBe(true);
  });

  it("matches Node.js review-provenance verification for genuine evidence", async () => {
    const { passport, artifacts } = createGenuinePassport();
    const nodeResult = verifyPassportWithNode(passport, artifacts);
    const browserResult = await verifyPassportInBrowser(passport, artifacts);

    expect(browserResult.valid).toBe(nodeResult.valid);
    expect(check(browserResult, "review-provenance")).toMatchObject({ valid: true });
  });

  it("rejects an arbitrary signed and Merkle-bound tail after the reviewed final state", async () => {
    const { passport, artifacts } = createGenuinePassport("plan");
    const nodeResult = verifyPassportWithNode(passport, artifacts);
    const browserResult = await verifyPassportInBrowser(passport, artifacts);

    expect(browserResult.valid).toBe(nodeResult.valid);
    expect(check(browserResult, "review-provenance")).toMatchObject({ valid: false });
    expect(check(browserResult, "signature")).toMatchObject({ valid: true });
    expect(check(browserResult, "event-chain")).toMatchObject({ valid: true });
    expect(check(browserResult, "merkle-root")).toMatchObject({ valid: true });
  });

  it("rejects a signed-manifest mutation", async () => {
    const passport = structuredClone(loadFixture());
    passport.manifest.session.task = "A mutated task";
    const result = await verifyPassportInBrowser(passport, loadFixtureArtifacts());

    expect(result.valid).toBe(false);
    expect(check(result, "signature")).toMatchObject({ valid: false });
  });

  it("keeps signature validity separate when external artifact bytes change", async () => {
    const artifacts = loadFixtureArtifacts();
    artifacts["src/password-reset.ts"] = new TextEncoder().encode("changed outside the signed passport");
    const result = await verifyPassportInBrowser(loadFixture(), artifacts);

    expect(result.valid).toBe(false);
    expect(check(result, "signature")).toMatchObject({ valid: true });
    expect(check(result, "artifacts")).toMatchObject({ valid: false });
  });

  it("fails closed when a covered artifact is missing", async () => {
    const artifacts = loadFixtureArtifacts();
    delete artifacts["test/password-reset.test.ts"];
    const result = await verifyPassportInBrowser(loadFixture(), artifacts);

    expect(result.valid).toBe(false);
    expect(check(result, "signature")).toMatchObject({ valid: true });
    expect(check(result, "artifacts")).toMatchObject({ valid: false });
  });

  it("fails closed for a malformed Ed25519 public key", async () => {
    const passport = structuredClone(loadFixture());
    passport.signature.publicKeyPem = "not a public key";
    const result = await verifyPassportInBrowser(passport, loadFixtureArtifacts());

    expect(result.valid).toBe(false);
    expect(check(result, "signature")).toMatchObject({ valid: false });
  });

  it("detects a mutated event independently of its enclosing signature", async () => {
    const passport = structuredClone(loadFixture());
    passport.manifest.events[0]!.summary = "Mutated event summary";
    const result = await verifyPassportInBrowser(passport, loadFixtureArtifacts());

    expect(result.valid).toBe(false);
    expect(check(result, "signature")).toMatchObject({ valid: false });
    expect(check(result, "event-chain")).toMatchObject({ valid: false });
  });

  it("reports absence of Web Cryptography support as a structured failure", async () => {
    const result = await verifyPassportInBrowser(loadFixture(), loadFixtureArtifacts(), { cryptoProvider: null });

    expect(result.valid).toBe(false);
    expect(check(result, "schema")).toMatchObject({ valid: true });
    expect(check(result, "crypto-support")).toMatchObject({ valid: false });
    expect(check(result, "signature")).toMatchObject({ valid: false });
  });

  it("returns structured failures when an advertised digest operation rejects", async () => {
    const rejectingProvider = {
      subtle: {
        digest: async () => { throw new Error("synthetic digest failure"); },
        importKey: async () => ({}),
        verify: async () => false,
      },
    };
    const result = await verifyPassportInBrowser(loadFixture(), loadFixtureArtifacts(), { cryptoProvider: rejectingProvider });

    expect(result.valid).toBe(false);
    expect(check(result, "crypto-support")).toMatchObject({ valid: true });
    expect(check(result, "signature")).toMatchObject({ valid: false });
    expect(check(result, "event-chain")).toMatchObject({ valid: false });
    expect(check(result, "merkle-root")).toMatchObject({ valid: false });
    expect(check(result, "artifacts")).toMatchObject({ valid: false });
  });

  it("fails closed when an untrusted passport getter throws during schema validation", async () => {
    const hostilePassport = Object.defineProperty({}, "manifest", {
      enumerable: true,
      get: () => { throw new Error("synthetic getter failure"); },
    });
    const result = await verifyPassportInBrowser(hostilePassport, {});

    expect(result.valid).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(check(result, "schema")).toMatchObject({ valid: false });
  });
});
