import { cp, mkdir, mkdtemp, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { buildEventChain, sha256 } from "@flight-recorder/crypto";
import type { EvidenceEvent } from "@flight-recorder/schema";
import { describe, expect, it } from "vitest";

const cli = join(process.cwd(), "packages/cli/dist/index.js");

function runCli(argumentsForCli: string[]) {
  return spawnSync(process.execPath, [cli, ...argumentsForCli], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

async function createCaptureFixture(root: string): Promise<string> {
  const capturePath = join(root, "capture.json");
  const events = buildEventChain([{
    id: "ev_capture_complete",
    recordedAt: "2026-07-19T12:00:00.000Z",
    type: "completion",
    summary: "A synthetic local capture completed.",
    payload: { status: "completed" },
  }]);
  await writeFile(capturePath, JSON.stringify({
    source: "codex-exec-json",
    testedCodexVersion: "codex-cli synthetic-test",
    complete: true,
    approvalCoverage: "not-observed",
    issues: [],
    events,
  }), "utf8");
  return capturePath;
}

interface DemoRepositoryOptions {
  failingTest?: boolean;
  mutatingTest?: boolean;
  nestedWorkspace?: boolean;
}

async function createDemoRepository(options: DemoRepositoryOptions = {}): Promise<{ root: string; workspace: string; capturePath: string; commit: string }> {
  const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-finalise-"));
  const workspace = options.nestedWorkspace ? join(root, "demo/password-reset-workspace") : root;
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, "CODEX_TASK.md"), "# Synthetic task\n\nExercise the final-state capture contract.\n", "utf8");
  await writeFile(join(workspace, "package.json"), JSON.stringify({
    name: "synthetic-finaliser-fixture",
    private: true,
    type: "module",
    scripts: { test: "node --test test/password-reset.test.ts" },
  }, null, 2) + "\n", "utf8");
  await cp("demo/password-reset-workspace/src", join(workspace, "src"), { recursive: true });
  await cp("demo/password-reset-workspace/test", join(workspace, "test"), { recursive: true });
  if (options.failingTest) {
    await writeFile(join(workspace, "test/password-reset.test.ts"), `import test from "node:test";\nimport assert from "node:assert/strict";\ntest("fails", () => assert.equal(true, false));\n`, "utf8");
  }
  if (options.mutatingTest) {
    await writeFile(join(workspace, "test/password-reset.test.ts"), `import test from "node:test";\nimport { writeFileSync } from "node:fs";\ntest("mutates a covered file", () => { writeFileSync(new URL("../CODEX_TASK.md", import.meta.url), "# Mutated during test\\n", "utf8"); });\n`, "utf8");
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Synthetic Builder"], { cwd: root });
  execFileSync("git", ["config", "user.email", "synthetic@example.invalid"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "Synthetic final state"], { cwd: root });
  return { root, workspace, capturePath: await createCaptureFixture(root), commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim() };
}

function rebuildEvents(events: EvidenceEvent[]): EvidenceEvent[] {
  return buildEventChain(events.map(({ index: _index, previousHash: _previousHash, hash: _hash, ...event }) => event));
}

describe("flight-recorder command-line interface", () => {
  it("returns machine-readable verification results and exit code zero for a valid passport", () => {
    const result = runCli([
      "verify",
      "fixtures/demo-passport/passport.json",
      "fixtures/demo-passport/artifacts",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as { valid: boolean; checks: Array<{ name: string; valid: boolean }> };
    expect(output.valid).toBe(true);
    expect(output.checks.every((check) => check.valid)).toBe(true);
  });

  it("returns machine-readable failure and exit code one after a covered artifact changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-tamper-"));
    const passportPath = join(root, "passport.json");
    const artifactRoot = join(root, "artifacts");
    await cp("fixtures/demo-passport/passport.json", passportPath);
    await cp("fixtures/demo-passport/artifacts", artifactRoot, { recursive: true });
    const coveredArtifact = join(artifactRoot, "src/password-reset.ts");
    const original = await readFile(coveredArtifact, "utf8");
    await writeFile(coveredArtifact, `${original} `, "utf8");

    const result = runCli(["verify", passportPath, artifactRoot, "--json"]);

    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout) as { valid: boolean; checks: Array<{ name: string; valid: boolean }> };
    expect(output.valid).toBe(false);
    expect(output.checks.find((check) => check.name === "artifacts")?.valid).toBe(false);
  });

  it("returns exit code two when required arguments are missing", () => {
    const result = runCli(["verify"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage: flight-recorder");
  });

  it("fails with a bounded machine-readable error without leaking a local path", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-invalid-json-"));
    const passportPath = join(root, "private-passport.json");
    await writeFile(passportPath, "{not-json", "utf8");

    const result = runCli(["verify", passportPath, root, "--json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain(root);
    expect(JSON.parse(result.stdout)).toEqual({
      valid: false,
      error: {
        code: "invalid-json",
        message: "The input is not valid JavaScript Object Notation.",
      },
    });
  });

  it("exports and verifies a portable bundle through the command-line interface", async () => {
    const outputParent = await mkdtemp(join(tmpdir(), "flight-recorder-cli-bundle-"));
    const exported = runCli([
      "export-bundle",
      "fixtures/demo-passport/passport.json",
      "fixtures/demo-passport/artifacts",
      outputParent,
    ]);
    expect(exported.status).toBe(0);
    const [directoryName] = await readdir(outputParent);
    expect(directoryName).toMatch(/^flight-recorder-.*\.passport$/u);

    const verified = runCli(["verify-bundle", join(outputParent, directoryName!), "--json"]);
    expect(verified.status).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ valid: true, bundle: { valid: true } });
  });

  it("initialises an allowed private session from an explicit policy request", async () => {
    const allowedRoot = await mkdtemp(join(tmpdir(), "flight-recorder-cli-session-"));
    const repositoryPath = join(allowedRoot, "repository");
    await cp("demo/password-reset-workspace", repositoryPath, { recursive: true });
    await writeFile(join(repositoryPath, ".gitignore"), ".flight-recorder/\n", "utf8");
    execFileSync("git", ["init", "-q"], { cwd: repositoryPath });
    execFileSync("git", ["config", "user.name", "Synthetic Builder"], { cwd: repositoryPath });
    execFileSync("git", ["config", "user.email", "synthetic@example.invalid"], { cwd: repositoryPath });
    execFileSync("git", ["add", "."], { cwd: repositoryPath });
    execFileSync("git", ["commit", "-q", "-m", "Synthetic baseline"], { cwd: repositoryPath });
    const requestFile = join(allowedRoot, "request.json");
    await writeFile(requestFile, JSON.stringify({
      repositoryPath,
      allowedRoot,
      task: "Capture a synthetic Codex task.",
      acceptanceCriteria: ["The private session records the Git baseline."],
      policy: { redactionPolicyDisplayed: true, storagePolicyDisplayed: true, acknowledged: true },
    }), "utf8");

    const result = runCli(["init-session", requestFile, "--json"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "initialised", baseline: { dirty: false } });
  });

  it("finalises committed demo evidence atomically and assembles a commit-bound immutable candidate", async () => {
    const fixture = await createDemoRepository({ nestedWorkspace: true });
    const finalisedPath = join(fixture.root, "finalised-capture.json");
    const candidatePath = join(fixture.root, "candidate.json");

    const finalised = runCli(["finalise-demo-capture", fixture.capturePath, fixture.workspace, finalisedPath]);
    expect(finalised.status, finalised.stderr).toBe(0);
    expect((await stat(finalisedPath)).mode & 0o777).toBe(0o600);
    const capture = JSON.parse(await readFile(finalisedPath, "utf8")) as { events: EvidenceEvent[] };
    const finalEvent = capture.events.at(-1)!;
    expect(finalEvent.payload).toMatchObject({
      recordKind: "final-git-state",
      finalCommit: fixture.commit,
      scopedClean: true,
      scopePaths: [
        "demo/password-reset-workspace/src/password-reset.ts",
        "demo/password-reset-workspace/test/password-reset.test.ts",
        "demo/password-reset-workspace/CODEX_TASK.md",
        "demo/password-reset-workspace/package.json",
      ],
    });
    const envelope = finalEvent.payload as { artifacts: Array<{ path: string; content: string; sha256: string }> };
    expect(envelope.artifacts).toHaveLength(4);

    // A later worktree mutation must not alter the capture-bound candidate content.
    await writeFile(join(fixture.workspace, "src/password-reset.ts"), "export const laterMutation = true;\n", "utf8");
    const assembled = runCli(["assemble-demo-candidate", finalisedPath, candidatePath]);
    expect(assembled.status).toBe(0);
    const candidate = JSON.parse(await readFile(candidatePath, "utf8")) as {
      project: { repositoryCommit: string };
      artifacts: Array<{ path: string; sha256: string }>;
    };
    expect(candidate.project.repositoryCommit).toBe(fixture.commit);
    expect(candidate.artifacts).toHaveLength(4);
    const nestedSourcePath = "demo/password-reset-workspace/src/password-reset.ts";
    expect(candidate.artifacts.find((artifact) => artifact.path === nestedSourcePath)?.sha256)
      .toBe(envelope.artifacts.find((artifact) => artifact.path === nestedSourcePath)?.sha256);
    expect(candidate.artifacts.find((artifact) => artifact.path === nestedSourcePath)?.sha256)
      .not.toBe(sha256("export const laterMutation = true;\n"));
  });

  it("rejects a final capture when any covered path is dirty", async () => {
    const fixture = await createDemoRepository();
    await writeFile(join(fixture.workspace, "CODEX_TASK.md"), "# Dirty task\n", "utf8");
    const result = runCli(["finalise-demo-capture", fixture.capturePath, fixture.workspace, join(fixture.root, "finalised.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ERROR command-failed");
  });

  it("rejects a final capture when the committed post-commit test fails", async () => {
    const fixture = await createDemoRepository({ failingTest: true });
    const result = runCli(["finalise-demo-capture", fixture.capturePath, fixture.workspace, join(fixture.root, "finalised.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ERROR command-failed");
  });

  it("rejects a passing post-commit test that mutates a covered path without writing output", async () => {
    const fixture = await createDemoRepository({ mutatingTest: true });
    const outputPath = join(fixture.root, "finalised.json");
    const result = runCli(["finalise-demo-capture", fixture.capturePath, fixture.workspace, outputPath]);
    expect(result.status).toBe(1);
    await expect(stat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects candidate assembly when final-state ordering or commit binding is invalid", async () => {
    const fixture = await createDemoRepository();
    const finalisedPath = join(fixture.root, "finalised-capture.json");
    const finaliseResult = runCli(["finalise-demo-capture", fixture.capturePath, fixture.workspace, finalisedPath]);
    expect(finaliseResult.status, finaliseResult.stderr).toBe(0);
    const capture = JSON.parse(await readFile(finalisedPath, "utf8")) as { events: EvidenceEvent[] };

    const outOfOrderPath = join(fixture.root, "out-of-order.json");
    const outOfOrderEvents = rebuildEvents([...capture.events, {
      id: "ev_after_final_state",
      index: 0,
      recordedAt: "2026-07-19T12:01:00.000Z",
      type: "completion",
      summary: "An invalid event follows final Git state.",
      payload: { status: "completed" },
      previousHash: null,
      hash: "0".repeat(64),
    }]);
    await writeFile(outOfOrderPath, JSON.stringify({
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-test",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events: outOfOrderEvents,
    }), "utf8");
    expect(runCli(["assemble-demo-candidate", outOfOrderPath, join(fixture.root, "bad-order-candidate.json")]).status).toBe(1);

    const mismatchedEvents = capture.events.map((event) => event.type === "completion" && event.payload.recordKind === "final-git-state"
      ? { ...event, payload: { ...event.payload, finalCommit: "0".repeat(40) } }
      : event);
    const mismatchedPath = join(fixture.root, "mismatched.json");
    await writeFile(mismatchedPath, JSON.stringify({
      source: "codex-exec-json",
      testedCodexVersion: "codex-cli synthetic-test",
      complete: true,
      approvalCoverage: "not-observed",
      issues: [],
      events: rebuildEvents(mismatchedEvents),
    }), "utf8");
    expect(runCli(["assemble-demo-candidate", mismatchedPath, join(fixture.root, "bad-binding-candidate.json")]).status).toBe(1);
  });

  it("records the exact human decision, seals with an ephemeral key, verifies, and detects artifact tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-seal-"));
    const passportPath = join(root, "passport.json");
    const artifactRoot = join(root, "artifacts");
    const sealed = runCli([
      "seal-demo-passport",
      "fixtures/demo-session/passport-candidate-reviewed.json",
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      "fixtures/demo-session/human-approval-request.json",
      "fixtures/demo-session/human-seal-decision.json",
      passportPath,
      artifactRoot,
    ]);
    expect(sealed.status, sealed.stderr).toBe(0);
    expect(sealed.stdout).toContain("private signing key was not persisted");

    const passport = JSON.parse(await readFile(passportPath, "utf8")) as {
      manifest: {
        events: EvidenceEvent[];
        findingDecisions: Array<{ findingId: string; decision: string; decisionEventId: string }>;
        sealDecision: { ready: boolean; humanApproved: boolean; blockingReasons: string[] };
      };
    };
    expect(passport.manifest.sealDecision).toEqual({ ready: true, humanApproved: true, blockingReasons: [] });
    expect(passport.manifest.events).toHaveLength(18);
    expect(passport.manifest.findingDecisions).toHaveLength(19);
    expect(passport.manifest.findingDecisions.filter((decision) => decision.decision === "accepted-risk").map((decision) => decision.findingId)).toEqual([
      "tests-TST-003",
      "evidence-F-003",
      "synthesis-SYN-003",
      "synthesis-SYN-004",
    ]);
    const approvalEvent = passport.manifest.events.at(-1)!;
    expect(approvalEvent.type).toBe("approval");
    expect(passport.manifest.findingDecisions.every((decision) => decision.decisionEventId === approvalEvent.id)).toBe(true);
    expect(approvalEvent.payload).toMatchObject({
      recordKind: "human-seal-approval",
      acknowledgedNarrowClaim: true,
      acknowledgedResidualLimitations: true,
    });
    expect(await readdir(root)).not.toContain("private-key.pem");

    const verified = runCli(["verify", passportPath, artifactRoot, "--json"]);
    expect(verified.status, verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout)).toMatchObject({ valid: true });

    const coveredPath = join(artifactRoot, "demo/password-reset-workspace/src/password-reset.ts");
    await writeFile(coveredPath, `${await readFile(coveredPath, "utf8")} `, "utf8");
    const tampered = runCli(["verify", passportPath, artifactRoot, "--json"]);
    expect(tampered.status).toBe(1);
    expect(JSON.parse(tampered.stdout)).toMatchObject({ valid: false });
  });

  it("rejects a seal decision that does not match the reviewed digest or acknowledgements", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-seal-reject-"));
    const source = JSON.parse(await readFile("fixtures/demo-session/human-seal-decision.json", "utf8")) as Record<string, unknown>;
    const mismatchedPath = join(root, "mismatched.json");
    await writeFile(mismatchedPath, JSON.stringify({ ...source, evidenceDigestSha256: "0".repeat(64) }), "utf8");
    expect(runCli([
      "seal-demo-passport",
      "fixtures/demo-session/passport-candidate-reviewed.json",
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      "fixtures/demo-session/human-approval-request.json",
      mismatchedPath,
      join(root, "mismatched-passport.json"),
      join(root, "mismatched-artifacts"),
    ]).status).toBe(1);

    const unacknowledgedPath = join(root, "unacknowledged.json");
    await writeFile(unacknowledgedPath, JSON.stringify({ ...source, acknowledgedResidualLimitations: false }), "utf8");
    expect(runCli([
      "seal-demo-passport",
      "fixtures/demo-session/passport-candidate-reviewed.json",
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      "fixtures/demo-session/human-approval-request.json",
      unacknowledgedPath,
      join(root, "unacknowledged-passport.json"),
      join(root, "unacknowledged-artifacts"),
    ]).status).toBe(1);
  });

  it("rejects review-derived candidate mutation and symbolic-link output parents", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-seal-hardening-"));
    const candidate = JSON.parse(await readFile("fixtures/demo-session/passport-candidate-reviewed.json", "utf8")) as {
      findings: Array<{ title: string }>;
    };
    candidate.findings[0]!.title = "Mutated after the genuine model review";
    const mutatedCandidatePath = join(root, "mutated-candidate.json");
    await writeFile(mutatedCandidatePath, JSON.stringify(candidate), "utf8");
    expect(runCli([
      "seal-demo-passport",
      mutatedCandidatePath,
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      "fixtures/demo-session/human-approval-request.json",
      "fixtures/demo-session/human-seal-decision.json",
      join(root, "mutated-passport.json"),
      join(root, "mutated-artifacts"),
    ]).status).toBe(1);

    const outside = await mkdtemp(join(tmpdir(), "flight-recorder-cli-seal-outside-"));
    const linkedParent = join(root, "linked-parent");
    await symlink(outside, linkedParent);
    const linkedResult = runCli([
      "seal-demo-passport",
      "fixtures/demo-session/passport-candidate-reviewed.json",
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      "fixtures/demo-session/human-approval-request.json",
      "fixtures/demo-session/human-seal-decision.json",
      join(linkedParent, "new-passport-parent", "linked-passport.json"),
      join(linkedParent, "new-artifact-parent", "artifacts"),
    ]);
    expect(linkedResult.status).toBe(1);
    await expect(stat(join(outside, "new-passport-parent"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(outside, "new-artifact-parent"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects approval-request summary and limitation mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-cli-approval-request-"));
    const request = JSON.parse(await readFile("fixtures/demo-session/human-approval-request.json", "utf8")) as {
      reviewSummary: string;
      limitations: string[];
    };
    request.reviewSummary = "Mutated after human review.";
    request.limitations = ["Mutated limitation."];
    const mutatedRequestPath = join(root, "mutated-request.json");
    await writeFile(mutatedRequestPath, JSON.stringify(request), "utf8");
    expect(runCli([
      "seal-demo-passport",
      "fixtures/demo-session/passport-candidate-reviewed.json",
      "fixtures/demo-session/finalised-capture-post-remediation.json",
      "fixtures/demo-session/review-run-post-remediation.json",
      mutatedRequestPath,
      "fixtures/demo-session/human-seal-decision.json",
      join(root, "passport.json"),
      join(root, "artifacts"),
    ]).status).toBe(1);
  });
});
