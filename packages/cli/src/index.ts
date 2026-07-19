#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import {
  buildEventChain,
  calculateMerkleRoot,
  createDeterministicDemoKeyPair,
  describeArtifact,
  sha256,
  sealManifest,
  verifyEventChain,
} from "@flight-recorder/crypto";
import { importExecJsonLines } from "@flight-recorder/codex-adapter";
import {
  assertFinalStateEvidenceEnvelope,
  createReviewDigestFromExecCapture,
  createFinalArtifactSnapshot,
  finalStateEvidenceEnvelopeSchema,
  reviewableExecCaptureSchema,
} from "@flight-recorder/evidence";
import { assembleManifest } from "@flight-recorder/passport";
import { evaluateSealGate, genuineReviewArtifactSchema, toPassportReviewFindings } from "@flight-recorder/review";
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
    findingDecisions: [],
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

const demoScope = [
  { id: "artifact_source", path: "src/password-reset.ts", mediaType: "text/typescript" },
  { id: "artifact_tests", path: "test/password-reset.test.ts", mediaType: "text/typescript" },
  { id: "artifact_task", path: "CODEX_TASK.md", mediaType: "text/markdown" },
  { id: "artifact_package", path: "package.json", mediaType: "application/json" },
] as const;

async function writeJsonAtomically(outputFile: string, value: unknown): Promise<void> {
  const outputPath = resolve(outputFile);
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = join(dirname(outputPath), `.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporaryPath, outputPath);
}

function gitText(argumentsForGit: string[], cwd: string): string {
  return execFileSync("git", argumentsForGit, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1_000_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function gitRaw(argumentsForGit: string[], cwd: string): string {
  return execFileSync("git", argumentsForGit, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1_000_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function finaliseDemoCapture(captureFile: string, workspaceRoot: string, outputFile: string): Promise<void> {
  const capture = reviewableExecCaptureSchema.parse(JSON.parse(await readFile(resolve(captureFile), "utf8")));
  if (!verifyEventChain(capture.events)) throw new Error("The input capture does not contain a valid event chain.");
  if (capture.events.some((event) => event.type === "completion" && event.payload.recordKind === "final-git-state")) {
    throw new Error("The input capture already contains final Git-state evidence.");
  }

  const workspace = await realpath(resolve(workspaceRoot));
  const repositoryRoot = await realpath(gitText(["rev-parse", "--show-toplevel"], workspace));
  const repositoryPrefix = gitText(["rev-parse", "--show-prefix"], workspace);
  const workspaceFromRepository = relative(repositoryRoot, workspace);
  if (
    workspaceFromRepository === ".." ||
    workspaceFromRepository.startsWith("../") ||
    resolve(repositoryRoot, workspaceFromRepository) !== workspace
  ) {
    throw new Error("The workspace root must be inside its resolved Git repository.");
  }
  const finalCommit = gitText(["rev-parse", "--verify", "HEAD^{commit}"], repositoryRoot);
  const repositoryScopePaths = demoScope.map((artifact) => `${repositoryPrefix}${artifact.path}`);
  const initialStatus = gitText(["status", "--porcelain=v1", "--untracked-files=all", "--", ...repositoryScopePaths], repositoryRoot);
  if (initialStatus !== "") throw new Error("Covered public demonstration paths are not clean at the final Git commit.");

  const startedAt = Date.now();
  const testRun = spawnSync("npm", ["test"], {
    cwd: workspace,
    encoding: "utf8",
    maxBuffer: 1_000_000,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  if (testRun.error !== undefined || testRun.status !== 0) {
    throw new Error("The required post-commit demonstration test did not pass.");
  }
  const postTestStatus = gitText(["status", "--porcelain=v1", "--untracked-files=all", "--", ...repositoryScopePaths], repositoryRoot);
  if (postTestStatus !== "") throw new Error("The post-commit test mutated a covered public demonstration path.");

  // Artifact content is read from committed Git blobs, never from the mutable worktree.
  const artifacts = demoScope.map((artifact) => createFinalArtifactSnapshot(
    `${repositoryPrefix}${artifact.path}`,
    artifact.mediaType,
    gitRaw(["show", `${finalCommit}:${repositoryPrefix}${artifact.path}`], repositoryRoot),
  ));
  const verifiedFinalCommit = gitText(["rev-parse", "--verify", "HEAD^{commit}"], repositoryRoot);
  if (verifiedFinalCommit !== finalCommit) throw new Error("The Git commit changed while final-state evidence was being collected.");
  const finalStatus = gitText(["status", "--porcelain=v1", "--untracked-files=all", "--", ...repositoryScopePaths], repositoryRoot);
  if (finalStatus !== "") throw new Error("Covered public demonstration paths changed while final-state evidence was being collected.");
  const testEvidenceId = `ev_post_commit_test_${finalCommit.slice(0, 12)}`;
  const finalStateEvidenceId = `ev_final_git_state_${finalCommit.slice(0, 12)}`;
  const recordedAt = new Date().toISOString();
  const envelope = finalStateEvidenceEnvelopeSchema.parse({
    schemaVersion: "0.1.0",
    recordKind: "final-git-state",
    finalCommit,
    scopedClean: true,
    scopePaths: [...repositoryScopePaths],
    postCommitPassingTestEvidenceId: testEvidenceId,
    artifacts,
  });
  const drafts = capture.events.map(({ index: _index, previousHash: _previousHash, hash: _hash, ...event }) => event);
  const events = buildEventChain([
    ...drafts,
    {
      id: testEvidenceId,
      recordedAt,
      type: "test",
      summary: "The committed password-reset demonstration passed its post-commit test suite.",
      payload: {
        command: "npm test",
        status: "passed",
        exitCode: 0,
        phase: "post-commit",
        repositoryCommit: finalCommit,
        durationMilliseconds: Math.max(0, Date.now() - startedAt),
      },
    },
    {
      id: finalStateEvidenceId,
      recordedAt: new Date().toISOString(),
      type: "completion",
      summary: "The final committed Git state and covered artifacts were bound to the capture.",
      payload: envelope,
    },
  ]);
  if (!verifyEventChain(events)) throw new Error("The finalised capture event chain could not be verified.");
  assertFinalStateEvidenceEnvelope(envelope, events);
  const finalisedCapture = reviewableExecCaptureSchema.parse({ ...capture, events });
  await writeJsonAtomically(outputFile, finalisedCapture);
  process.stdout.write(`Finalised ${events.length} sanitised events at committed Git state ${finalCommit.slice(0, 12)}.\n`);
}

const genuineAcceptanceCriteria = [
  "Password-reset tokens expire and are single use.",
  "Known and unknown accounts receive the same neutral public response.",
  "Raw reset tokens never enter logs or audit events.",
  "A safe audit event contains no direct account or token identifier.",
  "Concurrent attempts produce exactly one successful redemption.",
  "A safely failed reset action permits retry while the token remains valid.",
  "Dependency failures preserve the neutral response and safe telemetry.",
  "Deterministic automated tests cover every stated acceptance criterion.",
] as const;

async function assembleDemoCandidate(
  captureFile: string,
  outputFile: string,
  reviewFile?: string,
  approvalRequestFile?: string,
): Promise<void> {
  const capture = reviewableExecCaptureSchema.parse(JSON.parse(await readFile(resolve(captureFile), "utf8")));
  if (!verifyEventChain(capture.events)) throw new Error("The finalised capture does not contain a valid event chain.");
  const events = z.array(evidenceEventSchema).parse(capture.events);
  const finalStateRecords = events.filter((event) => event.type === "completion" && event.payload.recordKind === "final-git-state");
  const finalEvent = events.at(-1);
  if (finalEvent === undefined || finalStateRecords.length !== 1 || finalEvent !== finalStateRecords[0]) {
    throw new Error("The final Git-state evidence envelope must be the final and only such event.");
  }
  const envelope = assertFinalStateEvidenceEnvelope(finalEvent.payload, events);
  const firstExpectedPath = demoScope[0].path;
  const firstArtifact = envelope.artifacts.find((artifact) => artifact.path === firstExpectedPath || artifact.path.endsWith(`/${firstExpectedPath}`));
  if (firstArtifact === undefined) throw new Error("The finalised demonstration capture is missing its expected source artifact.");
  const repositoryPrefix = firstArtifact.path.slice(0, firstArtifact.path.length - firstExpectedPath.length);
  const expectedPaths = new Map(demoScope.map((artifact) => [`${repositoryPrefix}${artifact.path}`, artifact]));
  const finalPaths = new Set(envelope.artifacts.map((artifact) => artifact.path));
  const scopePaths = new Set(envelope.scopePaths);
  if (
    finalPaths.size !== demoScope.length ||
    scopePaths.size !== demoScope.length ||
    [...expectedPaths.keys()].some((path) => !finalPaths.has(path) || !scopePaths.has(path))
  ) {
    throw new Error("The finalised demonstration capture must bind all expected public demonstration artifacts.");
  }
  const createdAt = finalEvent.recordedAt;
  const digest = createReviewDigestFromExecCapture(capture);
  const reviewArtifact = reviewFile === undefined
    ? undefined
    : genuineReviewArtifactSchema.parse(JSON.parse(await readFile(resolve(reviewFile), "utf8")));
  if (
    reviewArtifact !== undefined &&
    (reviewArtifact.eventCount !== events.length || reviewArtifact.evidenceDigestSha256 !== digest.inputDigestSha256)
  ) {
    throw new Error("The genuine review artifact is not bound to this finalised capture.");
  }
  const findings = reviewArtifact === undefined ? [] : toPassportReviewFindings(reviewArtifact.run);
  const requiredCriterionFindingIds = ["AC-1", "AC-2", "AC-3-4", "AC-5", "AC-6", "AC-7", "AC-8"];
  const requirementFindings = new Map(
    reviewArtifact?.run.specialists
      .find((review) => review.output.reviewer === "requirements")
      ?.output.findings.map((finding) => [finding.id, finding]) ?? [],
  );
  const sealDecision = reviewArtifact === undefined
    ? {
        ready: false,
        humanApproved: false,
        blockingReasons: ["A genuine GPT-5.6 runtime review and explicit human approval are pending."],
      }
    : evaluateSealGate({
        reviews: reviewArtifact.run,
        evidenceDigestSha256: digest.inputDigestSha256,
        acceptanceCriteria: requiredCriterionFindingIds.map((id) => ({
          id,
          status: requirementFindings.get(id)?.status === "resolved" ? "supported" as const : "unsupported" as const,
        })),
        requiredTests: digest.testResults.map((test) => ({ evidenceId: test.evidenceId, passed: test.status === "passed" })),
        finalGitStateCaptured: true,
        secretScanBlocked: false,
        humanApproved: false,
      });
  const manifest = assembleManifest({
    passportId: `frp_${sha256(`${finalEvent.hash}:${envelope.finalCommit}`).slice(0, 24)}`,
    createdAt,
    evidenceClassification: "genuine-session",
    project: { name: "Synthetic password-reset remediation", repositoryCommit: envelope.finalCommit },
    session: {
      task: "Repair the synthetic password-reset implementation using expiring, single-use tokens without account enumeration or unsafe token logging.",
      acceptanceCriteria: [...genuineAcceptanceCriteria],
    },
    artifacts: envelope.artifacts.map((artifact) => {
      const expected = expectedPaths.get(artifact.path);
      if (expected === undefined || expected.mediaType !== artifact.mediaType) {
        throw new Error("The finalised demonstration artifact metadata does not match the expected public scope.");
      }
      return { id: expected.id, path: artifact.path, mediaType: artifact.mediaType, content: artifact.content };
    }),
    events,
    findings,
    findingDecisions: [],
    ...(reviewArtifact === undefined ? {} : { reviewProvenance: reviewArtifact.provenance }),
    sealDecision,
  });
  await writeJsonAtomically(outputFile, manifest);
  if (reviewArtifact !== undefined) {
    if (approvalRequestFile === undefined) throw new Error("A reviewed candidate requires a human approval request output path.");
    const decisionFindings = findings.filter((finding) => finding.severity !== "informational");
    await writeJsonAtomically(approvalRequestFile, {
      schemaVersion: "0.1.0",
      recordKind: "human-seal-approval-request",
      status: "awaiting-human",
      passportId: manifest.passportId,
      repositoryCommit: envelope.finalCommit,
      evidenceDigestSha256: digest.inputDigestSha256,
      model: reviewArtifact.run.synthesis.model,
      modelVerdict: reviewArtifact.run.synthesis.output.verdict,
      reviewSummary: reviewArtifact.run.synthesis.output.summary,
      narrowClaim: manifest.claim,
      requiredFindingDecisionIds: decisionFindings.map((finding) => finding.id),
      residualFindings: decisionFindings.map((finding) => ({
        findingId: finding.id,
        severity: finding.severity,
        title: finding.title,
        resolvedByReviewer: finding.resolved,
      })),
      limitations: [...new Set([
        ...reviewArtifact.run.specialists.flatMap((review) => review.output.limitations),
        ...reviewArtifact.run.synthesis.output.limitations,
      ])],
    });
  }
  process.stdout.write(`Assembled ${reviewArtifact === undefined ? "unreviewed" : "review-bound"} unsealed genuine-session candidate ${manifest.passportId}.\n`);
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
    const safeFinalisationMessages = new Set([
      "The input capture does not contain a valid event chain.",
      "The input capture already contains final Git-state evidence.",
      "The workspace root must be inside its resolved Git repository.",
      "Covered public demonstration paths are not clean at the final Git commit.",
      "The required post-commit demonstration test did not pass.",
      "The post-commit test mutated a covered public demonstration path.",
      "The Git commit changed while final-state evidence was being collected.",
      "Covered public demonstration paths changed while final-state evidence was being collected.",
      "The finalised capture event chain could not be verified.",
    ]);
    if (safeFinalisationMessages.has(error.message)) {
      return { code: "command-failed", message: error.message };
    }
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
  } else if (command === "finalise-demo-capture" && first !== undefined && second !== undefined && third !== undefined) {
    await finaliseDemoCapture(first, second, third);
  } else if (command === "assemble-demo-candidate" && first !== undefined && second !== undefined) {
    await assembleDemoCandidate(first, second);
  } else if (command === "bind-demo-review" && first !== undefined && second !== undefined && third !== undefined && fourth !== undefined) {
    await assembleDemoCandidate(first, third, second, fourth);
  } else if (command === "export-bundle" && first !== undefined && second !== undefined && third !== undefined) {
    await exportBundle(first, second, third);
  } else if (command === "verify-bundle" && first !== undefined) {
    await verifyBundle(first, argumentsAfterExecutable.includes("--json"));
  } else if (command === "init-session" && first !== undefined) {
    await initialiseSession(first, argumentsAfterExecutable.includes("--json"));
  } else {
    process.stderr.write("Usage: flight-recorder init-session <request.json> [--json] | generate-demo | verify <passport.json> <artifact-directory> [--json] | export-bundle <passport.json> <artifact-directory> <output-parent> | verify-bundle <passport-directory> [--json] | import-exec-json <raw.jsonl> <sanitised.json> [codex-version] [repository-root] | finalise-demo-capture <capture.json> <workspace-root> <finalised-capture.json> | assemble-demo-candidate <finalised-capture.json> <candidate.json> | bind-demo-review <finalised-capture.json> <review.json> <candidate.json> <approval-request.json>\n");
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
