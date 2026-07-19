import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryPasswordResetTokenStore,
  requestPasswordReset,
  type PasswordResetWork,
  type PasswordResetTokenIssuer,
  type ResetDependencies,
} from "../src/password-reset.ts";

const SYNTHETIC_EMAIL = "known@example.test";
const SYNTHETIC_ACCOUNT_ID = "account-synthetic-001";
const SYNTHETIC_TOKEN = "token-synthetic-001";

function createDeferredScheduler() {
  const jobs: PasswordResetWork[] = [];

  return {
    scheduler: {
      enqueue(work: PasswordResetWork) {
        jobs.push(work);
      },
    },
    get scheduledCount() {
      return jobs.length;
    },
    async runAll() {
      while (jobs.length > 0) {
        const job = jobs.shift();
        await job?.();
      }
    },
  };
}

function createTokenStore(
  options: {
    now?: number;
    token?: string;
    expiresInMilliseconds?: number;
  } = {},
) {
  let now = options.now ?? 1_000_000;
  const store = new InMemoryPasswordResetTokenStore({
    clock: () => now,
    generateToken: () => options.token ?? SYNTHETIC_TOKEN,
    expiresInMilliseconds: options.expiresInMilliseconds,
  });

  return {
    store,
    setNow(value: number) {
      now = value;
    },
  };
}

function createDependencies(overrides: Partial<ResetDependencies> = {}): ResetDependencies {
  const { store } = createTokenStore();
  const { scheduler } = createDeferredScheduler();
  const dependencies: ResetDependencies = {
    scheduler,
    async findAccountByEmail() {
      return { id: SYNTHETIC_ACCOUNT_ID };
    },
    tokenStore: store,
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
  const deferred = createDeferredScheduler();
  const result = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      scheduler: deferred.scheduler,
      async sendResetInstructions(accountId, token) {
        deliveries.push({ accountId, token });
      },
    }),
  );

  assert.deepEqual(result, neutralResponse);
  assert.deepEqual(deliveries, []);
  assert.equal(deferred.scheduledCount, 1);
  await deferred.runAll();
  assert.deepEqual(deliveries, [{ accountId: SYNTHETIC_ACCOUNT_ID, token: SYNTHETIC_TOKEN }]);
});

test("unknown accounts receive the same neutral response without issuing or delivering", async () => {
  let issueCount = 0;
  let deliveryCount = 0;
  const tokenStore: PasswordResetTokenIssuer = {
    issue() {
      issueCount += 1;
      return "token-synthetic-unexpected";
    },
  };
  const unknownDeferred = createDeferredScheduler();
  const knownDeferred = createDeferredScheduler();

  const unknownResult = await requestPasswordReset(
    "unknown@example.test",
    createDependencies({
      scheduler: unknownDeferred.scheduler,
      async findAccountByEmail() {
        return undefined;
      },
      tokenStore,
      async sendResetInstructions() {
        deliveryCount += 1;
      },
    }),
  );
  const knownResult = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({ scheduler: knownDeferred.scheduler }),
  );

  assert.deepEqual(unknownResult, neutralResponse);
  assert.deepEqual(unknownResult, knownResult);
  assert.equal(unknownDeferred.scheduledCount, 1);
  assert.equal(knownDeferred.scheduledCount, 1);
  assert.equal(issueCount, 0);
  assert.equal(deliveryCount, 0);
  await unknownDeferred.runAll();
  await knownDeferred.runAll();
  assert.equal(issueCount, 0);
  assert.equal(deliveryCount, 0);
});

test("lookup and delivery never run on the response path", async () => {
  const deferred = createDeferredScheduler();
  let lookupCount = 0;
  let deliveryCount = 0;

  const result = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      scheduler: deferred.scheduler,
      async findAccountByEmail() {
        lookupCount += 1;
        return { id: SYNTHETIC_ACCOUNT_ID };
      },
      async sendResetInstructions() {
        deliveryCount += 1;
      },
    }),
  );

  assert.deepEqual(result, neutralResponse);
  assert.equal(deferred.scheduledCount, 1);
  assert.equal(lookupCount, 0);
  assert.equal(deliveryCount, 0);

  await deferred.runAll();
  assert.equal(lookupCount, 1);
  assert.equal(deliveryCount, 1);
});

