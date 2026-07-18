import { describe, expect, it } from "vitest";
import { createEvidenceChain, createEvidenceDigest, sanitiseEvidenceValue } from "./index.js";

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
});
