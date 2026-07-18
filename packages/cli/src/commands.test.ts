import { cp, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const cli = join(process.cwd(), "packages/cli/dist/index.js");

function runCli(argumentsForCli: string[]) {
  return spawnSync(process.execPath, [cli, ...argumentsForCli], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
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
});