test("complete telemetry is identifier-free and identical for known and unknown accounts", async () => {
  async function captureTelemetry(email: string, accountExists: boolean) {
    const logs: string[] = [];
    const audits: Array<{ event: string; detail: Record<string, string> }> = [];
    const deferred = createDeferredScheduler();

    await requestPasswordReset(
      email,
      createDependencies({
        scheduler: deferred.scheduler,
        async findAccountByEmail() {
          return accountExists ? { id: SYNTHETIC_ACCOUNT_ID } : undefined;
        },
        log(message) {
          logs.push(message);
        },
        async audit(event, detail) {
          audits.push({ event, detail });
        },
      }),
    );
    await deferred.runAll();

    return { logs, audits };
  }

  const knownTelemetry = await captureTelemetry(SYNTHETIC_EMAIL, true);
  const unknownTelemetry = await captureTelemetry("unknown@example.test", false);

  assert.deepEqual(knownTelemetry, {
    logs: ["Password reset request accepted."],
    audits: [{ event: "password_reset_request_accepted", detail: { result: "accepted" } }],
  });
  assert.deepEqual(unknownTelemetry, knownTelemetry);

  const completeTelemetry = JSON.stringify({ knownTelemetry, unknownTelemetry });
  assert.doesNotMatch(completeTelemetry, /token-synthetic/i);
  assert.doesNotMatch(completeTelemetry, /known@example\.test|unknown@example\.test/i);
  assert.doesNotMatch(completeTelemetry, /account-synthetic/i);
  assert.doesNotMatch(completeTelemetry, /[a-f0-9]{32,}/i);
});

test("tokens work before expiry and are rejected exactly at the expiry boundary", async () => {
  const issuedAt = 5_000;
  const lifetime = 900_000;
  const beforeExpiry = createTokenStore({ now: issuedAt, expiresInMilliseconds: lifetime });
  const beforeToken = beforeExpiry.store.issue(SYNTHETIC_ACCOUNT_ID);
  beforeExpiry.setNow(issuedAt + lifetime - 1);

  assert.equal(beforeToken, SYNTHETIC_TOKEN);
  assert.equal(await beforeExpiry.store.redeem(beforeToken, async () => {}), true);

  const atExpiry = createTokenStore({
    now: issuedAt,
    token: "token-synthetic-expiry-boundary",
    expiresInMilliseconds: lifetime,
  });
  const atExpiryToken = atExpiry.store.issue(SYNTHETIC_ACCOUNT_ID);
  atExpiry.setNow(issuedAt + lifetime);
  let actionCount = 0;

  assert.equal(
    await atExpiry.store.redeem(atExpiryToken, async () => {
      actionCount += 1;
    }),
    false,
  );
  assert.equal(actionCount, 0);
});

test("a successfully redeemed token rejects every repeated redemption", async () => {
  const { store } = createTokenStore();
  const token = store.issue(SYNTHETIC_ACCOUNT_ID);
  let actionCount = 0;
  const resetAction = async () => {
    actionCount += 1;
  };

  assert.equal(await store.redeem(token, resetAction), true);
  assert.equal(await store.redeem(token, resetAction), false);
  assert.equal(await store.redeem(token, resetAction), false);
  assert.equal(actionCount, 1);
});

test("concurrent redemption reserves the token before awaiting the reset action", async () => {
  const { store } = createTokenStore();
  const token = store.issue(SYNTHETIC_ACCOUNT_ID);
  let releaseFirstAction: (() => void) | undefined;
  const firstActionCanFinish = new Promise<void>((resolve) => {
    releaseFirstAction = resolve;
  });
  let actionCount = 0;

  const firstAttempt = store.redeem(token, async () => {
    actionCount += 1;
    await firstActionCanFinish;
  });
  const secondAttempt = store.redeem(token, async () => {
    actionCount += 1;
  });

  assert.equal(await secondAttempt, false);
  releaseFirstAction?.();
  assert.equal(await firstAttempt, true);
  assert.equal(actionCount, 1);
});

test("a failed reset action does not consume the token and permits a later retry", async () => {
  const { store } = createTokenStore();
  const token = store.issue(SYNTHETIC_ACCOUNT_ID);
  const syntheticFailure = new Error("Synthetic reset action failure.");
  let actionCount = 0;

  await assert.rejects(
    store.redeem(token, async () => {
      actionCount += 1;
      throw syntheticFailure;
    }),
    syntheticFailure,
  );

  assert.equal(
    await store.redeem(token, async (accountId) => {
      actionCount += 1;
      assert.equal(accountId, SYNTHETIC_ACCOUNT_ID);
    }),
    true,
  );
  assert.equal(actionCount, 2);
  assert.equal(await store.redeem(token, async () => {}), false);
});

