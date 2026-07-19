import { canonicalize, validateSealPolicy } from "@flight-recorder/crypto/core";
import {
  passportSchema,
  type EvidenceEvent,
  type Passport,
  type PassportManifest,
} from "@flight-recorder/schema";

export type BrowserVerificationCheckName =
  | "schema"
  | "seal-policy"
  | "crypto-support"
  | "review-provenance"
  | "signature"
  | "event-chain"
  | "event-chain-head"
  | "merkle-root"
  | "artifacts";

export interface BrowserVerificationCheck {
  name: BrowserVerificationCheckName;
  valid: boolean;
  detail: string;
}

export interface BrowserVerificationResult {
  valid: boolean;
  checks: BrowserVerificationCheck[];
}

export type BrowserVerificationArtifacts =
  | ReadonlyMap<string, string | Uint8Array>
  | Readonly<Record<string, string | Uint8Array>>;

interface WebCryptoProvider {
  subtle: {
    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    importKey(
      format: "spki",
      keyData: Uint8Array,
      algorithm: { name: string },
      extractable: boolean,
      keyUsages: readonly string[],
    ): Promise<unknown>;
    verify(
      algorithm: { name: string },
      key: unknown,
      signature: Uint8Array,
      data: Uint8Array,
    ): Promise<boolean>;
  };
}

export interface BrowserVerifierOptions {
  /** Override only supports deterministic capability tests. Production callers use globalThis.crypto. */
  cryptoProvider?: WebCryptoProvider | null;
}

const encoder = new TextEncoder();
const expectedReviewers = new Set(["requirements", "security", "tests", "evidence", "synthesis"]);
const ed25519SubjectPublicKeyInfoPrefix = "302a300506032b6570032100";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[a-f0-9]{2})+$/u.test(hex)) {
    throw new Error("Hexadecimal input is malformed.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function decodeBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw new Error("Base64 input is malformed.");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;

  for (let index = 0; index < value.length; index += 4) {
    const digits = [value[index], value[index + 1], value[index + 2], value[index + 3]].map((character) =>
      character === "=" ? 0 : alphabet.indexOf(character ?? ""),
    );
    if (digits.some((digit) => digit < 0)) {
      throw new Error("Base64 input contains an invalid character.");
    }
    const [first = 0, second = 0, third = 0, fourth = 0] = digits;
    const packed = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (outputIndex < output.length) output[outputIndex++] = (packed >>> 16) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = (packed >>> 8) & 0xff;
    if (outputIndex < output.length) output[outputIndex++] = packed & 0xff;
  }

  // Reject alternate encodings whose unused padding bits are not zero.
  if ((padding === 2 && (alphabet.indexOf(value[value.length - 3] ?? "") & 0x0f) !== 0) ||
      (padding === 1 && (alphabet.indexOf(value[value.length - 2] ?? "") & 0x03) !== 0)) {
    throw new Error("Base64 input is not canonical.");
  }
  return output;
}

function parseEd25519PublicKeyPem(publicKeyPem: string): Uint8Array {
  const match = /^-----BEGIN PUBLIC KEY-----\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n-----END PUBLIC KEY-----\r?\n?$/u.exec(publicKeyPem);
  if (match?.[1] === undefined) {
    throw new Error("Public key Privacy-Enhanced Mail encoding is malformed.");
  }
  const der = decodeBase64(match[1].replace(/[\r\n]/gu, ""));
  const prefix = hexToBytes(ed25519SubjectPublicKeyInfoPrefix);
  if (der.byteLength !== prefix.byteLength + 32 || prefix.some((byte, index) => der[index] !== byte)) {
    throw new Error("Public key is not a strict Ed25519 SubjectPublicKeyInfo value.");
  }
  return der;
}

function getCryptoProvider(options: BrowserVerifierOptions): WebCryptoProvider | null {
  if (Object.hasOwn(options, "cryptoProvider")) {
    return options.cryptoProvider ?? null;
  }
  return typeof globalThis.crypto === "object" ? globalThis.crypto as unknown as WebCryptoProvider : null;
}

function hasRequiredWebCrypto(provider: WebCryptoProvider | null): provider is WebCryptoProvider {
  return provider !== null && typeof provider.subtle?.digest === "function" &&
    typeof provider.subtle.importKey === "function" && typeof provider.subtle.verify === "function";
}

async function sha256(provider: WebCryptoProvider, input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  const digest = await provider.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function verifyEventChain(provider: WebCryptoProvider, events: readonly EvidenceEvent[]): Promise<boolean> {
  let previousHash: string | null = null;
  for (const [index, event] of events.entries()) {
    if (event.index !== index || event.previousHash !== previousHash) return false;
    const { hash, ...eventWithoutHash } = event;
    if (await sha256(provider, canonicalize(eventWithoutHash)) !== hash) return false;
    previousHash = hash;
  }
  return events.length > 0;
}

async function calculateMerkleRoot(
  provider: WebCryptoProvider,
  artifacts: PassportManifest["artifacts"],
  events: PassportManifest["events"],
): Promise<string> {
  const values = [
    ...artifacts.map((artifact) => `artifact:${canonicalize(artifact)}`),
    ...events.map((event) => `event:${event.id}:${event.hash}`),
  ].sort();
  if (values.length === 0) throw new Error("Cannot calculate a Merkle root without evidence leaves.");

  let level = await Promise.all(values.map((value) => sha256(provider, `leaf\u0000${value}`)));
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      if (left === undefined) throw new Error("Merkle construction encountered a missing left node.");
      next.push(await sha256(provider, `node\u0000${left}${level[index + 1] ?? left}`));
    }
    level = next;
  }
  const root = level[0];
  if (root === undefined) throw new Error("Merkle construction did not produce a root.");
  return root;
}

