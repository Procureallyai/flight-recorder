import type { EvidenceDigest } from "@flight-recorder/evidence";
import { describe, expect, it, vi } from "vitest";
import { ReviewClient, evaluateSealGate, type ReviewRun } from "./index.js";

const digest: EvidenceDigest = {
  schemaVersion: "0.1.0",
  source: "fixture",
  eventCount: 1,
  eventTypes: { task: 1 },
  testResults: [],
  evidence: [{ evidenceId: "ev_1", type: "task", summary: "Synthetic task", payload: {} }],
  transmissionCategories: ["task-and-criteria"],
  inputDigestSha256: "a".repeat(64),
};

function apiResponse(output: object, index: number): Response {
  return new Response(JSON.stringify({
    id: `resp_${index}`,
    created_at: 1_784_380_800,
    model: "gpt-5.6-sol",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("ReviewClient", () => {
  it("runs four parallel specialists followed by synthesis with store disabled", async () => {
    let call = 0;
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { store: boolean; input: unknown[]; text: { format: { strict: boolean } } };
      expect(request.store).toBe(false);
      expect(request.text.format.strict).toBe(true);
      call += 1;
      if (call <= 4) {
        const reviewers = ["requirements", "security", "tests", "evidence"] as const;
        return apiResponse({ reviewer: reviewers[call - 1], model: "gpt-5.6-sol", verdict: "pass", findings: [], limitations: [] }, call);
      }
      return apiResponse({ reviewer: "synthesis", model: "gpt-5.6-sol", verdict: "ready", summary: "Evidence is ready for deterministic checks.", findings: [], limitations: [] }, call);
    });

    const client = new ReviewClient({ apiKey: "synthetic-test-key", fetchImplementation: fetchMock as typeof fetch });
    const result = await client.run(digest);
    expect(result.specialists).toHaveLength(4);
    expect(result.synthesis.output.verdict).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("evaluateSealGate", () => {
  const readyReviews: ReviewRun = {
    specialists: ["requirements", "security", "tests", "evidence"].map((reviewer, index) => ({
      responseId: `resp_${index}`,
      createdAt: "2026-07-18T12:00:00.000Z",
      model: "gpt-5.6-sol",
      inputDigestSha256: "a".repeat(64),
      output: { reviewer, model: "gpt-5.6-sol", verdict: "pass", findings: [], limitations: [] },
    })) as ReviewRun["specialists"],
    synthesis: {
      responseId: "resp_synthesis",
      createdAt: "2026-07-18T12:00:00.000Z",
      model: "gpt-5.6-sol",
      inputDigestSha256: "a".repeat(64),
      output: { reviewer: "synthesis", model: "gpt-5.6-sol", verdict: "ready", summary: "Ready", findings: [], limitations: [] },
    },
  };

  it("requires model review, deterministic evidence, and explicit human approval", () => {
    const base = {
      reviews: readyReviews,
      acceptanceCriteria: [{ id: "ac_1", status: "supported" as const }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
      finalGitStateCaptured: true,
      secretScanBlocked: false,
    };
    expect(evaluateSealGate({ ...base, humanApproved: false }).ready).toBe(false);
    expect(evaluateSealGate({ ...base, humanApproved: true }).ready).toBe(true);
  });

  it("blocks unresolved high-severity model findings", () => {
    const reviews = structuredClone(readyReviews);
    reviews.specialists[0]!.output.findings.push({
      id: "finding_1",
      title: "Missing negative test",
      severity: "high",
      status: "open",
      claim: "Unknown-account behaviour is untested.",
      rationale: "No negative-path evidence was supplied.",
      evidenceRefs: ["ev_1"],
      affectedCriteria: ["ac_1"],
      remediation: "Add and run the negative-path test.",
    });
    expect(evaluateSealGate({
      reviews,
      acceptanceCriteria: [{ id: "ac_1", status: "supported" }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
      finalGitStateCaptured: true,
      secretScanBlocked: false,
      humanApproved: true,
    }).ready).toBe(false);
  });
});
