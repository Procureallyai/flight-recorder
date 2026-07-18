import { buildEventChain } from "@flight-recorder/crypto";
import { describe, expect, it } from "vitest";
import { assembleManifest } from "./index.js";

describe("assembleManifest", () => {
  it("assembles a genuine candidate while preserving an unready human-review boundary", () => {
    const events = buildEventChain([{
      id: "ev_000001",
      recordedAt: "2026-07-18T20:00:00.000Z",
      type: "task",
      summary: "A genuine synthetic remediation task started.",
      payload: { synthetic: true },
    }]);
    const manifest = assembleManifest({
      passportId: "frp_candidate_001",
      createdAt: "2026-07-18T20:10:00.000Z",
      evidenceClassification: "genuine-session",
      project: { name: "Synthetic password-reset remediation", repositoryCommit: "a".repeat(40) },
      session: { task: "Repair the synthetic password-reset implementation.", acceptanceCriteria: ["Prevent account enumeration."] },
      artifacts: [{ id: "artifact_1", path: "src/reset.ts", mediaType: "text/typescript", content: "export {};\n" }],
      events,
      findings: [],
      findingDecisions: [],
      sealDecision: { ready: false, humanApproved: false, blockingReasons: ["GPT-5.6 review and human approval are pending."] },
    });

    expect(manifest.evidenceClassification).toBe("genuine-session");
    expect(manifest.sealDecision.ready).toBe(false);
    expect(manifest.eventChainHead).toBe(events[0]!.hash);
  });

  it("rejects a broken event chain", () => {
    const events = buildEventChain([{
      id: "ev_000001",
      recordedAt: "2026-07-18T20:00:00.000Z",
      type: "task",
      summary: "Task started.",
      payload: {},
    }]);
    events[0]!.hash = "0".repeat(64);
    expect(() => assembleManifest({
      passportId: "frp_candidate_002",
      createdAt: "2026-07-18T20:10:00.000Z",
      evidenceClassification: "genuine-session",
      project: { name: "Synthetic", repositoryCommit: "b".repeat(40) },
      session: { task: "Synthetic task.", acceptanceCriteria: ["One criterion."] },
      artifacts: [{ id: "artifact_1", path: "src/reset.ts", mediaType: "text/typescript", content: "export {};\n" }],
      events,
      findings: [],
      findingDecisions: [],
      sealDecision: { ready: false, humanApproved: false, blockingReasons: ["Pending."] },
    })).toThrow("valid hash chain");
  });
});
