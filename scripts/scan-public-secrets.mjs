#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const patterns = [
  { label: "OpenAI-style secret", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/gu },
  { label: "GitHub token", pattern: /\b(?:gh[opusr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu },
  { label: "Amazon Web Services access key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { label: "Private key block", pattern: /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/gu },
  { label: "Bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/gu },
];

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

export function scanPublicText(file, content, options = {}) {
  const findings = [];
  try {
    const feedbackSessionId = options.feedbackSessionId?.trim();
    if (feedbackSessionId && content.includes(feedbackSessionId)) {
      findings.push({
        file,
        line: lineNumber(content, content.indexOf(feedbackSessionId)),
        label: "Private feedback Session Identifier",
      });
    }
  } catch {
    // Treat optional local comparison input as unavailable without weakening the static scans below.
  }

  for (const { label, pattern } of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[0];
      // Explicitly synthetic examples are safe fixtures, not usable credentials.
      if (/synthetic|example|placeholder|redacted/iu.test(value)) continue;
      findings.push({ file, line: lineNumber(content, match.index), label });
    }
  }

  if (!options.allowSyntheticHomePaths) {
    const homePathPatterns = [
      /\/Users\/[A-Za-z0-9._-]+(?:\/|\b)/gu,
      /\/home\/[A-Za-z0-9._-]+(?:\/|\b)/gu,
      /\b[A-Za-z]:\\Users\\[A-Za-z0-9._-]+(?:\\|\b)/gu,
    ];
    for (const pattern of homePathPatterns) {
      for (const match of content.matchAll(pattern)) {
        findings.push({ file, line: lineNumber(content, match.index), label: "Absolute local home path" });
      }
    }

    for (const match of content.matchAll(/(?:^|[\s`"'])[^\s`"']*\.codex\/generated_images\/[^\s`"']+/gmu)) {
      findings.push({ file, line: lineNumber(content, match.index), label: "Private local generated-image path" });
    }
  }

  if (file.startsWith("fixtures/")) {

    // Captured Unix directory listings expose their owner in the third column. Public fixtures use [USER].
    const unixListingPattern = /(?:^|\\n|\n)(?:d|l|-)[rwx@+.-]{9,12}\s+\d+\s+(\S+)\s+\S+\s+/gmu;
    for (const match of content.matchAll(unixListingPattern)) {
      if (match[1] === "[USER]") continue;
      findings.push({ file, line: lineNumber(content, match.index), label: "Local account name in command output" });
    }
  }

  return findings;
}

async function readFeedbackSessionId() {
  try {
    const localSource = JSON.parse(await readFile("docs/submission/submission-secrets.local.json", "utf8"));
    return typeof localSource.feedbackSessionId === "string" ? localSource.feedbackSessionId : undefined;
  } catch {
    return undefined;
  }
}

export async function scanPublicFiles(trackedFiles) {
  const feedbackSessionId = await readFeedbackSessionId();
  const findings = [];
  for (const file of trackedFiles) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    findings.push(...scanPublicText(file, content, {
      feedbackSessionId,
      allowSyntheticHomePaths: file === "scripts/scan-public-secrets.test.mjs",
    }));
  }
  return findings;
}

async function main() {
  const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const findings = await scanPublicFiles(trackedFiles);
  if (findings.length === 0) {
    process.stdout.write(`Secret and privacy scan passed across ${trackedFiles.length} public files; no values were printed.\n`);
    return;
  }

  for (const finding of findings) process.stderr.write(`${finding.file}:${finding.line}: ${finding.label}\n`);
  process.stderr.write(`Secret and privacy scan failed with ${findings.length} potential finding(s); values were not printed.\n`);
  process.exitCode = 1;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