function inferTestStatus(payload: Record<string, unknown>): "passed" | "failed" | "unknown" {
  if (payload.exitCode === 0 || payload.status === "passed") return "passed";
  if (typeof payload.exitCode === "number" || payload.status === "failed") return "failed";
  return "unknown";
}

function isPortablePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) return false;
  const segments = value.split("/");
  return value === value.normalize("NFC") && !value.startsWith("/") && !value.startsWith("\\") &&
    !value.includes("\\") && !value.includes("\u0000") && !/^[a-zA-Z]:/u.test(value) &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== ".." &&
      !/[. ]$/u.test(segment) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(segment));
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && [...keys].sort().every((key, index) => actual[index] === key);
}

async function validateFinalStateEnvelope(
  provider: WebCryptoProvider,
  payload: Record<string, unknown>,
  events: readonly EvidenceEvent[],
  completionIndex: number,
): Promise<boolean> {
  if (!hasExactKeys(payload, ["schemaVersion", "recordKind", "finalCommit", "scopedClean", "scopePaths", "postCommitPassingTestEvidenceId", "artifacts"]) ||
      payload.schemaVersion !== "0.1.0" || payload.recordKind !== "final-git-state" || payload.scopedClean !== true ||
      typeof payload.finalCommit !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(payload.finalCommit) ||
      typeof payload.postCommitPassingTestEvidenceId !== "string" || payload.postCommitPassingTestEvidenceId.length < 1 || payload.postCommitPassingTestEvidenceId.length > 200 ||
      !Array.isArray(payload.scopePaths) || payload.scopePaths.length < 1 || payload.scopePaths.length > 100 ||
      !payload.scopePaths.every(isPortablePath) || !Array.isArray(payload.artifacts) || payload.artifacts.length < 1 || payload.artifacts.length > 25) {
    return false;
  }

  const foldedScope = payload.scopePaths.map((path) => path.toLocaleLowerCase("en-US"));
  if (new Set(foldedScope).size !== foldedScope.length) return false;
  const artifactPaths: string[] = [];
  let totalBytes = 0;
  for (const candidate of payload.artifacts) {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const artifact = candidate as Record<string, unknown>;
    if (!hasExactKeys(artifact, ["path", "mediaType", "byteSize", "sha256", "content"]) || !isPortablePath(artifact.path) ||
        typeof artifact.mediaType !== "string" || artifact.mediaType.length < 1 || artifact.mediaType.length > 200 ||
        typeof artifact.byteSize !== "number" || !Number.isInteger(artifact.byteSize) || artifact.byteSize < 0 || artifact.byteSize > 100_000 ||
        typeof artifact.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(artifact.sha256) ||
        typeof artifact.content !== "string" || artifact.content.length > 100_000) return false;
    const bytes = encoder.encode(artifact.content);
    if (bytes.byteLength !== artifact.byteSize || await sha256(provider, bytes) !== artifact.sha256) return false;
    artifactPaths.push(artifact.path.toLocaleLowerCase("en-US"));
    totalBytes += bytes.byteLength;
  }
  if (new Set(artifactPaths).size !== artifactPaths.length || totalBytes > 1_000_000 || artifactPaths.some((path) => !foldedScope.includes(path))) return false;

  const matchingTests = events.filter((event) => event.id === payload.postCommitPassingTestEvidenceId);
  const test = matchingTests[0];
  return matchingTests.length === 1 && test !== undefined && test.index < completionIndex && test.type === "test" &&
    inferTestStatus(test.payload) === "passed" && test.payload.phase === "post-commit" && test.payload.repositoryCommit === payload.finalCommit;
}

