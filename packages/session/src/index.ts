import { execFile as execFileCallback } from "node:child_process";
import { chmod, lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { sha256 } from "@flight-recorder/crypto";
import { z } from "zod";

const execFile = promisify(execFileCallback);

export const localSessionRequestSchema = z.object({
  repositoryPath: z.string().min(1),
  allowedRoot: z.string().min(1),
  task: z.string().min(1).max(100_000),
  acceptanceCriteria: z.array(z.string().min(1).max(2_000)).min(1).max(100),
  policy: z.object({
    redactionPolicyDisplayed: z.literal(true),
    storagePolicyDisplayed: z.literal(true),
    acknowledged: z.literal(true),
  }).strict(),
}).strict();

export interface LocalSession {
  schemaVersion: "0.1.0";
  sessionId: string;
  createdAt: string;
  repositoryPath: string;
  status: "initialised";
  policy: {
    redactionPolicyDisplayed: true;
    storagePolicyDisplayed: true;
    acknowledged: true;
  };
  baseline: {
    commit: string;
    dirty: boolean;
    statusDigestSha256: string;
    capturedAt: string;
  };
  task: string;
  acceptanceCriteria: string[];
  storageDirectory: string;
}

export interface LocalSessionOptions {
  now?: () => string;
  sessionId?: () => string;
}

async function runGit(repositoryPath: string, argumentsForGit: string[]): Promise<string> {
  const result = await execFile("git", argumentsForGit, {
    cwd: repositoryPath,
    encoding: "utf8",
    maxBuffer: 2_000_000,
    timeout: 15_000,
  });
  return result.stdout;
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function rejectSymlinkIfPresent(path: string): Promise<void> {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error("Private Flight Recorder storage must not use symbolic links.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function writePrivateJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(path, 0o600);
}

export async function createLocalSession(input: unknown, options: LocalSessionOptions = {}): Promise<LocalSession> {
  const request = localSessionRequestSchema.parse(input);
  const repositoryPath = await realpath(resolve(request.repositoryPath));
  const allowedRoot = await realpath(resolve(request.allowedRoot));
  if (!isInside(allowedRoot, repositoryPath)) throw new Error("The repository is outside the explicitly allowed root.");

  const insideWorktree = (await runGit(repositoryPath, ["rev-parse", "--is-inside-work-tree"])).trim();
  if (insideWorktree !== "true") throw new Error("The selected path is not a Git worktree.");
  const worktreeRoot = await realpath((await runGit(repositoryPath, ["rev-parse", "--show-toplevel"])).trim());
  if (worktreeRoot !== repositoryPath) throw new Error("The selected path must be the root of the Git worktree.");

  const capturedAt = (options.now ?? (() => new Date().toISOString()))();
  const commit = (await runGit(repositoryPath, ["rev-parse", "HEAD"])).trim();
  if (!/^[a-f0-9]{40,64}$/u.test(commit)) throw new Error("Git did not return a valid baseline commit identifier.");
  const status = await runGit(repositoryPath, ["status", "--porcelain=v1", "-z", "--untracked-files=normal"]);
  const sessionId = (options.sessionId ?? (() => `fr_${randomBytes(16).toString("hex")}`))();
  if (!/^fr_[a-f0-9]{32}$/u.test(sessionId)) throw new Error("The generated session identifier is invalid.");

  const stateRoot = join(repositoryPath, ".flight-recorder");
  const sessionsRoot = join(stateRoot, "sessions");
  await rejectSymlinkIfPresent(stateRoot);
  await rejectSymlinkIfPresent(sessionsRoot);
  const storageDirectory = join(sessionsRoot, sessionId);
  await mkdir(storageDirectory, { recursive: false, mode: 0o700 }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    await mkdir(sessionsRoot, { recursive: true, mode: 0o700 });
    await mkdir(storageDirectory, { recursive: false, mode: 0o700 });
  });
  await chmod(storageDirectory, 0o700);
  const canonicalStorageDirectory = await realpath(storageDirectory);
  if (!isInside(repositoryPath, canonicalStorageDirectory)) throw new Error("Private session storage escaped the repository root.");

  const baseline = {
    commit,
    dirty: status.length > 0,
    statusDigestSha256: sha256(status),
    capturedAt,
  };
  const session: LocalSession = {
    schemaVersion: "0.1.0",
    sessionId,
    createdAt: capturedAt,
    repositoryPath,
    status: "initialised",
    policy: request.policy,
    baseline,
    task: request.task,
    acceptanceCriteria: [...request.acceptanceCriteria],
    storageDirectory: canonicalStorageDirectory,
  };
  await writePrivateJson(join(storageDirectory, "session.json"), session);
  await writePrivateJson(join(storageDirectory, "task.json"), { task: session.task, acceptanceCriteria: session.acceptanceCriteria });
  await writePrivateJson(join(storageDirectory, "git-baseline.json"), baseline);
  return session;
}
