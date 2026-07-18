import { describe, expect, it } from "vitest";
import {
  buildEventChain,
  calculateMerkleRoot,
  describeArtifact,
  generateSigningKeyPair,
  signManifest,
  sealManifest,
} from "@flight-recorder/crypto";
import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { createEvidenceDigest } from "@flight-recorder/evidence";
import type { Passport, PassportManifest, ReviewProvenance } from "@flight-recorder/schema";
import { verifyPassport } from "./index.js";

const taskSource = "export function resetPassword() { return { accepted: true }; }\n";
const testSource = "it('returns a neutral response', () => expect(true).toBe(true));\n";

function createPassport() {
  const artifacts = [
    describeArtifact("artifact-source", "src/reset.ts", "text/typescript", taskSource),
    describeArtifact("artifact-test", "test/reset.test.ts", "text/typescript", testSource),
  ];
  const events = buildEventChain([
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
      summary: "Password-reset regression tests passed.",
      payload: { command: "pnpm test", exitCode: 0 },
    },
    {
      id: "event-approval",
      recordedAt: "2026-07-18T12:12:00.000+00:00",
      type: "approval",
      summary: "Human approved the evidence for sealing.",
      payload: { decision: "approved" },
    },
  ]);

  const manifest: PassportManifest = {
    schemaVersion: "0.1.0",
    passportId: "passport-demo-001",
    createdAt: "2026-07-18T12:13:00.000+00:00",
    timestampType: "local-recorded-time",
    evidenceClassification: "synthetic-test-fixture",
    project: { name: "Synthetic password reset", repositoryCommit: "0123456789abcdef" },
    session: {
      task: "Implement a safe password-reset endpoint.",
      acceptanceCriteria: [
        "Tokens expire and are single use.",
        "Responses do not reveal whether an account exists.",
        "Raw tokens are never logged.",
        "Known and unknown accounts are tested.",
      ],
    },
    artifacts,
    events,
    findings: [],
    findingDecisions: [],
    eventChainHead: events.at(-1)?.hash ?? "",
    merkleRoot: calculateMerkleRoot(artifacts, events),
    sealDecision: { ready: true, blockingReasons: [], humanApproved: true },
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  };
  const keys = generateSigningKeyPair();
  return sealManifest(manifest, keys.privateKey);
}

