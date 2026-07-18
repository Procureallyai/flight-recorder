import assert from "node:assert/strict";
import test from "node:test";
import { requestPasswordReset, type ResetDependencies } from "../src/password-reset.ts";

function createDependencies(overrides: Partial<ResetDependencies> = {}): ResetDependencies {
  const dependencies: ResetDependencies = {
    async findAccountByEmail() {
      return { id: "account-synthetic-001" };
    },
    async issueSingleUseToken() {
      return "token-synthetic-001";
    },
    async sendResetInstructions() {},
    async audit() {},
    log() {},
  };

  return { ...dependencies, ...overrides };
}

const neutralResponse = {
  accepted: true,
  message: "If an account matches that email address, reset instructions will be sent.",
};

test("known accounts receive reset instructions and a neutral response", async () => {
  const deliveries: Array<{ accountId: string; token: string }> = [];
  const dependencies = createDependencies({
    async sendResetInstructions(accountId, token) {
      deliveries.push({ accountId, token });
    },
  });

  const result = await requestPasswordReset("known@example.test", dependencies);

  assert.deepEqual(result, neutralResponse);
  assert.deepEqual(deliveries, [
    { accountId: "account-synthetic-001", token: "token-synthetic-001" },
  ]);
});

test("unknown accounts receive the neutral response without issuing a token", async () => {
  let issueCount = 0;
  let deliveryCount = 0;
  const dependencies = createDependencies({
    async findAccountByEmail() {
      return undefined;
    },
    async issueSingleUseToken() {
      issueCount += 1;
      return "token-synthetic-unexpected";
    },
    async sendResetInstructions() {
      deliveryCount += 1;
    },
  });

  const result = await requestPasswordReset("unknown@example.test", dependencies);

  assert.deepEqual(result, neutralResponse);
  assert.equal(issueCount, 0);
  assert.equal(deliveryCount, 0);
});

test("known and unknown accounts receive exactly equal public responses", async () => {
  const knownResult = await requestPasswordReset("known@example.test", createDependencies());
  const unknownResult = await requestPasswordReset(
    "unknown@example.test",
    createDependencies({
      async findAccountByEmail() {
        return undefined;
      },
    }),
  );

  assert.deepEqual(knownResult, unknownResult);
});

test("logs and audit events are safe and identical for known and unknown accounts", async () => {
  const knownLogs: string[] = [];
  const unknownLogs: string[] = [];
  const knownAudits: Array<{ event: string; detail: Record<string, string> }> = [];
  const unknownAudits: Array<{ event: string; detail: Record<string, string> }> = [];

  await requestPasswordReset(
    "known@example.test",
    createDependencies({
      log(message) {
        knownLogs.push(message);
      },
      async audit(event, detail) {
        knownAudits.push({ event, detail });
      },
    }),
  );

  await requestPasswordReset(
    "unknown@example.test",
    createDependencies({
      async findAccountByEmail() {
        return undefined;
      },
      log(message) {
        unknownLogs.push(message);
      },
      async audit(event, detail) {
        unknownAudits.push({ event, detail });
      },
    }),
  );

  const expectedAudits = [
    { event: "password_reset_request_accepted", detail: { result: "accepted" } },
  ];
  assert.deepEqual(knownLogs, ["Password reset request accepted."]);
  assert.deepEqual(unknownLogs, knownLogs);
  assert.deepEqual(knownAudits, expectedAudits);
  assert.deepEqual(unknownAudits, knownAudits);

  const telemetry = JSON.stringify({ logs: knownLogs, audits: knownAudits });
  assert.doesNotMatch(telemetry, /token-synthetic-001/);
  assert.doesNotMatch(telemetry, /account-synthetic-001/);
  assert.doesNotMatch(telemetry, /known@example\.test/);
});

test("token issuance requires a 15-minute expiry", async () => {
  const receivedOptions: Array<{ expiresInMinutes: number; maxUses: 1 }> = [];
  const dependencies = createDependencies({
    async issueSingleUseToken(_accountId, options) {
      receivedOptions.push(options);
      return "token-synthetic-001";
    },
  });

  await requestPasswordReset("known@example.test", dependencies);

  assert.deepEqual(receivedOptions, [{ expiresInMinutes: 15, maxUses: 1 }]);
});

test("one request issues one token under the single-use contract", async () => {
  let issueCount = 0;
  const dependencies = createDependencies({
    async issueSingleUseToken(_accountId, options) {
      issueCount += 1;
      assert.equal(options.maxUses, 1);
      return "token-synthetic-001";
    },
  });

  await requestPasswordReset("known@example.test", dependencies);

  assert.equal(issueCount, 1);
});
