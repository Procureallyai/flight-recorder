#!/usr/bin/env node
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
import type { PassportManifest } from "@flight-recorder/schema";
import { verifyPassport } from "@flight-recorder/verifier";
import { collectArtifacts } from "./artifacts.js";

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

async function verify(passportFile: string, artifactRoot: string): Promise<void> {
  const passportPath = resolve(passportFile);
  const artifactPath = resolve(artifactRoot);
  const input = JSON.parse(await readFile(passportPath, "utf8")) as unknown;
  const result = verifyPassport(input, await collectArtifacts(passportPath, artifactPath));
  for (const check of result.checks) {
    process.stdout.write(`${check.valid ? "PASS" : "FAIL"} ${check.name}: ${check.detail}\n`);
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

const [command, first, second, third, fourth] = process.argv.slice(2);
if (command === "generate-demo") {
  await generateDemo();
} else if (command === "verify" && first !== undefined && second !== undefined) {
  await verify(first, second);
} else if (command === "import-exec-json" && first !== undefined && second !== undefined) {
  await importExecCapture(first, second, third ?? "codex-cli 0.145.0-alpha.18", fourth);
} else {
  process.stderr.write("Usage: flight-recorder generate-demo | verify <passport.json> <artifact-directory> | import-exec-json <raw.jsonl> <sanitised.json> [codex-version] [repository-root]\n");
  process.exitCode = 2;
}