async function createEvidenceDigest(
  provider: WebCryptoProvider,
  source: NonNullable<PassportManifest["reviewProvenance"]>["evidenceSource"],
  events: readonly EvidenceEvent[],
): Promise<string> {
  const eventTypes: Record<string, number> = {};
  const categories = new Set<string>();
  for (const event of events) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
    switch (event.type) {
      case "task": categories.add("task-and-criteria"); break;
      case "plan": categories.add("plans"); break;
      case "command":
      case "test": categories.add("commands-and-tests"); break;
      case "file-change": categories.add("file-changes"); break;
      case "approval": categories.add("approvals"); break;
      case "completion":
        if (event.payload.recordKind === "final-git-state") {
          if (!await validateFinalStateEnvelope(provider, event.payload, events, event.index)) {
            throw new Error("Final-state review evidence is invalid.");
          }
          categories.add("git-state");
        }
        break;
      case "review": break;
    }
  }
  const digestWithoutHash = {
    schemaVersion: "0.1.0" as const,
    source,
    eventCount: events.length,
    eventTypes,
    testResults: events.filter((event) => event.type === "test").map((event) => ({
      evidenceId: event.id,
      status: inferTestStatus(event.payload),
      ...(typeof event.payload.command === "string" ? { command: event.payload.command } : {}),
    })),
    evidence: events.map((event) => ({ evidenceId: event.id, type: event.type, summary: event.summary, payload: event.payload })),
    transmissionCategories: [...categories].sort(),
  };
  return sha256(provider, canonicalize(digestWithoutHash));
}

async function verifyReviewProvenance(provider: WebCryptoProvider, passport: Passport): Promise<boolean> {
  const provenance = passport.manifest.reviewProvenance;
  if (provenance === undefined) return passport.manifest.evidenceClassification === "synthetic-test-fixture";
  const reviewers = new Set(provenance.calls.map((call) => call.reviewer));
  const responseIdentifiers = provenance.calls.map((call) => call.responseId);
  const recomputedDigest = await createEvidenceDigest(provider, provenance.evidenceSource, passport.manifest.events);
  return reviewers.size === expectedReviewers.size && [...expectedReviewers].every((reviewer) => reviewers.has(reviewer as typeof provenance.calls[number]["reviewer"])) &&
    new Set(responseIdentifiers).size === responseIdentifiers.length &&
    provenance.calls.every((call) => call.inputDigestSha256 === provenance.evidenceDigestSha256) &&
    provenance.evidenceDigestSha256 === recomputedDigest;
}

async function verifySignature(provider: WebCryptoProvider, passport: Passport): Promise<boolean> {
  try {
    const canonicalManifest = canonicalize(passport.manifest);
    if (await sha256(provider, canonicalManifest) !== passport.signature.signedDigestSha256) return false;
    const signature = decodeBase64(passport.signature.signatureBase64);
    if (signature.byteLength !== 64) return false;
    const publicKeyDer = parseEd25519PublicKeyPem(passport.signature.publicKeyPem);
    const publicKey = await provider.subtle.importKey("spki", publicKeyDer, { name: "Ed25519" }, false, ["verify"]);
    return provider.subtle.verify({ name: "Ed25519" }, publicKey, signature, encoder.encode(canonicalManifest));
  } catch {
    return false;
  }
}

function getArtifactContent(contents: BrowserVerificationArtifacts, path: string): string | Uint8Array | undefined {
  if (contents instanceof Map) return contents.get(path);
  const record = contents as Readonly<Record<string, string | Uint8Array>>;
  return Object.hasOwn(record, path) ? record[path] : undefined;
}

