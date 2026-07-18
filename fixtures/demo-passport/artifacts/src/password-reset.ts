export async function requestPasswordReset(email: string) {
  const token = await issueSingleUseToken(email, { expiresInMinutes: 15 });
  await audit("password_reset_requested", { accountRef: pseudonymise(email) });
  return { accepted: true, message: "If the account exists, reset instructions will be sent." };
}
