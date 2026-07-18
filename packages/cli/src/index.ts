#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  buildEventChain,
  calculateMerkleRoot,
  createDeterministicDemoKeyPair,
  describeArtifact,
  sha256,
  sealManifest,
} from "@flight-recorder/crypto";
import { importExecJsonLines } from "@flight-recorder/codex-adapter";
import { assembleManifest } from "@flight-recorder/passport";
import { evidenceEventSchema, type PassportManifest } from "@flight-recorder/schema";
import { createLocalSession } from "@flight-recorder/session";
import { verifyPassport } from "@flight-recorder/verifier";
import { z } from "zod";
import { collectArtifacts } from "./artifacts.js";
import { exportPassportBundle, verifyPassportBundle } from "./bundle.js";

const demoArtifacts = {
  "src/password-reset.ts": `export async function requestPasswordReset(email: string) {
  const token = await issueSingleUseToken(email, { expiresInMinutes: 15 });
  await audit("password_reset_requested", { accountRef: pseudonymise(email) });
  return { accepted: true, message: "If the account exists, reset instructions will be sent." };
}
`,
  "test/password-reset.test.ts": `describe("requestPasswordReset", () => {
  it("returns the same response for known and unknown accounts", async () => {});
  it("does not log the raw reset token", async () => {});
  it("expires and consumes reset tokens once", async () => {});
});
`,
};

async function generateDemo(): Promise<void> {
  const outputRoot = resolve("fixtures/demo-passport");
  const artifactRoot = join(outputRoot, "artifacts");
  const artifacts = [];
  for (const [path, content] of Object.entries(demoArtifacts)) {
    const outputPath = join(artifactRoot, path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
    artifacts.push(describeArtifact(`artifact-${artifacts.length + 1}`, path, "text/typescript", content));
  }

  const events = buildEventChain([
    {
      id: "event-001",
      recordedAt: "2026-07-18T12:00:00.000+00:00",
      type: "task",
      summary: "Synthetic fixture models receipt of the password-reset task and acceptance criteria.",
      payload: { acceptanceCriteriaCount: 4, simulated: true },
    },
    {
      id: "event-002",
      recordedAt: "2026-07-18T12:08:00.000+00:00",
      type: "review",
      summary: "Synthetic fixture models a security finding; no runtime model call is claimed.",
      payload: { findingIds: ["finding-security-001"], simulated: true },
    },
    {
      id: "event-003",
      recordedAt: "2026-07-18T12:16:00.000+00:00",
      type: "file-change",
      summary: "Synthetic fixture models remediation; no genuine Codex session is claimed.",
      payload: { artifactIds: ["artifact-1", "artifact-2"], simulated: true },
    },
    {
      id: "event-004",
      recordedAt: "2026-07-18T12:20:00.000+00:00",
      type: "test",
      summary: "Synthetic fixture includes five intended test scenarios; no executed test result is claimed.",
      payload: { intendedTestCount: 5, simulated: true },
    },
    {
      id: "event-005",
      recordedAt: "2026-07-18T12:22:00.000+00:00",
      type: "approval",
      summary: "Synthetic fixture models an approval state; no actual human approval is claimed.",
      payload: { decision: "synthetic-approved-state", simulated: true },
    },
  ]);

  const manifest: PassportManifest = {
    schemaVersion: "0.1.0",
    passportId: "flight-recorder-demo-001",
    createdAt: "2026-07-18T12:23:00.000+00:00",
    timestampType: "local-recorded-time",
    evidenceClassification: "synthetic-test-fixture",
    project: { name: "Synthetic cryptographic test fixture", repositoryCommit: sha256("not-a-git-commit-synthetic-fixture") },
    session: {
      task: "Implement a password-reset endpoint using expiring, single-use reset tokens.",
      acceptanceCriteria: [
        "Prevent account enumeration.",
        "Do not log raw tokens.",
        "Record a safe audit event.",
        "Test known and unknown accounts.",
      ],
    },
    artifacts,
    events,
    findings: [
      {
        id: "finding-security-001",
        reviewer: "security",
        severity: "blocking",
        title: "Password-reset response and logging defects",
        detail: "The initial implementation revealed account existence and logged a raw reset token. The final artifacts remediate both defects.",
        evidenceIds: ["event-002", "event-003", "event-004"],
        resolved: true,
      },
    ],
    eventChainHead: events.at(-1)?.hash ?? "",
    merkleRoot: calculateMerkleRoot(artifacts, events),
    sealDecision: { ready: true, blockingReasons: [], humanApproved: true },
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  };
  const keys = createDeterministicDemoKeyPair(Buffer.from(sha256("flight-recorder-public-demo-key"), "hex"));
  const passport = sealManifest(manifest, keys.privateKey);
  await mkdir(outputRoot, { recursive: true });
  await writeFile(join(outputRoot, "passport.json"), `${JSON.stringify(passport, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated synthetic test fixture ${relative(process.cwd(), join(outputRoot, "passport.json"))}; this is not genuine session evidence.\n`);
}

async function verify(passportFile: string, artifactRoot: string, jsonOutput: boolean): Promise<void> {
  const passportPath = resolve(passportFile);
  const artifactPath = resolve(artifactRoot);
  const input = JSON.parse(await readFile(passportPath, "utf8")) as unknown;
  const result = verifyPassport(input, await collectArtifacts(passportPath, artifactPath));
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    for (const check of result.checks) {
      process.stdout.write(`${check.valid ? "PASS" : "FAIL"} ${check.name}: ${check.detail}\n`);
    }
  }
  process.exitCode = result.valid ? 0 : 1;
}