export async function verifyPassportInBrowser(
  input: unknown,
  artifactContents: BrowserVerificationArtifacts,
  options: BrowserVerifierOptions = {},
): Promise<BrowserVerificationResult> {
  let parsed: ReturnType<typeof passportSchema.safeParse>;
  try {
    parsed = passportSchema.safeParse(input);
  } catch (error) {
    return {
      valid: false,
      checks: [{ name: "schema", valid: false, detail: error instanceof Error ? error.message : "Passport schema validation failed safely." }],
    };
  }
  if (!parsed.success) {
    return { valid: false, checks: [{ name: "schema", valid: false, detail: parsed.error.issues[0]?.message ?? "Invalid passport schema." }] };
  }

  const passport = parsed.data;
  const checks: BrowserVerificationCheck[] = [{ name: "schema", valid: true, detail: "Passport schema is valid." }];
  const sealPolicyFailures = validateSealPolicy(passport.manifest);
  checks.push({
    name: "seal-policy",
    valid: sealPolicyFailures.length === 0,
    detail: sealPolicyFailures.length === 0 ? "Deterministic seal policy is internally consistent." : sealPolicyFailures.join(" "),
  });

  const provider = getCryptoProvider(options);
  const cryptoSupported = hasRequiredWebCrypto(provider);
  checks.push({
    name: "crypto-support",
    valid: cryptoSupported,
    detail: cryptoSupported ? "Required Web Cryptography operations are available." : "Secure Hash Algorithm 256-bit and Ed25519 Web Cryptography support is unavailable.",
  });
  if (!cryptoSupported) {
    checks.push(
      { name: "review-provenance", valid: false, detail: "Review provenance could not be cryptographically recomputed." },
      { name: "signature", valid: false, detail: "Ed25519 signature could not be verified." },
      { name: "event-chain", valid: false, detail: "Event hashes could not be recomputed." },
      { name: "event-chain-head", valid: passport.manifest.events.at(-1)?.hash === passport.manifest.eventChainHead, detail: "Event chain head was compared without recomputing event hashes." },
      { name: "merkle-root", valid: false, detail: "Merkle root could not be recomputed." },
      { name: "artifacts", valid: false, detail: "Artifact digests could not be recomputed." },
    );
    return { valid: false, checks };
  }

  let provenanceValid = false;
  try { provenanceValid = await verifyReviewProvenance(provider, passport); } catch { provenanceValid = false; }
  checks.push({
    name: "review-provenance",
    valid: provenanceValid,
    detail: provenanceValid
      ? passport.manifest.reviewProvenance === undefined ? "Review provenance is not required for a synthetic cryptographic test fixture." : "All five review receipts are uniquely bound to the recorded evidence digest."
      : "Review receipts are missing, incomplete, duplicated, stale, or do not match the recorded evidence digest.",
  });

  const signatureValid = await verifySignature(provider, passport);
  checks.push({ name: "signature", valid: signatureValid, detail: signatureValid ? "Ed25519 signature is valid." : "Ed25519 signature or signed digest is invalid." });

  let eventChainValid = false;
  try { eventChainValid = await verifyEventChain(provider, passport.manifest.events); } catch { eventChainValid = false; }
  checks.push({ name: "event-chain", valid: eventChainValid, detail: eventChainValid ? "Event chain is complete and hash-linked." : "Event chain is inconsistent." });
  const eventChainHeadValid = passport.manifest.events.at(-1)?.hash === passport.manifest.eventChainHead;
  checks.push({ name: "event-chain-head", valid: eventChainHeadValid, detail: eventChainHeadValid ? "Event chain head matches the manifest." : "Event chain head does not match the manifest." });

  let merkleValid = false;
  try { merkleValid = await calculateMerkleRoot(provider, passport.manifest.artifacts, passport.manifest.events) === passport.manifest.merkleRoot; } catch { merkleValid = false; }
  checks.push({ name: "merkle-root", valid: merkleValid, detail: merkleValid ? "Merkle root covers the declared artifacts and events." : "Merkle root does not match declared evidence." });

  const changedArtifacts: string[] = [];
  const missingArtifacts: string[] = [];
  let artifactComparisonFailed = false;
  for (const artifact of passport.manifest.artifacts) {
    let content: string | Uint8Array | undefined;
    try {
      content = getArtifactContent(artifactContents, artifact.path);
    } catch {
      artifactComparisonFailed = true;
      changedArtifacts.push(artifact.path);
      continue;
    }
    if (content === undefined) { missingArtifacts.push(artifact.path); continue; }
    const bytes = typeof content === "string" ? encoder.encode(content) : content;
    try {
      if (bytes.byteLength !== artifact.size || await sha256(provider, bytes) !== artifact.sha256) changedArtifacts.push(artifact.path);
    } catch {
      artifactComparisonFailed = true;
      changedArtifacts.push(artifact.path);
    }
  }
  const artifactsValid = changedArtifacts.length === 0 && missingArtifacts.length === 0 && !artifactComparisonFailed;
  checks.push({
    name: "artifacts",
    valid: artifactsValid,
    detail: artifactsValid ? "All covered artifacts match their recorded size and Secure Hash Algorithm 256-bit digest." : artifactComparisonFailed ?
      "Artifact comparison failed safely because content access or Web Cryptography rejected an operation." :
      `Artifact mismatch. Changed: ${changedArtifacts.join(", ") || "none"}. Missing: ${missingArtifacts.join(", ") || "none"}.`,
  });
  return { valid: checks.every((check) => check.valid), checks };
}

/** Kept as a subpath-local convenience; prefer the explicit browser name in mixed runtimes. */
export const verifyPassport = verifyPassportInBrowser;
