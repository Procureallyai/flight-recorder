import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signBytes,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";
import { canonicalize, validateSealPolicy } from "./core.js";
import {
  passportManifestSchema,
  type Artifact,
  type EvidenceEvent,
  type Passport,
  type PassportManifest,
  type Signature,
} from "@flight-recorder/schema";

export { canonicalize, validateSealPolicy } from "./core.js";

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
