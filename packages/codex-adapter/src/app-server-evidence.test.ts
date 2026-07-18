import { describe, expect, it } from "vitest";
import { AppServerEvidenceRecorder } from "./app-server-evidence.js";

const fixedTime = () => "2026-07-18T20:00:00.000Z";

describe("AppServerEvidenceRecorder", () => {
  it("normalises observable turn, plan, command, test, file, approval, and completion evidence", () => {
    const recorder = new AppServerEvidenceRecorder({ repositoryRoot: "/private/example", recordedAt: fixedTime });
    recorder.recordTask("Implement the synthetic task.", ["Tests pass."]);
    recorder.recordNotification("turn/started", { threadId: "thread-private", turn: { id: "turn-private", items: [], status: "inProgress" } });
    recorder.recordNotification("turn/plan/updated", { plan: [{ step: "Test", status: "inProgress" }], threadId: "thread-private", turnId: "turn-private" });
    recorder.recordApprovalRequest("approval-private", "item/commandExecution/requestApproval", {
      itemId: "item-private",
      startedAtMs: 1_752_867_200_000,
      threadId: "thread-private",
      turnId: "turn-private",
      command: "pnpm test",
      cwd: "/private/example",
      reason: "Synthetic approval reason",
    });
    recorder.recordApprovalDecision("approval-private", "accept");
    recorder.recordNotification("item/completed", {
      completedAtMs: 1_752_867_201_000,
      threadId: "thread-private",
      turnId: "turn-private",
      item: { id: "test-private", type: "commandExecution", command: "pnpm test", cwd: "/private/example", status: "completed", exitCode: 0, aggregatedOutput: "6 passed" },
    });
    recorder.recordNotification("item/completed", {
      completedAtMs: 1_752_867_202_000,
      threadId: "thread-private",
      turnId: "turn-private",
      item: { id: "file-private", type: "fileChange", status: "completed", changes: [{ path: "/private/example/src/example.ts", diff: "+synthetic" }] },
    });
    recorder.recordNotification("turn/completed", { threadId: "thread-private", turn: { id: "turn-private", items: [], status: "completed", completedAt: 1_752_867_203 } });

    const capture = recorder.finish();
    expect(capture.complete).toBe(true);
    expect(capture.approvalCoverage).toBe("observed");
    expect(capture.issues).toEqual([]);
    expect(capture.events.map((event) => event.type)).toEqual(["task", "task", "plan", "approval", "approval", "test", "file-change", "completion"]);
    expect(JSON.stringify(capture.events)).not.toContain("thread-private");
    expect(JSON.stringify(capture.events)).not.toContain("/private/example");
    expect(capture.events[5]?.payload.exitCode).toBe(0);
  });

  it("drops raw reasoning and fails closed without a successful terminal event", () => {
    const recorder = new AppServerEvidenceRecorder({ recordedAt: fixedTime });
    recorder.recordNotification("item/reasoning/textDelta", { delta: "private reasoning" });
    recorder.recordNotification("item/completed", { completedAtMs: 1_752_867_200_000, threadId: "thread-private", turnId: "turn-private", item: { id: "reasoning-private", type: "reasoning", content: ["private reasoning"] } });
    recorder.recordNotification("turn/completed", { threadId: "thread-private", turn: { id: "turn-private", items: [], status: "failed", error: { message: "synthetic" } } });
    const capture = recorder.finish();

    expect(capture.complete).toBe(false);
    expect(capture.events).toHaveLength(1);
    expect(JSON.stringify(capture.events)).not.toContain("private reasoning");
    expect(capture.issues).toEqual(["App Server turn completed with status: failed."]);
  });

  it("flags unmatched approval decisions", () => {
    const recorder = new AppServerEvidenceRecorder({ recordedAt: fixedTime });
    recorder.recordApprovalDecision("unknown", "decline");
    const capture = recorder.finish();
    expect(capture.complete).toBe(false);
    expect(capture.issues).toContain("An approval decision did not match a recorded approval request.");
  });
});
