#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const patterns = [
  { label: "OpenAI-style secret", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/gu },
  { label: "GitHub token", pattern: /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu },
  { label: "Amazon Web Services access key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { label: "Private key block", pattern: /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/gu },
  { label: "Bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/gu },
];

const findings = [];
for (const file of trackedFiles) {
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const { label, pattern } of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[0];
      // Explicitly synthetic examples are safe fixtures, not usable credentials.
      if (/synthetic|example|placeholder|redacted/iu.test(value)) continue;
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({ file, line, label });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) process.stderr.write(`${finding.file}:${finding.line}: ${finding.label}\n`);
  process.stderr.write(`Secret scan failed with ${findings.length} potential finding(s); values were not printed.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret scan passed across ${trackedFiles.length} tracked files; no values were printed.\n`);
}
