import { describe, expect, it } from "vitest";
import {
  buildEventChain,
  calculateMerkleRoot,
  describeArtifact,
  generateSigningKeyPair,
  sealManifest,
} from "@flight-recorder/crypto";
import type { PassportManifest } from "@flight-recorder/schema";
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
    eventChainHead: events.at(-1)?.hash ?? "",
    merkleRoot: calculateMerkleRoot(artifacts, events),
    sealDecision: { ready: true, blockingReasons: [], humanApproved: true },
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  };
  const keys = generateSigningKeyPair();
  return sealManifest(manifest, keys.privateKey, keys.publicKey);
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
});
