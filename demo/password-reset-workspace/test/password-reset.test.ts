import assert from "node:assert/strict";
import test from "node:test";
import { requestPasswordReset, type ResetDependencies } from "../src/password-reset.ts";

function createDependencies(): ResetDependencies {
  return {
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
}

test("known accounts receive reset instructions", async () => {
  const result = await requestPasswordReset("known@example.test", createDependencies());
  assert.equal(result.accepted, true);
});
