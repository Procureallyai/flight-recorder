import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
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
});
