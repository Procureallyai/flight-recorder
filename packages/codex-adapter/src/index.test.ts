import { describe, expect, it } from "vitest";
import { createEvidenceDigest } from "@flight-recorder/evidence";
import { buildExecInvocation, importExecJsonLines, isLikelyTestCommand } from "./index.js";

const capturedAt = () => "2026-07-18T20:00:00.000Z";

describe("codex exec JSON importer", () => {
  it("retains completed observable events and discards reasoning", () => {
    const result = importExecJsonLines([
      JSON.stringify({ type: "thread.started", thread_id: "private-thread-id" }),
      JSON.stringify({ type: "turn.started" }),
      JSON.stringify({ type: "item.completed", item: { id: "reasoning-1", type: "reasoning", text: "private chain of thought" } }),
      JSON.stringify({ type: "item.completed", item: { id: "cmd-1", type: "command_execution", command: "pnpm test", status: "completed", exit_code: 0, output: "OPENAI_API_KEY=sk-syntheticexample123456" } }),
      JSON.stringify({ type: "item.completed", item: { id: "file-1", type: "file_change", status: "completed", changes: [{ path: "/synthetic/repository/src/reset.ts", kind: "update" }] } }),
      JSON.stringify({ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 20 } }),
    ], { testedCodexVersion: "codex-cli 0.145.0-alpha.18", repositoryRoot: "/synthetic/repository", recordedAt: capturedAt });

    expect(result.complete).toBe(true);
    expect(result.approvalCoverage).toBe("not-observed");
    expect(result.events.some((event) => JSON.stringify(event).includes("private chain of thought"))).toBe(false);
    expect(result.events.some((event) => JSON.stringify(event).includes("sk-syntheticexample"))).toBe(false);
    expect(result.events.some((event) => JSON.stringify(event).includes("/synthetic/repository"))).toBe(false);
    expect(result.events.some((event) => JSON.stringify(event).includes("<repository>/src/reset.ts"))).toBe(true);
    expect(result.events.some((event) => event.type === "test" && event.payload.exitCode === 0)).toBe(true);
    expect(result.events.some((event) => event.type === "file-change")).toBe(true);
  });

  it("fails visibly on malformed input or a missing terminal event", () => {
    const result = importExecJsonLines(["not-json"], { testedCodexVersion: "codex-cli 0.145.0-alpha.18", recordedAt: capturedAt });
    expect(result.complete).toBe(false);
    expect(result.issues).toEqual(["Line 1 was not valid JSON.", "Capture ended without a terminal turn event."]);
  });

  it("passes the prompt on standard input and does not shell-interpolate it", () => {
    const invocation = buildExecInvocation("/tmp/synthetic-repository", "Use $HOME literally; do not execute `date`.");
    expect(invocation.args.at(-1)).toBe("-");
    expect(invocation.args).not.toContain(invocation.stdin);
    expect(invocation.stdin).toContain("$HOME");
  });

  it.each([
    "pnpm test",
    "npm run test -- --watch=false",
    "pnpm run test:integration",
    "yarn test",
    "bun test",
    "vitest run",
    "npx vitest",
    "pytest -q",
    "python -m pytest",
    "cargo test",
    "go test ./...",
    "dotnet test",
  ])("recognises supported test command: %s", (command) => {
    expect(isLikelyTestCommand(command)).toBe(true);
  });

  it.each(["npm run build", "pnpm lint", "yarn install", "bun run typecheck"])('does not misclassify non-test command: %s', (command) => {
    expect(isLikelyTestCommand(command)).toBe(false);
  });

  it("supports configurable and manual test evidence without inferring pass from text", () => {
    const result = importExecJsonLines([
      JSON.stringify({ type: "thread.started" }),
      JSON.stringify({ type: "item.completed", item: { id: "custom-1", type: "command_execution", command: "acme verify", exit_code: 1, output: "all tests passed" } }),
      JSON.stringify({ type: "item.completed", item: { id: "manual-1", type: "command_execution", command: "custom harness", exit_code: 0 } }),
      JSON.stringify({ type: "turn.completed" }),
    ], {
      testedCodexVersion: "codex-cli 0.145.0-alpha.18",
      recordedAt: capturedAt,
      additionalTestCommandPatterns: [/^acme verify$/u],
      manuallyConfirmedTestItemIds: ["manual-1"],
    });

    const tests = result.events.filter((event) => event.type === "test");
    expect(tests).toHaveLength(2);
    expect(tests[0]?.payload.exitCode).toBe(1);
    expect(tests[0]?.payload.output).toBe("all tests passed");
    expect(tests[1]?.payload.manuallyConfirmedTest).toBe(true);
    expect(createEvidenceDigest("codex-exec-json", result.events).testResults[0]?.status).toBe("failed");
  });
});
