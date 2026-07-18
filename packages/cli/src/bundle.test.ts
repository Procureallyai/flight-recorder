import { mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportPassportBundle, verifyPassportBundle } from "./bundle.js";

async function exportedFixture(): Promise<string> {
  const outputParent = await mkdtemp(join(tmpdir(), "flight-recorder-bundle-"));
  return exportPassportBundle(
    "fixtures/demo-passport/passport.json",
    "fixtures/demo-passport/artifacts",
    outputParent,
  );
}

describe("portable passport bundle", () => {
  it("exports and independently verifies the complete deterministic directory", async () => {
    const bundle = await exportedFixture();
    const result = await verifyPassportBundle(bundle);

    expect(result.valid).toBe(true);
    expect(result.bundle.valid).toBe(true);
    expect(await readFile(join(bundle, "signature.ed25519"), "utf8")).toMatch(/^[A-Za-z0-9+/]+=*\n$/u);
    expect(await readFile(join(bundle, "report.html"), "utf8")).toContain("does not prove software correctness");
    expect(await readFile(join(bundle, "reviews/security.json"), "utf8")).toContain("finding-security-001");
  });

  it("detects a changed derived report", async () => {
    const bundle = await exportedFixture();
    await writeFile(join(bundle, "report.html"), "changed report", "utf8");

    const result = await verifyPassportBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.bundle.changedDerivedFiles).toContain("report.html");
  });

  it("detects missing, unexpected, and changed covered files", async () => {
    const bundle = await exportedFixture();
    const coveredArtifact = join(bundle, "artifacts/src/password-reset.ts");
    const original = await readFile(coveredArtifact, "utf8");
    await writeFile(coveredArtifact, `${original} `, "utf8");
    await unlink(join(bundle, "task.json"));
    await writeFile(join(bundle, "unexpected.txt"), "unexpected", "utf8");

    const result = await verifyPassportBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.checks.find((check) => check.name === "artifacts")?.valid).toBe(false);
    expect(result.bundle.missingFiles).toContain("task.json");
    expect(result.bundle.unexpectedFiles).toContain("unexpected.txt");
    expect(result.bundle.changedDerivedFiles).toContain("bundle-index.json");
  });

  it("rejects symbolic links before reading their target", async () => {
    const bundle = await exportedFixture();
    const report = join(bundle, "report.html");
    const outside = join(await mkdtemp(join(tmpdir(), "flight-recorder-bundle-outside-")), "outside.html");
    await writeFile(outside, "outside", "utf8");
    await unlink(report);
    await symlink(outside, report);

    await expect(verifyPassportBundle(bundle)).rejects.toThrow("Symbolic links are not permitted");
  });
});