test("lookup, issuance, and delivery failures retain the neutral response and safe telemetry", async () => {
  const failureCases: Array<{ name: string; overrides: Partial<ResetDependencies> }> = [
    {
      name: "lookup",
      overrides: {
        async findAccountByEmail() {
          throw new Error("Synthetic lookup failure containing known@example.test");
        },
      },
    },
    {
      name: "issuance",
      overrides: {
        tokenStore: {
          issue() {
            throw new Error("Synthetic issuance failure containing account-synthetic-001");
          },
        },
      },
    },
    {
      name: "delivery",
      overrides: {
        async sendResetInstructions() {
          throw new Error("Synthetic delivery failure containing token-synthetic-001");
        },
      },
    },
  ];

  for (const failureCase of failureCases) {
    const logs: string[] = [];
    const audits: Array<{ event: string; detail: Record<string, string> }> = [];
    const deferred = createDeferredScheduler();
    const result = await requestPasswordReset(
      SYNTHETIC_EMAIL,
      createDependencies({
        ...failureCase.overrides,
        scheduler: deferred.scheduler,
        log(message) {
          logs.push(message);
        },
        async audit(event, detail) {
          audits.push({ event, detail });
        },
      }),
    );
    await deferred.runAll();

    assert.deepEqual(result, neutralResponse, failureCase.name);
    assert.deepEqual(logs, ["Password reset request accepted."], failureCase.name);
    assert.deepEqual(
      audits,
      [{ event: "password_reset_request_accepted", detail: { result: "accepted" } }],
      failureCase.name,
    );
    assert.doesNotMatch(
      JSON.stringify({ logs, audits }),
      /token-synthetic|account-synthetic|known@example\.test/i,
      failureCase.name,
    );
  }
});

test("logging and audit failures are isolated and retain the neutral response", async () => {
  let auditAfterLogFailureCount = 0;
  const logFailureResult = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      log() {
        throw new Error("Synthetic logging failure containing token-synthetic-001");
      },
      async audit() {
        auditAfterLogFailureCount += 1;
      },
    }),
  );

  let logBeforeAuditFailureCount = 0;
  const auditFailureResult = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      log() {
        logBeforeAuditFailureCount += 1;
      },
      async audit() {
        throw new Error("Synthetic audit failure containing account-synthetic-001");
      },
    }),
  );

  assert.deepEqual(logFailureResult, neutralResponse);
  assert.deepEqual(auditFailureResult, neutralResponse);
  assert.equal(auditAfterLogFailureCount, 1);
  assert.equal(logBeforeAuditFailureCount, 1);
});

test("a stalled audit transport does not delay the neutral response", async () => {
  let resolveAudit: (() => void) | undefined;
  const auditCanFinish = new Promise<void>((resolve) => {
    resolveAudit = resolve;
  });
  let auditStarted = false;

  const result = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      async audit() {
        auditStarted = true;
        await auditCanFinish;
      },
    }),
  );

  assert.deepEqual(result, neutralResponse);
  assert.equal(auditStarted, true);
  resolveAudit?.();
  await auditCanFinish;
});

test("scheduler failure retains the neutral response and safe telemetry", async () => {
  const logs: string[] = [];
  const audits: Array<{ event: string; detail: Record<string, string> }> = [];
  const result = await requestPasswordReset(
    SYNTHETIC_EMAIL,
    createDependencies({
      scheduler: {
        enqueue() {
          throw new Error("Synthetic queue failure containing known@example.test");
        },
      },
      log(message) {
        logs.push(message);
      },
      async audit(event, detail) {
        audits.push({ event, detail });
      },
    }),
  );

  assert.deepEqual(result, neutralResponse);
  assert.deepEqual(logs, ["Password reset request accepted."]);
  assert.deepEqual(audits, [
    { event: "password_reset_request_accepted", detail: { result: "accepted" } },
  ]);
  assert.doesNotMatch(JSON.stringify({ logs, audits }), /known@example\.test/i);
});

test("the default token lifetime is fifteen minutes", async () => {
  const issuedAt = 10_000;
  const { store, setNow } = createTokenStore({ now: issuedAt });
  const token = store.issue(SYNTHETIC_ACCOUNT_ID);
  setNow(issuedAt + 15 * 60 * 1_000);

  assert.equal(await store.redeem(token, async () => {}), false);
});

test("token lifetime rejects zero, negative, non-finite, and not-a-number values", () => {
  for (const invalidLifetime of [
    0,
    -1,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
  ]) {
    assert.throws(
      () => createTokenStore({ expiresInMilliseconds: invalidLifetime }),
      /positive finite number/,
    );
  }
});

test("token issuance rejects empty and duplicate generated values", () => {
  const empty = createTokenStore({ token: "" });
  assert.throws(() => empty.store.issue(SYNTHETIC_ACCOUNT_ID), /empty token/);

  const duplicate = createTokenStore({ token: SYNTHETIC_TOKEN });
  assert.equal(duplicate.store.issue(SYNTHETIC_ACCOUNT_ID), SYNTHETIC_TOKEN);
  assert.throws(() => duplicate.store.issue("account-synthetic-002"), /duplicate token/);
});

test("unknown tokens do not invoke the reset callback", async () => {
  const { store } = createTokenStore();
  let actionCount = 0;

  assert.equal(
    await store.redeem("token-synthetic-unknown", async () => {
      actionCount += 1;
    }),
    false,
  );
  assert.equal(actionCount, 0);
});
