import { describe, expect, it } from "vitest";
import { AppServerClient } from "./app-server.js";

const fakeServer = String.raw`
process.stdin.setEncoding("utf8");
let buffer = "";
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line !== "") {
      const message = JSON.parse(line);
      if (message.method === "initialize") send({ id: message.id, result: { userAgent: "synthetic-codex", platformFamily: "unix", platformOs: "macos" } });
      if (message.method === "initialized") {
        send({ method: "item/reasoning/textDelta", params: { delta: "private reasoning" } });
        send({ method: "turn/plan/updated", params: { plan: [{ step: "Synthetic", status: "inProgress" }] } });
      }
      if (message.method === "thread/start") {
        send({ id: message.id, result: { thread: { id: "thread_synthetic" } } });
        send({ id: "approval_synthetic", method: "item/commandExecution/requestApproval", params: { command: "synthetic command" } });
      }
      if (message.id === "approval_synthetic" && message.result?.decision === "decline") send({ method: "serverRequest/resolved", params: { requestId: message.id } });
      if (message.method === "turn/start") send({ id: message.id, result: { turn: { id: "turn_synthetic" } } });
      if (message.method === "turn/interrupt") send({ id: message.id, result: {} });
    }
    newline = buffer.indexOf("\n");
  }
});
`;

describe("AppServerClient", () => {
  it("correlates narrow requests, suppresses reasoning, and delivers approval requests", async () => {
    const notifications: string[] = [];
    const serverRequests: Array<{ id: string | number; method: string }> = [];
    let client: AppServerClient;
    client = new AppServerClient({
      executable: process.execPath,
      argumentsPrefix: ["-e", fakeServer, "--"],
      onNotification: (method) => notifications.push(method),
      onServerRequest: (request) => {
        serverRequests.push({ id: request.id, method: request.method });
        client.respondToApproval(request.id, "decline");
      },
    });
    try {
      const initialised = await client.start();
      expect(initialised).toEqual({ userAgent: "synthetic-codex", platformFamily: "unix", platformOs: "macos" });
      const thread = await client.startThread("/synthetic/repository", { ephemeral: true });
      expect(thread.id).toBe("thread_synthetic");
      const turn = await client.startTurn(thread.id, "Perform a synthetic task.");
      expect(turn.id).toBe("turn_synthetic");
      await client.interruptTurn(thread.id, turn.id);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(notifications).toContain("turn/plan/updated");
      expect(notifications).toContain("serverRequest/resolved");
      expect(notifications.some((method) => method.includes("reasoning"))).toBe(false);
      expect(serverRequests).toEqual([{ id: "approval_synthetic", method: "item/commandExecution/requestApproval" }]);
    } finally {
      await client.close();
    }
  });

  it("fails closed when the protocol emits malformed output", async () => {
    const malformedServer = `process.stdin.once("data", () => process.stdout.write("not-json\\n"));`;
    const client = new AppServerClient({ executable: process.execPath, argumentsPrefix: ["-e", malformedServer, "--"], requestTimeoutMs: 1_000 });
    await expect(client.start()).rejects.toThrow("malformed");
    await client.close();
  });
});
