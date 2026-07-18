import { describe, expect, it } from "vitest";
import { buildExecInvocation, importExecJsonLines } from "./index.js";

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
});
