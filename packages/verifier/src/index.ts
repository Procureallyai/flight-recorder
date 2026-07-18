import {
  calculateMerkleRoot,
  sha256,
  validateSealPolicy,
  verifyEventChain,
  verifyManifestSignature,
} from "@flight-recorder/crypto";
import { passportSchema, type Passport } from "@flight-recorder/schema";

export type VerificationCheckName =
  | "schema"
  | "seal-policy"
  | "signature"
  | "event-chain"
  | "event-chain-head"
  | "merkle-root"
  | "artifacts";

export interface VerificationCheck {
  name: VerificationCheckName;
  valid: boolean;
  detail: string;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationCheck[];
}

export type VerificationArtifacts = ReadonlyMap<string, string | Uint8Array> | Readonly<Record<string, string | Uint8Array>>;

function getArtifactContent(contents: VerificationArtifacts, path: string): string | Uint8Array | undefined {
  if (contents instanceof Map) {
    return contents.get(path);
  }
  const record = contents as Readonly<Record<string, string | Uint8Array>>;
  return Object.hasOwn(record, path) ? record[path] : undefined;
}

export function verifyPassport(input: unknown, artifactContents: VerificationArtifacts): VerificationResult {
  try {
    const parsed = passportSchema.safeParse(input);
    if (!parsed.success) {
      return {
        valid: false,
        checks: [{ name: "schema", valid: false, detail: parsed.error.issues[0]?.message ?? "Invalid passport schema." }],
      };
    }

    const passport: Passport = parsed.data;
    const checks: VerificationCheck[] = [{ name: "schema", valid: true, detail: "Passport schema is valid." }];

    const sealPolicyFailures = validateSealPolicy(passport.manifest);
    checks.push({
      name: "seal-policy",
      valid: sealPolicyFailures.length === 0,
      detail: sealPolicyFailures.length === 0 ? "Deterministic seal policy is internally consistent." : sealPolicyFailures.join(" "),
    });

    const signatureValid = verifyManifestSignature(passport);
    checks.push({
      name: "signature",
      valid: signatureValid,
      detail: signatureValid ? "Ed25519 signature is valid." : "Ed25519 signature or signed digest is invalid.",
    });

    const eventChainValid = verifyEventChain(passport.manifest.events);
    checks.push({
    name: "event-chain",
    valid: eventChainValid,
    detail: eventChainValid ? "Event chain is complete and hash-linked." : "Event chain is inconsistent.",
    });

    const eventChainHead = passport.manifest.events.at(-1)?.hash;
    const eventChainHeadValid = eventChainHead === passport.manifest.eventChainHead;
    checks.push({
    name: "event-chain-head",
    valid: eventChainHeadValid,
    detail: eventChainHeadValid ? "Event chain head matches the manifest." : "Event chain head does not match the manifest.",
    });

    const merkleRoot = calculateMerkleRoot(passport.manifest.artifacts, passport.manifest.events);
    const merkleValid = merkleRoot === passport.manifest.merkleRoot;
    checks.push({
    name: "merkle-root",
    valid: merkleValid,
    detail: merkleValid ? "Merkle root covers the declared artifacts and events." : "Merkle root does not match declared evidence.",
    });

    const changedArtifacts: string[] = [];
    const missingArtifacts: string[] = [];
    for (const artifact of passport.manifest.artifacts) {
      const content = getArtifactContent(artifactContents, artifact.path);
      if (content === undefined) {
        missingArtifacts.push(artifact.path);
        continue;
      }
      const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
      if (bytes.byteLength !== artifact.size || sha256(bytes) !== artifact.sha256) {
        changedArtifacts.push(artifact.path);
      }
    }
    const artifactsValid = changedArtifacts.length === 0 && missingArtifacts.length === 0;
    const artifactDetail = artifactsValid
      ? "All covered artifacts match their recorded size and SHA-256 digest."
      : `Artifact mismatch. Changed: ${changedArtifacts.join(", ") || "none"}. Missing: ${missingArtifacts.join(", ") || "none"}.`;
    checks.push({ name: "artifacts", valid: artifactsValid, detail: artifactDetail });

    return { valid: checks.every((check) => check.valid), checks };
  } catch (error) {
    return {
      valid: false,
      checks: [{ name: "schema", valid: false, detail: error instanceof Error ? error.message : "Passport verification failed safely." }],
    };
  }
}
