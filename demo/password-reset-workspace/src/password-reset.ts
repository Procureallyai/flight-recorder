export interface PasswordResetTokenIssuer {
  issue(accountId: string): string;
}

export type PasswordResetWork = () => Promise<void>;

/**
 * Enqueues work without running it on the caller's response path.
 *
 * Implementations must return before invoking `work`. A production service
 * should use a durable queue; this synthetic workspace injects the boundary so
 * tests can prove that account lookup and delivery are deferred uniformly.
 */
export interface PasswordResetWorkScheduler {
  enqueue(work: PasswordResetWork): void;
}

export interface ResetDependencies {
  scheduler: PasswordResetWorkScheduler;
  findAccountByEmail(email: string): Promise<{ id: string } | undefined>;
  tokenStore: PasswordResetTokenIssuer;
  sendResetInstructions(accountId: string, token: string): Promise<void>;
  audit(event: string, detail: Record<string, string>): Promise<void>;
  log(message: string): void;
}

export interface PasswordResetTokenStoreOptions {
  clock: () => number;
  generateToken: () => string;
  expiresInMilliseconds?: number;
}

type TokenState = "active" | "redeeming" | "consumed";

interface TokenRecord {
  accountId: string;
  expiresAt: number;
  state: TokenState;
}

/**
 * The callback must either complete its durable reset atomically or be safe to
 * invoke again after rejection. A rejection reactivates a still-valid token,
 * so callers must roll back partial changes or provide idempotent behaviour.
 */
export type PasswordResetAction = (accountId: string) => Promise<void>;

const FIFTEEN_MINUTES_IN_MILLISECONDS = 15 * 60 * 1_000;

/**
 * An expiring token store for this single-process demonstration workspace.
 *
 * The state transition that reserves a token is synchronous and therefore
 * atomic only within one JavaScript process. A production deployment with
 * multiple processes or hosts needs a persistent shared store with a
 * transaction or atomic compare-and-set operation.
 */
export class InMemoryPasswordResetTokenStore implements PasswordResetTokenIssuer {
  readonly #clock: () => number;
  readonly #generateToken: () => string;
  readonly #expiresInMilliseconds: number;
  readonly #records = new Map<string, TokenRecord>();

  constructor(options: PasswordResetTokenStoreOptions) {
    if (
      options.expiresInMilliseconds !== undefined &&
      (!Number.isFinite(options.expiresInMilliseconds) || options.expiresInMilliseconds <= 0)
    ) {
      throw new RangeError("Token lifetime must be a positive finite number.");
    }

    this.#clock = options.clock;
    this.#generateToken = options.generateToken;
    this.#expiresInMilliseconds =
      options.expiresInMilliseconds ?? FIFTEEN_MINUTES_IN_MILLISECONDS;
  }

  issue(accountId: string): string {
    const token = this.#generateToken();

    if (token.length === 0) {
      throw new Error("Token generator returned an empty token.");
    }
    if (this.#records.has(token)) {
      throw new Error("Token generator returned a duplicate token.");
    }

    this.#records.set(token, {
      accountId,
      expiresAt: this.#clock() + this.#expiresInMilliseconds,
      state: "active",
    });

    return token;
  }

  async redeem(token: string, resetAction: PasswordResetAction): Promise<boolean> {
    const record = this.#records.get(token);

    if (record === undefined) {
      return false;
    }

    if (this.#clock() >= record.expiresAt) {
      this.#records.delete(token);
      return false;
    }

    if (record.state !== "active") {
      return false;
    }

    // Shape: active -> redeeming before the first await, reserving one attempt in this process.
    record.state = "redeeming";

    try {
      await resetAction(record.accountId);
      record.state = "consumed";
      return true;
    } catch (error) {
      // Contract: a rejected action was rolled back or is idempotent, so retry remains safe.
      record.state = "active";
      throw error;
    }
  }
}

const PUBLIC_RESPONSE = Object.freeze({
  accepted: true,
  message: "If an account matches that email address, reset instructions will be sent.",
});

const SAFE_LOG_MESSAGE = "Password reset request accepted.";
const SAFE_AUDIT_EVENT = "password_reset_request_accepted";
const SAFE_AUDIT_DETAIL = Object.freeze({ result: "accepted" });

export async function requestPasswordReset(email: string, dependencies: ResetDependencies) {
  try {
    // Shape: every request enqueues one job; account-dependent work begins only off-path.
    dependencies.scheduler.enqueue(async () => {
      try {
        const account = await dependencies.findAccountByEmail(email);

        if (account !== undefined) {
          const token = dependencies.tokenStore.issue(account.id);
          await dependencies.sendResetInstructions(account.id, token);
        }
      } catch {
        // Lookup, issuance, and delivery failures stay inside the asynchronous worker.
      }
    });
  } catch {
    // Queue failures must not create an enumeration signal or change the neutral response.
  }

  try {
    dependencies.log(SAFE_LOG_MESSAGE);
  } catch {
    // Observability failures do not change the public response or expose private context.
  }

  try {
    await dependencies.audit(SAFE_AUDIT_EVENT, SAFE_AUDIT_DETAIL);
  } catch {
    // Audit transport failures remain private and do not prevent the neutral response.
  }

  return PUBLIC_RESPONSE;
}