function genuineReviewProvenance(manifest: PassportManifest): ReviewProvenance {
  const evidenceDigestSha256 = createEvidenceDigest("codex-exec-json", manifest.events).inputDigestSha256;
  return {
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
}

function createGenuinePassport(): Passport {
  const synthetic = createPassport();
  const manifest = structuredClone(synthetic.manifest);
  manifest.evidenceClassification = "genuine-session";
  manifest.reviewProvenance = genuineReviewProvenance(manifest);
  const keys = generateSigningKeyPair();
  return sealManifest(manifest, keys.privateKey);
}

describe("verifyPassport", () => {
  it("accepts a valid signed passport with unchanged artifacts", () => {
    const result = verifyPassport(createPassport(), {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(true);
    expect(result.checks.every((check) => check.valid)).toBe(true);
  });

  it("independently verifies five review receipts against genuine recorded evidence", () => {
    const result = verifyPassport(createGenuinePassport(), {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(true);
    expect(result.checks.find((check) => check.name === "review-provenance")).toMatchObject({ valid: true });
  });

  it("rejects a signed genuine passport whose review receipt belongs to stale evidence", () => {
    const passport = createGenuinePassport();
    passport.manifest.reviewProvenance!.evidenceDigestSha256 = "b".repeat(64);
    for (const call of passport.manifest.reviewProvenance!.calls) call.inputDigestSha256 = "b".repeat(64);
    const keys = generateSigningKeyPair();
    passport.signature = signManifest(passport.manifest, keys.privateKey);

    const result = verifyPassport(passport, {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "signature")).toMatchObject({ valid: true });
    expect(result.checks.find((check) => check.name === "review-provenance")).toMatchObject({ valid: false });
  });

  it("rejects duplicate review receipts even when the enclosing signature is valid", () => {
    const passport = createGenuinePassport();
    passport.manifest.reviewProvenance!.calls[4] = { ...passport.manifest.reviewProvenance!.calls[0]! };
    const keys = generateSigningKeyPair();
    passport.signature = signManifest(passport.manifest, keys.privateKey);

    const result = verifyPassport(passport, {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "review-provenance")).toMatchObject({ valid: false });
  });

  it("refuses to seal a genuine session without signed review provenance", () => {
    const passport = createPassport();
    passport.manifest.evidenceClassification = "genuine-session";
    const keys = generateSigningKeyPair();
    expect(() => sealManifest(passport.manifest, keys.privateKey)).toThrow("review provenance");

    const deliberatelyBypassedPassport: Passport = {
      manifest: passport.manifest,
      signature: signManifest(passport.manifest, keys.privateKey),
    };
    const result = verifyPassport(deliberatelyBypassedPassport, {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "seal-policy")).toMatchObject({ valid: false });
    expect(result.checks.find((check) => check.name === "review-provenance")).toMatchObject({ valid: false });
  });

  it("preserves accepted risk as a distinct human decision for a non-blocking finding", () => {
    const passport = createGenuinePassport();
    passport.manifest.findings.push({
      id: "finding-warning",
      reviewer: "security",
      severity: "warning",
      title: "Synthetic residual risk",
      detail: "A bounded synthetic limitation remains.",
      evidenceIds: ["event-test"],
      resolved: false,
    });
    passport.manifest.findingDecisions.push({
      id: "decision-warning",
      findingId: "finding-warning",
      decision: "accepted-risk",
      reason: "The synthetic limitation is understood and bounded for this fixture.",
      decidedAt: "2026-07-18T12:12:00.000Z",
      actor: "human",
      decisionEventId: "event-approval",
    });
    const keys = generateSigningKeyPair();
    const resealed = sealManifest(passport.manifest, keys.privateKey);
    const result = verifyPassport(resealed, { "src/reset.ts": taskSource, "test/reset.test.ts": testSource });
    expect(result.valid).toBe(true);
    expect(resealed.manifest.findings[0]?.resolved).toBe(false);
    expect(resealed.manifest.findingDecisions[0]?.decision).toBe("accepted-risk");
  });

  it("does not permit accepted risk to clear a blocking finding", () => {
    const passport = createGenuinePassport();
    passport.manifest.findings.push({
      id: "finding-blocking-risk",
      reviewer: "security",
      severity: "blocking",
      title: "Synthetic blocking risk",
      detail: "The blocker remains open.",
      evidenceIds: ["event-test"],
      resolved: false,
    });
    passport.manifest.findingDecisions.push({
      id: "decision-blocking-risk",
      findingId: "finding-blocking-risk",
      decision: "accepted-risk",
      reason: "Synthetic attempt to accept a blocking risk.",
      decidedAt: "2026-07-18T12:12:00.000Z",
      actor: "human",
      decisionEventId: "event-approval",
    });
    const keys = generateSigningKeyPair();
    expect(() => sealManifest(passport.manifest, keys.privateKey)).toThrow("Accepted risk cannot clear");
  });

  it("requires a recorded resolution decision for every resolved genuine finding", () => {
    const passport = createGenuinePassport();
    passport.manifest.findings.push({
      id: "finding-resolved-without-decision",
      reviewer: "tests",
      severity: "warning",
      title: "Synthetic resolved issue",
      detail: "The model output alone asserts resolution.",
      evidenceIds: ["event-test"],
      resolved: true,
    });
    const keys = generateSigningKeyPair();
    expect(() => sealManifest(passport.manifest, keys.privateKey)).toThrow("recorded human resolution decision");
  });

  it("rejects a decision that does not reference an approval event", () => {
    const passport = createPassport();
    passport.manifest.findings.push({
      id: "finding-invalid-decision-event",
      reviewer: "evidence",
      severity: "warning",
      title: "Synthetic decision reference",
      detail: "The decision points to a test event.",
      evidenceIds: ["event-test"],
      resolved: false,
    });
    passport.manifest.findingDecisions.push({
      id: "decision-invalid-event",
      findingId: "finding-invalid-decision-event",
      decision: "accepted-risk",
      reason: "Synthetic invalid reference.",
      decidedAt: "2026-07-18T12:12:00.000Z",
      actor: "human",
      decisionEventId: "event-test",
    });
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it("rejects the passport immediately after a covered artifact changes", () => {
    const result = verifyPassport(createPassport(), {
      "src/reset.ts": `${taskSource}// tampered\n`,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "artifacts")).toMatchObject({ valid: false });
  });

  it("rejects a modified manifest even if artifact contents are unchanged", () => {
    const passport = createPassport();
    passport.manifest.session.task = "A different task";
    const result = verifyPassport(passport, {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "signature")).toMatchObject({ valid: false });
  });

  it("fails closed for a malformed public key", () => {
    const passport = createPassport();
    passport.signature.publicKeyPem = "not a public key";
    const result = verifyPassport(passport, {
      "src/reset.ts": taskSource,
      "test/reset.test.ts": testSource,
    });
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "signature")).toMatchObject({ valid: false });
  });

  it("rejects traversal paths at the schema boundary", () => {
    const passport = createPassport();
    passport.manifest.artifacts[0]!.path = "../outside.ts";
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it("rejects unsigned unknown fields rather than stripping them", () => {
    const passport = createPassport() as ReturnType<typeof createPassport> & { unsignedClaim?: string };
    passport.unsignedClaim = "Independently certified";
    const result = verifyPassport(passport, new Map([
      ["src/reset.ts", taskSource],
      ["test/reset.test.ts", testSource],
    ]));
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it("rejects unknown fields at every signed-envelope object boundary", () => {
    const mutations: Array<(passport: ReturnType<typeof createPassport>) => void> = [
      (passport) => { (passport.manifest as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.manifest.project as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.manifest.session as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.manifest.artifacts[0] as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.manifest.events[0] as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.manifest.sealDecision as unknown as Record<string, unknown>).unsigned = true; },
      (passport) => { (passport.signature as unknown as Record<string, unknown>).unsigned = true; },
    ];

    for (const mutate of mutations) {
      const passport = createPassport();
      mutate(passport);
      const result = verifyPassport(passport, new Map([
        ["src/reset.ts", taskSource],
        ["test/reset.test.ts", testSource],
      ]));
      expect(result.valid).toBe(false);
      expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
    }
  });

  it("fails safely for non-JSON evidence payloads", () => {
    const passport = createPassport();
    (passport.manifest.events[0]!.payload as Record<string, unknown>).unsafe = 1n;
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it("rejects contradictory ready seals with blocking reasons or unresolved blockers", () => {
    const passport = createPassport();
    passport.manifest.sealDecision.blockingReasons.push("Known critical defect");
    passport.manifest.findings.push({
      id: "finding-blocker",
      reviewer: "security",
      severity: "blocking",
      title: "Known blocker",
      detail: "Synthetic contradiction test.",
      evidenceIds: ["event-test"],
      resolved: false,
    });
    const keys = generateSigningKeyPair();
    passport.signature = signManifest(passport.manifest, keys.privateKey);
    const result = verifyPassport(passport, new Map([
      ["src/reset.ts", taskSource],
      ["test/reset.test.ts", testSource],
    ]));
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "seal-policy")).toMatchObject({ valid: false });
  });

  it("rejects Ed448 signatures labelled as Ed25519", () => {
    const passport = createPassport();
    const keys = generateKeyPairSync("ed448");
    const manifestBytes = Buffer.from(JSON.stringify(passport.manifest), "utf8");
    // Ed448 is intentionally supplied here to verify algorithm-confusion rejection.
    passport.signature.publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    passport.signature.signatureBase64 = signBytes(null, manifestBytes, keys.privateKey).toString("base64");
    const result = verifyPassport(passport, new Map([
      ["src/reset.ts", taskSource],
      ["test/reset.test.ts", testSource],
    ]));
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "signature")).toMatchObject({ valid: false });
  });

  it.each(["toString", "constructor", "__proto__"])("fails safely for a missing prototype-named artifact path: %s", (path) => {
    const passport = createPassport();
    passport.manifest.artifacts[0]!.path = path;
    passport.manifest.merkleRoot = calculateMerkleRoot(passport.manifest.artifacts, passport.manifest.events);
    const keys = generateSigningKeyPair();
    passport.signature = signManifest(passport.manifest, keys.privateKey);
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "artifacts")).toMatchObject({ valid: false });
  });

  it("rejects artifact paths that collide after portable case folding", () => {
    const passport = createPassport();
    passport.manifest.artifacts[1]!.path = "SRC/RESET.TS";
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it.each(["CON", "src/NUL.txt", "src/trailing. "])("rejects non-portable reserved artifact path: %s", (path) => {
    const passport = createPassport();
    passport.manifest.artifacts[0]!.path = path;
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });

  it("rejects evidence streams above the documented event limit", () => {
    const passport = createPassport();
    passport.manifest.events = Array.from({ length: 10_001 }, (_, index) => ({
      ...passport.manifest.events[0]!,
      id: `event-${index}`,
      index,
    }));
    const result = verifyPassport(passport, {});
    expect(result.valid).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "schema", valid: false });
  });
});
