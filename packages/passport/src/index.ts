import { calculateMerkleRoot, canonicalize, describeArtifact, sha256, verifyEventChain } from "@flight-recorder/crypto";
import {
  passportSchema,
  passportManifestSchema,
  type EvidenceEvent,
  type Passport,
  type PassportManifest,
  type ReviewFinding,
} from "@flight-recorder/schema";

export interface CandidateArtifactInput {
  id: string;
  path: string;
  mediaType: string;
  content: string | Uint8Array;
}

export interface AssembleManifestInput {
  passportId: string;
  createdAt: string;
  evidenceClassification: PassportManifest["evidenceClassification"];
  project: PassportManifest["project"];
  session: PassportManifest["session"];
  artifacts: readonly CandidateArtifactInput[];
  events: readonly EvidenceEvent[];
  findings: readonly ReviewFinding[];
  reviewProvenance?: PassportManifest["reviewProvenance"];
  sealDecision: PassportManifest["sealDecision"];
}

export function assembleManifest(input: AssembleManifestInput): PassportManifest {
  if (!verifyEventChain(input.events)) {
    throw new Error("Candidate events must form a complete, valid hash chain.");
  }
  const artifacts = input.artifacts.map((artifact) => describeArtifact(
    artifact.id,
    artifact.path,
    artifact.mediaType,
    artifact.content,
  ));
  const eventChainHead = input.events.at(-1)?.hash;
  if (eventChainHead === undefined) throw new Error("At least one evidence event is required.");

  return passportManifestSchema.parse({
    schemaVersion: "0.1.0",
    passportId: input.passportId,
    createdAt: input.createdAt,
    timestampType: "local-recorded-time",
    evidenceClassification: input.evidenceClassification,
    project: input.project,
    session: input.session,
    artifacts,
    events: [...input.events],
    findings: [...input.findings],
    ...(input.reviewProvenance === undefined ? {} : { reviewProvenance: input.reviewProvenance }),
    eventChainHead,
    merkleRoot: calculateMerkleRoot(artifacts, input.events),
    sealDecision: input.sealDecision,
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  });
}

export type PassportBundleArtifacts = ReadonlyMap<string, string | Uint8Array> | Readonly<Record<string, string | Uint8Array>>;

function artifactContent(artifacts: PassportBundleArtifacts, path: string): Uint8Array {
  let value: string | Uint8Array | undefined;
  if (artifacts instanceof Map) value = artifacts.get(path);
  else {
    const record = artifacts as Readonly<Record<string, string | Uint8Array>>;
    value = Object.hasOwn(record, path) ? record[path] : undefined;
  }
  if (value === undefined) throw new Error(`Missing covered artifact: ${path}`);
  return typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
}

function jsonFile(value: unknown): Buffer {
  return Buffer.from(`${canonicalize(value)}\n`, "utf8");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportHtml(passport: Passport): Buffer {
  const { manifest } = passport;
  const criteria = manifest.session.acceptanceCriteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join("");
  const artifacts = manifest.artifacts.map((artifact) => `<li><code>${escapeHtml(artifact.path)}</code> (${artifact.size} bytes)</li>`).join("");
  const content = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.project.name)} passport</title></head>
<body><main><h1>${escapeHtml(manifest.project.name)}</h1><p>${escapeHtml(manifest.claim)}</p><h2>Task</h2><p>${escapeHtml(manifest.session.task)}</p><h2>Acceptance criteria</h2><ul>${criteria}</ul><h2>Covered artifacts</h2><ul>${artifacts}</ul><h2>Verification</h2><pre><code>flight-recorder verify-bundle &lt;passport-directory&gt; --json</code></pre><h2>Limitations</h2><p>This passport proves integrity of the covered evidence under the corresponding signing key. It does not prove software correctness, signer identity, certified security, legal compliance, or trusted time.</p></main></body></html>
`;
  return Buffer.from(content, "utf8");
}

function reviewProjection(passport: Passport, reviewer: PassportManifest["findings"][number]["reviewer"]): Buffer {
  return jsonFile({
    reviewer,
    findings: passport.manifest.findings.filter((finding) => finding.reviewer === reviewer),
  });
}

export interface PassportBundle {
  directoryName: string;
  files: ReadonlyMap<string, Uint8Array>;
}

export function buildPassportBundle(input: unknown, artifacts: PassportBundleArtifacts): PassportBundle {
  const passport = passportSchema.parse(input);
  const files = new Map<string, Uint8Array>();
  files.set("passport.json", jsonFile(passport));
  files.set("manifest.json", jsonFile(passport.manifest));
  files.set("signature.ed25519", Buffer.from(`${passport.signature.signatureBase64}\n`, "utf8"));
  files.set("public-key.pem", Buffer.from(passport.signature.publicKeyPem, "utf8"));
  files.set("task.json", jsonFile(passport.manifest.session));
  files.set("events.jsonl", Buffer.from(passport.manifest.events.map((event) => canonicalize(event)).join("\n") + "\n", "utf8"));
  files.set("git.json", jsonFile({ repositoryCommit: passport.manifest.project.repositoryCommit }));
  files.set("approvals.json", jsonFile(passport.manifest.events.filter((event) => event.type === "approval")));
  files.set("tests.json", jsonFile(passport.manifest.events.filter((event) => event.type === "test")));
  files.set("diff.patch", Buffer.from(passport.manifest.events
    .filter((event) => event.type === "file-change" && typeof event.payload.patch === "string")
    .map((event) => String(event.payload.patch))
    .join("\n"), "utf8"));
  for (const reviewer of ["requirements", "security", "tests", "evidence", "synthesis"] as const) {
    files.set(`reviews/${reviewer}.json`, reviewProjection(passport, reviewer));
  }
  if (passport.manifest.reviewProvenance !== undefined) files.set("reviews/provenance.json", jsonFile(passport.manifest.reviewProvenance));
  files.set("scope-and-limitations.json", jsonFile({
    evidenceClassification: passport.manifest.evidenceClassification,
    includedArtifactPaths: passport.manifest.artifacts.map((artifact) => artifact.path),
    excluded: ["raw model reasoning", "private credentials", "trusted timestamp authority", "independent signer identity verification"],
    claim: passport.manifest.claim,
  }));
  files.set("report.html", reportHtml(passport));
  for (const artifact of passport.manifest.artifacts) files.set(`artifacts/${artifact.path}`, artifactContent(artifacts, artifact.path));

  const inventory = [...files.entries()]
    .map(([path, content]) => ({ path, size: content.byteLength, sha256: sha256(content) }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  files.set("bundle-index.json", jsonFile({ schemaVersion: "0.1.0", files: inventory }));

  const slug = passport.manifest.project.name.toLocaleLowerCase("en-US").normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 48) || "project";
  const shortCommit = passport.manifest.project.repositoryCommit.replace(/[^a-f0-9]/giu, "").slice(0, 8).toLocaleLowerCase("en-US") || "unknown";
  return { directoryName: `flight-recorder-${slug}-${shortCommit}.passport`, files };
}