async function importExecCapture(inputFile: string, outputFile: string, version: string, repositoryRoot?: string): Promise<void> {
  const raw = await readFile(resolve(inputFile), "utf8");
  const result = importExecJsonLines(raw.split(/\r?\n/u), {
    testedCodexVersion: version,
    ...(repositoryRoot === undefined ? {} : { repositoryRoot: resolve(repositoryRoot) }),
  });
  await mkdir(dirname(resolve(outputFile)), { recursive: true });
  await writeFile(resolve(outputFile), `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`Imported ${result.events.length} sanitised events; complete=${String(result.complete)}; issues=${result.issues.length}.\n`);
  process.exitCode = result.complete ? 0 : 1;
}

async function assembleDemoCandidate(captureFile: string, workspaceRoot: string, outputFile: string, commitArgument: string): Promise<void> {
  const capture = JSON.parse(await readFile(resolve(captureFile), "utf8")) as { events?: unknown };
  const events = z.array(evidenceEventSchema).parse(capture.events);
  const workspace = resolve(workspaceRoot);
  const repositoryCommit = commitArgument === "HEAD"
    ? execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim()
    : commitArgument;
  const createdAt = events.at(-1)?.recordedAt;
  if (createdAt === undefined) throw new Error("The genuine capture contains no completed evidence events.");
  const sourcePath = "src/password-reset.ts";
  const testPath = "test/password-reset.test.ts";
  const manifest = assembleManifest({
    passportId: `frp_${sha256(`${events.at(-1)?.hash ?? ""}:${repositoryCommit}`).slice(0, 24)}`,
    createdAt,
    evidenceClassification: "genuine-session",
    project: { name: "Synthetic password-reset remediation", repositoryCommit },
    session: {
      task: "Repair the synthetic password-reset implementation using expiring, single-use tokens without account enumeration or unsafe token logging.",
      acceptanceCriteria: [
        "Password-reset tokens expire and are single use.",
        "Known and unknown accounts receive the same neutral public response.",
        "Raw reset tokens never enter logs or audit events.",
        "A safe audit event contains no direct account or token identifier.",
        "Automated tests cover both account states and the token contract.",
      ],
    },
    artifacts: [
      { id: "artifact_source", path: sourcePath, mediaType: "text/typescript", content: await readFile(join(workspace, sourcePath)) },
      { id: "artifact_tests", path: testPath, mediaType: "text/typescript", content: await readFile(join(workspace, testPath)) },
    ],
    events,
    findings: [],
    sealDecision: {
      ready: false,
      humanApproved: false,
      blockingReasons: ["A genuine GPT-5.6 runtime review and explicit human approval are pending."],
    },
  });
  await mkdir(dirname(resolve(outputFile)), { recursive: true });
  await writeFile(resolve(outputFile), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`Assembled unsealed genuine-session candidate ${manifest.passportId}.\n`);
}

async function exportBundle(passportFile: string, artifactRoot: string, outputParent: string): Promise<void> {
  const destination = await exportPassportBundle(passportFile, artifactRoot, outputParent);
  process.stdout.write(`Exported portable passport bundle to ${relative(process.cwd(), destination)}.\n`);
}

async function verifyBundle(bundleDirectory: string, jsonOutput: boolean): Promise<void> {
  const result = await verifyPassportBundle(bundleDirectory);
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    for (const check of result.checks) process.stdout.write(`${check.valid ? "PASS" : "FAIL"} ${check.name}: ${check.detail}\n`);
    process.stdout.write(`${result.bundle.valid ? "PASS" : "FAIL"} bundle: deterministic bundle inventory and projections ${result.bundle.valid ? "match" : "do not match"}.\n`);
  }
  process.exitCode = result.valid ? 0 : 1;
}

async function initialiseSession(requestFile: string, jsonOutput: boolean): Promise<void> {
  const request = JSON.parse(await readFile(resolve(requestFile), "utf8")) as unknown;
  const session = await createLocalSession(request);
  const result = {
    sessionId: session.sessionId,
    status: session.status,
    baseline: session.baseline,
    storageDirectory: session.storageDirectory,
  };
  if (jsonOutput) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`Initialised private session ${session.sessionId}; baseline ${session.baseline.commit.slice(0, 8)}; dirty=${String(session.baseline.dirty)}.\n`);
}

interface PublicCommandFailure {
  code: "invalid-json" | "invalid-schema" | "unsafe-input" | "input-limit" | "inaccessible-input" | "command-failed";
  message: string;
}

function classifyCommandFailure(error: unknown): PublicCommandFailure {
  if (error instanceof SyntaxError) return { code: "invalid-json", message: "The input is not valid JavaScript Object Notation." };
  if (error instanceof z.ZodError) return { code: "invalid-schema", message: "The input does not match the required Flight Recorder schema." };
  if (error instanceof Error) {
    if (/symbolic links|escapes the artifact root|portable relative path/iu.test(error.message)) {
      return { code: "unsafe-input", message: "The input contains an unsafe artifact path or symbolic link." };
    }
    if (/exceeds the .*limit|exceed the .*limit/iu.test(error.message)) {
      return { code: "input-limit", message: "The input exceeds a configured safety limit." };
    }
    if (/ENOENT|EACCES|EPERM/iu.test(error.message)) {
      return { code: "inaccessible-input", message: "A required local input could not be accessed." };
    }
  }
  return { code: "command-failed", message: "The command failed safely. No input content was printed." };
}

async function main(argumentsAfterExecutable: string[]): Promise<void> {
  const [command, first, second, third, fourth] = argumentsAfterExecutable;
  if (command === "generate-demo") {
    await generateDemo();
  } else if (command === "verify" && first !== undefined && second !== undefined) {
    await verify(first, second, argumentsAfterExecutable.includes("--json"));
  } else if (command === "import-exec-json" && first !== undefined && second !== undefined) {
    await importExecCapture(first, second, third ?? "codex-cli 0.145.0-alpha.18", fourth);
  } else if (command === "assemble-demo-candidate" && first !== undefined && second !== undefined && third !== undefined) {
    await assembleDemoCandidate(first, second, third, fourth ?? "HEAD");
  } else if (command === "export-bundle" && first !== undefined && second !== undefined && third !== undefined) {
    await exportBundle(first, second, third);
  } else if (command === "verify-bundle" && first !== undefined) {
    await verifyBundle(first, argumentsAfterExecutable.includes("--json"));
  } else if (command === "init-session" && first !== undefined) {
    await initialiseSession(first, argumentsAfterExecutable.includes("--json"));
  } else {
    process.stderr.write("Usage: flight-recorder init-session <request.json> [--json] | generate-demo | verify <passport.json> <artifact-directory> [--json] | export-bundle <passport.json> <artifact-directory> <output-parent> | verify-bundle <passport-directory> [--json] | import-exec-json <raw.jsonl> <sanitised.json> [codex-version] [repository-root] | assemble-demo-candidate <capture.json> <workspace-root> <candidate.json> [commit-or-HEAD]\n");
    process.exitCode = 2;
  }
}

const argumentsAfterExecutable = process.argv.slice(2);
try {
  await main(argumentsAfterExecutable);
} catch (error) {
  const failure = classifyCommandFailure(error);
  if (argumentsAfterExecutable.includes("--json")) process.stdout.write(`${JSON.stringify({ valid: false, error: failure })}\n`);
  else process.stderr.write(`ERROR ${failure.code}: ${failure.message}\n`);
  process.exitCode = 1;
}
