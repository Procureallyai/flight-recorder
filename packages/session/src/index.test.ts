import { execFileSync } from "node:child_process";
import { chmod, lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalSession } from "./index.js";

const policy = {
  redactionPolicyDisplayed: true,
  storagePolicyDisplayed: true,
  acknowledged: true,
} as const;

async function createRepository(): Promise<{ allowedRoot: string; repositoryPath: string }> {
  const allowedRoot = await mkdtemp(join(tmpdir(), "flight-recorder-session-root-"));
  const repositoryPath = join(allowedRoot, "repository");
  await mkdir(repositoryPath);
  execFileSync("git", ["init", "-q"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Synthetic Builder"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.email", "synthetic@example.invalid"], { cwd: repositoryPath });
  await writeFile(join(repositoryPath, "README.md"), "# Synthetic repository\n", "utf8");
  await writeFile(join(repositoryPath, ".gitignore"), ".flight-recorder/\n", "utf8");
  execFileSync("git", ["add", "README.md", ".gitignore"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-q", "-m", "Initial synthetic commit"], { cwd: repositoryPath });
  return { allowedRoot, repositoryPath };
}

describe("createLocalSession", () => {
  it("captures a clean Git baseline and writes permission-restricted private state", async () => {
    const repository = await createRepository();
    const session = await createLocalSession({
      ...repository,
      task: "Implement a synthetic change.",
      acceptanceCriteria: ["The synthetic test passes."],
      policy,
    }, {
      now: () => "2026-07-18T22:00:00.000Z",
      sessionId: () => `fr_${"a".repeat(32)}`,
    });

    expect(session.baseline.dirty).toBe(false);
    expect(session.baseline.commit).toMatch(/^[a-f0-9]{40}$/u);
    expect((await lstat(session.storageDirectory)).mode & 0o777).toBe(0o700);
    expect((await lstat(join(session.storageDirectory, "session.json"))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(join(session.storageDirectory, "git-baseline.json"), "utf8"))).toMatchObject({ dirty: false });
  });

  it("records a dirty baseline without storing raw status output", async () => {
    const repository = await createRepository();
    await writeFile(join(repository.repositoryPath, "private-untracked-name.txt"), "synthetic", "utf8");
    const session = await createLocalSession({
      ...repository,
      task: "Inspect the dirty repository.",
      acceptanceCriteria: ["Dirty state is recorded."],
      policy,
    }, { sessionId: () => `fr_${"b".repeat(32)}` });

    expect(session.baseline.dirty).toBe(true);
    expect(JSON.stringify(session.baseline)).not.toContain("private-untracked-name");
  });

  it("rejects a repository outside the explicit allowed root", async () => {
    const repository = await createRepository();
    const differentRoot = await mkdtemp(join(tmpdir(), "flight-recorder-different-root-"));
    await expect(createLocalSession({
      repositoryPath: repository.repositoryPath,
      allowedRoot: differentRoot,
      task: "Synthetic task.",
      acceptanceCriteria: ["One criterion."],
      policy,
    })).rejects.toThrow("outside");
  });

  it("requires explicit display and acknowledgement of both policies", async () => {
    const repository = await createRepository();
    await expect(createLocalSession({
      ...repository,
      task: "Synthetic task.",
      acceptanceCriteria: ["One criterion."],
      policy: { ...policy, acknowledged: false },
    })).rejects.toThrow();
  });

  it("fails closed when private state is not ignored by Git", async () => {
    const repository = await createRepository();
    await writeFile(join(repository.repositoryPath, ".gitignore"), "", "utf8");
    await expect(createLocalSession({
      ...repository,
      task: "Synthetic task.",
      acceptanceCriteria: ["One criterion."],
      policy,
    })).rejects.toThrow("must ignore .flight-recorder");
  });

  it("rejects symbolic-link private storage", async () => {
    const repository = await createRepository();
    const outside = await mkdtemp(join(tmpdir(), "flight-recorder-state-outside-"));
    await symlink(outside, join(repository.repositoryPath, ".flight-recorder"));
    await expect(createLocalSession({
      ...repository,
      task: "Synthetic task.",
      acceptanceCriteria: ["One criterion."],
      policy,
    })).rejects.toThrow("symbolic links");
    await chmod(outside, 0o700);
  });
});
