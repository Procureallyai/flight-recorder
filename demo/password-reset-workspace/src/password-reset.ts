export interface ResetDependencies {
  findAccountByEmail(email: string): Promise<{ id: string } | undefined>;
  issueSingleUseToken(
    accountId: string,
    options: { expiresInMinutes: number; maxUses: 1 },
  ): Promise<string>;
  sendResetInstructions(accountId: string, token: string): Promise<void>;
  audit(event: string, detail: Record<string, string>): Promise<void>;
  log(message: string): void;
}

const PUBLIC_RESPONSE = Object.freeze({
  accepted: true,
  message: "If an account matches that email address, reset instructions will be sent.",
});

export async function requestPasswordReset(email: string, dependencies: ResetDependencies) {
  const account = await dependencies.findAccountByEmail(email);

  if (account !== undefined) {
    // The token issuer must enforce a 15-minute lifetime and permit exactly one use.
    const token = await dependencies.issueSingleUseToken(account.id, {
      expiresInMinutes: 15,
      maxUses: 1,
    });
    await dependencies.sendResetInstructions(account.id, token);
  }

  // Keep telemetry identical for known and unknown accounts and exclude direct identifiers.
  dependencies.log("Password reset request accepted.");
  await dependencies.audit("password_reset_request_accepted", { result: "accepted" });

  return PUBLIC_RESPONSE;
}
