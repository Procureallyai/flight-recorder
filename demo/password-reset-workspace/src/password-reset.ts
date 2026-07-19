export interface PasswordResetTokenIssuer {
  issue(accountId: string): string;
}

export interface ResetDependencies {
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

  async redeem(token: string, resetAction: (accountId: string) => Promise<void>): Promise<boolean> {
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
      // A failed reset has made no durable change, so a still-valid token may be retried.
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
    const account = await dependencies.findAccountByEmail(email);

    if (account !== undefined) {
      const token = dependencies.tokenStore.issue(account.id);
      await dependencies.sendResetInstructions(account.id, token);
    }
  } catch {
    // Lookup, issuance, and delivery failures must not create an enumeration signal.
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
