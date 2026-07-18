import type { EvidenceDigest } from "@flight-recorder/evidence";
import { describe, expect, it, vi } from "vitest";
import { ReviewClient, createReviewProvenance, evaluateSealGate, type ReviewRun } from "./index.js";

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

    const client = new ReviewClient({ apiKey: "synthetic-test-key", enabled: true, fetchImplementation: fetchMock as typeof fetch });
    const result = await client.run(digest);
    expect(result.specialists).toHaveLength(4);
    expect(result.synthesis.output.verdict).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("fails closed unless a bounded runtime review is explicitly enabled", () => {
    expect(() => new ReviewClient({ apiKey: "synthetic-test-key" })).toThrow("disabled");
    expect(() => new ReviewClient({ apiKey: "synthetic-test-key", enabled: true, maxCalls: 4 })).toThrow("cannot complete");
    expect(() => new ReviewClient({ apiKey: "synthetic-test-key", enabled: true, maxOutputTokens: 4_001 })).toThrow("bounded");
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
      evidenceDigestSha256: "a".repeat(64),
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
      evidenceDigestSha256: "a".repeat(64),
      acceptanceCriteria: [{ id: "ac_1", status: "supported" }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
      finalGitStateCaptured: true,
      secretScanBlocked: false,
      humanApproved: true,
    }).ready).toBe(false);
  });

  it.each([
    {
      name: "unsupported acceptance evidence",
      acceptanceCriteria: [{ id: "ac_1", status: "unsupported" as const }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
    },
    {
      name: "missing acceptance evidence",
      acceptanceCriteria: [{ id: "ac_1", status: "missing" as const }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
    },
    {
      name: "no acceptance criteria",
      acceptanceCriteria: [],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
    },
    {
      name: "one failed required test among passing tests",
      acceptanceCriteria: [{ id: "ac_1", status: "supported" as const }],
      requiredTests: [{ evidenceId: "ev_failed", passed: false }, { evidenceId: "ev_passed", passed: true }],
    },
    {
      name: "no required tests",
      acceptanceCriteria: [{ id: "ac_1", status: "supported" as const }],
      requiredTests: [],
    },
  ])("fails closed for $name", ({ acceptanceCriteria, requiredTests }) => {
    expect(evaluateSealGate({
      reviews: readyReviews,
      evidenceDigestSha256: "a".repeat(64),
      acceptanceCriteria,
      requiredTests,
      finalGitStateCaptured: true,
      secretScanBlocked: false,
      humanApproved: true,
    }).ready).toBe(false);
  });

  it("rejects stale review evidence and duplicated response identifiers", () => {
    const staleReviews = structuredClone(readyReviews);
    staleReviews.specialists[0]!.inputDigestSha256 = "b".repeat(64);
    staleReviews.synthesis.responseId = staleReviews.specialists[1]!.responseId;

    const decision = evaluateSealGate({
      reviews: staleReviews,
      evidenceDigestSha256: "a".repeat(64),
      acceptanceCriteria: [{ id: "ac_1", status: "supported" }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
      finalGitStateCaptured: true,
      secretScanBlocked: false,
      humanApproved: true,
    });

    expect(decision.ready).toBe(false);
    expect(decision.blockingReasons).toContain("Every review must be bound to the current evidence digest.");
    expect(decision.blockingReasons).toContain("Review response identifiers must be unique.");
  });

  it("rejects duplicate or missing specialist identities", () => {
    const duplicatedReviews = structuredClone(readyReviews);
    duplicatedReviews.specialists[3]!.output.reviewer = "requirements";

    expect(evaluateSealGate({
      reviews: duplicatedReviews,
      evidenceDigestSha256: "a".repeat(64),
      acceptanceCriteria: [{ id: "ac_1", status: "supported" }],
      requiredTests: [{ evidenceId: "ev_test", passed: true }],
      finalGitStateCaptured: true,
      secretScanBlocked: false,
      humanApproved: true,
    }).blockingReasons).toContain("Each required specialist reviewer must appear exactly once.");
  });

  it("creates a strict five-call provenance receipt", () => {
    const provenance = createReviewProvenance("codex-exec-json", readyReviews);
    expect(provenance.evidenceDigestSha256).toBe("a".repeat(64));
    expect(provenance.calls.map((call) => call.reviewer)).toEqual(["requirements", "security", "tests", "evidence", "synthesis"]);
    expect(new Set(provenance.calls.map((call) => call.responseId)).size).toBe(5);
  });
});
