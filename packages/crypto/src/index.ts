import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";
import {
  passportManifestSchema,
  type Artifact,
  type EvidenceEvent,
  type Passport,
  type PassportManifest,
  type Signature,
} from "@flight-recorder/schema";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers.");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const normalized: Record<string, JsonValue> = {};
    for (const key of Object.keys(source).sort()) {
      const entry = source[key];
      if (entry === undefined) {
        throw new TypeError(`Canonical JSON does not support undefined at ${key}.`);
      }
      normalized[key] = normalizeJson(entry);
    }
    return normalized;
  }

  throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function describeArtifact(
  id: string,
  path: string,
  mediaType: string,
  content: string | Uint8Array,
): Artifact {
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
  return { id, path, mediaType, size: bytes.byteLength, sha256: sha256(bytes) };
}

type EventInput = Omit<EvidenceEvent, "index" | "previousHash" | "hash">;

export function buildEventChain(inputs: readonly EventInput[]): EvidenceEvent[] {
  let previousHash: string | null = null;
  return inputs.map((input, index) => {
    // The hash excludes the hash field itself and commits to the preceding event.
    const eventWithoutHash = { ...input, index, previousHash };
    const hash = sha256(canonicalize(eventWithoutHash));
    previousHash = hash;
    return { ...eventWithoutHash, hash };
  });
}

export function verifyEventChain(events: readonly EvidenceEvent[]): boolean {
  let previousHash: string | null = null;
  for (const [index, event] of events.entries()) {
    if (event.index !== index || event.previousHash !== previousHash) {
      return false;
    }
    const { hash, ...eventWithoutHash } = event;
    if (sha256(canonicalize(eventWithoutHash)) !== hash) {
      return false;
    }
    previousHash = hash;
  }
  return events.length > 0;
}

function hashMerkleLeaf(value: string): string {
  return sha256(`leaf\u0000${value}`);
}

function hashMerkleNode(left: string, right: string): string {
  return sha256(`node\u0000${left}${right}`);
}

export function calculateMerkleRoot(artifacts: readonly Artifact[], events: readonly EvidenceEvent[]): string {
  const values = [
    // The full descriptor binds path, media type, size, identifier, and digest to the tree.
    ...artifacts.map((artifact) => `artifact:${canonicalize(artifact)}`),
    ...events.map((event) => `event:${event.id}:${event.hash}`),
  ].sort();

  if (values.length === 0) {
    throw new Error("Cannot calculate a Merkle root without evidence leaves.");
  }

  let level = values.map(hashMerkleLeaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      if (left === undefined) {
        throw new Error("Merkle construction encountered a missing left node.");
      }
      const right = level[index + 1] ?? left;
      next.push(hashMerkleNode(left, right));
    }
    level = next;
  }

  const root = level[0];
  if (root === undefined) {
    throw new Error("Merkle construction did not produce a root.");
  }
  return root;
}

export function generateSigningKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync("ed25519");
}

export function createDeterministicDemoKeyPair(seed: Uint8Array): { publicKey: KeyObject; privateKey: KeyObject } {
  if (seed.byteLength !== 32) {
    throw new Error("An Ed25519 demonstration seed must contain exactly 32 bytes.");
  }
  // This PKCS#8 wrapper is for reproducible public fixtures only, never production signing keys.
  const privateKeyDer = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seed),
  ]);
  const privateKey = createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs8" });
  return { privateKey, publicKey: createPublicKey(privateKey) };
}

function requireEd25519PrivateKey(privateKey: KeyObject): void {
  if (privateKey.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Flight Recorder signing requires an Ed25519 private key.");
  }
}

export function validateSealPolicy(manifest: PassportManifest): string[] {
  const reasons: string[] = [];
  if (!manifest.sealDecision.ready) reasons.push("The manifest is not marked ready.");
  if (!manifest.sealDecision.humanApproved) reasons.push("Explicit human approval is missing.");
  if (manifest.sealDecision.blockingReasons.length > 0) reasons.push("Blocking reasons remain recorded.");
  if (manifest.findings.some((finding) => finding.severity === "blocking" && !finding.resolved)) {
    reasons.push("Blocking review findings remain unresolved.");
  }
  const eventIds = new Set(manifest.events.map((event) => event.id));
  if (manifest.findings.some((finding) => finding.evidenceIds.some((evidenceId) => !eventIds.has(evidenceId)))) {
    reasons.push("Review findings contain unknown evidence references.");
  }
  if (manifest.evidenceClassification === "genuine-session" && manifest.reviewProvenance === undefined) {
    reasons.push("A genuine-session seal requires signed review provenance.");
  }
  if (manifest.reviewProvenance !== undefined) {
    const expectedReviewers = new Set(["requirements", "security", "tests", "evidence", "synthesis"]);
    const actualReviewers = new Set(manifest.reviewProvenance.calls.map((call) => call.reviewer));
    const responseIdentifiers = manifest.reviewProvenance.calls.map((call) => call.responseId);
    if (actualReviewers.size !== expectedReviewers.size || [...expectedReviewers].some((reviewer) => !actualReviewers.has(reviewer as typeof manifest.reviewProvenance.calls[number]["reviewer"]))) {
      reasons.push("Signed review provenance must contain each required reviewer exactly once.");
    }
    if (new Set(responseIdentifiers).size !== responseIdentifiers.length) reasons.push("Signed review response identifiers must be unique.");
    if (manifest.reviewProvenance.calls.some((call) => call.inputDigestSha256 !== manifest.reviewProvenance?.evidenceDigestSha256)) {
      reasons.push("Signed review calls must reference one evidence digest.");
    }
  }
  return reasons;
}

export function signManifest(manifest: PassportManifest, privateKey: KeyObject): Signature {
  requireEd25519PrivateKey(privateKey);
  const publicKey = createPublicKey(privateKey);
  const canonicalManifest = canonicalize(passportManifestSchema.parse(manifest));
  const signedDigestSha256 = sha256(canonicalManifest);
  const signature = signBytes(null, Buffer.from(canonicalManifest, "utf8"), privateKey);
  return {
    algorithm: "Ed25519",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    signedDigestSha256,
    signatureBase64: signature.toString("base64"),
  };
}

export function sealManifest(manifest: PassportManifest, privateKey: KeyObject): Passport {
  const validatedManifest = passportManifestSchema.parse(manifest);
  const policyFailures = validateSealPolicy(validatedManifest);
  if (policyFailures.length > 0) {
    throw new Error(`The manifest cannot be sealed: ${policyFailures.join(" ")}`);
  }
  return { manifest: validatedManifest, signature: signManifest(validatedManifest, privateKey) };
}

export function verifyManifestSignature(passport: Passport): boolean {
  try {
    const publicKey = createPublicKey(passport.signature.publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      return false;
    }
    const signature = Buffer.from(passport.signature.signatureBase64, "base64");
    if (signature.byteLength !== 64) {
      return false;
    }
    const canonicalManifest = canonicalize(passport.manifest);
    if (sha256(canonicalManifest) !== passport.signature.signedDigestSha256) {
      return false;
    }
    return verifyBytes(
      null,
      Buffer.from(canonicalManifest, "utf8"),
      publicKey,
      signature,
    );
  } catch {
    return false;
  }
}
