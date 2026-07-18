const TEST_COMMAND_PATTERN = /(?:^|\s)(?:(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?(?:test(?::[A-Za-z0-9_-]+)?|vitest)(?:\s|$)|(?:npx\s+|pnpm\s+exec\s+|yarn\s+dlx\s+|bunx\s+)?vitest(?:\s|$)|pytest(?:\s|$)|python\s+-m\s+pytest(?:\s|$)|cargo\s+test(?:\s|$)|go\s+test(?:\s|$)|dotnet\s+test(?:\s|$))/u;

export function isLikelyTestCommand(command: string, additionalPatterns: readonly RegExp[] = []): boolean {
  return TEST_COMMAND_PATTERN.test(command) || additionalPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(command);
  });
}
