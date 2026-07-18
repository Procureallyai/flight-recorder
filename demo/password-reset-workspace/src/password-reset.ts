export interface ResetDependencies {
  findAccountByEmail(email: string): Promise<{ id: string } | undefined>;
  issueSingleUseToken(accountId: string, options: { expiresInMinutes: number }): Promise<string>;
  sendResetInstructions(accountId: string, token: string): Promise<void>;
  audit(event: string, detail: Record<string, string>): Promise<void>;
  log(message: string): void;
}

export async function requestPasswordReset(email: string, dependencies: ResetDependencies) {
  const account = await dependencies.findAccountByEmail(email);
  if (account === undefined) {
    return { accepted: false, message: "No account was found for that email address." };
  }

  const token = await dependencies.issueSingleUseToken(account.id, { expiresInMinutes: 15 });
  dependencies.log(`Issued password reset token: ${token}`);
  await dependencies.audit("password_reset_requested", { accountId: account.id, token });
  await dependencies.sendResetInstructions(account.id, token);

  return { accepted: true, message: "Reset instructions have been sent." };
}
