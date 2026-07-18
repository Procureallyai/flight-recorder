#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const [workspaceArgument, promptArgument, stdoutArgument, stderrArgument] = process.argv.slice(2);
if ([workspaceArgument, promptArgument, stdoutArgument, stderrArgument].some((value) => value === undefined)) {
  process.stderr.write("Usage: capture-codex-exec <workspace> <prompt-file> <raw-stdout.jsonl> <raw-stderr.log>\n");
  process.exitCode = 2;
} else {
  const workspace = resolve(workspaceArgument);
  const promptFile = resolve(promptArgument);
  const stdoutFile = resolve(stdoutArgument);
  const stderrFile = resolve(stderrArgument);
  const prompt = await readFile(promptFile, "utf8");
  await mkdir(dirname(stdoutFile), { recursive: true });
  await mkdir(dirname(stderrFile), { recursive: true });

  // Create private capture files before spawning so their permissions never depend on the process umask.
  await (await open(stdoutFile, "w", 0o600)).close();
  await (await open(stderrFile, "w", 0o600)).close();
  const stdoutStream = createWriteStream(stdoutFile, { flags: "a", mode: 0o600 });
  const stderrStream = createWriteStream(stderrFile, { flags: "a", mode: 0o600 });

  // The desktop-bundled binary is version-aligned with the signed-in Codex application.
  const child = spawn("/Applications/ChatGPT.app/Contents/Resources/codex", [
    "exec",
    "--json",
    "--color", "never",
    "--sandbox", "workspace-write",
    "--cd", workspace,
    "-",
  ], { stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.pipe(stdoutStream);
  child.stderr.pipe(stderrStream);
  child.stdin.end(prompt);

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  });
  await Promise.all([
    new Promise((resolveStream) => stdoutStream.end(resolveStream)),
    new Promise((resolveStream) => stderrStream.end(resolveStream)),
  ]);
  process.stdout.write(`Codex capture finished with exit code ${exitCode}. Raw output remains in the private gitignored session directory.\n`);
  process.exitCode = exitCode;
}
