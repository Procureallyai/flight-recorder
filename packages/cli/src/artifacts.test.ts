import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectArtifacts } from "./artifacts.js";

describe("collectArtifacts", () => {
  it("rejects a symbolic link before reading outside the artifact root", async () => {
    const root = await mkdtemp(join(tmpdir(), "flight-recorder-artifacts-"));
    const sourcePassport = join(process.cwd(), "fixtures/demo-passport/passport.json");
    const passportPath = join(root, "passport.json");
    const artifactRoot = join(root, "artifacts");
    const outsidePath = join(root, "outside.ts");
    const linkedPath = join(artifactRoot, "src/password-reset.ts");
    await mkdir(dirname(linkedPath), { recursive: true });
    await mkdir(join(artifactRoot, "test"), { recursive: true });
    await writeFile(passportPath, await readFile(sourcePassport));
    await writeFile(outsidePath, "synthetic outside content", "utf8");
    await writeFile(join(artifactRoot, "test/password-reset.test.ts"), "synthetic", "utf8");
    await symlink(outsidePath, linkedPath);

    await expect(collectArtifacts(passportPath, artifactRoot)).rejects.toThrow("Symbolic links are not permitted");
  });
});
