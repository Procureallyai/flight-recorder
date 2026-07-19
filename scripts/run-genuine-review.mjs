#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createReviewDigestFromExecCapture } from "../packages/evidence/dist/index.js";
import { ReviewClient, createReviewProvenance, genuineReviewArtifactSchema } from "../packages/review/dist/index.js";

const [capturePath = "fixtures/demo-session/capture.json", outputPath = "fixtures/demo-session/review-run.json"] = process.argv.slice(2);
const apiKey = process.env.OPENAI_API_KEY;
if (typeof apiKey !== "string" || apiKey.trim() === "") {
  throw new Error("The bounded review requires an injected OPENAI_API_KEY.");
}

const capture = JSON.parse(await readFile(resolve(capturePath), "utf8"));
const digest = createReviewDigestFromExecCapture(capture);

const client = new ReviewClient({
  apiKey,
  enabled: true,
  model: "gpt-5.6-sol",
  maxCalls: 5,
  maxOutputTokens: 2_000,
  maxInputBytes: 500_000,
  timeoutMs: 60_000,
});
const run = await client.run(digest);
const provenance = createReviewProvenance("codex-exec-json", run);

// This public artifact contains bounded structured findings and call metadata only. It never contains the injected key or raw model reasoning.
const artifact = genuineReviewArtifactSchema.parse({
  schemaVersion: "0.1.0",
  evidenceSource: "codex-exec-json",
  evidenceDigestSha256: digest.inputDigestSha256,
  eventCount: digest.eventCount,
  provenance,
  run,
});
await writeFile(resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

process.stdout.write(`${JSON.stringify({
  completed: true,
  model: run.synthesis.model,
  calls: run.specialists.length + 1,
  specialistVerdicts: Object.fromEntries(run.specialists.map((entry) => [entry.output.reviewer, entry.output.verdict])),
  synthesisVerdict: run.synthesis.output.verdict,
  findingCount: run.specialists.reduce((total, entry) => total + entry.output.findings.length, 0) + run.synthesis.output.findings.length,
  evidenceDigestSha256: digest.inputDigestSha256,
  outputPath,
})}\n`);
