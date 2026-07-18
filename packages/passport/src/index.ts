import { calculateMerkleRoot, describeArtifact, verifyEventChain } from "@flight-recorder/crypto";
import {
  passportManifestSchema,
  type EvidenceEvent,
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
    eventChainHead,
    merkleRoot: calculateMerkleRoot(artifacts, input.events),
    sealDecision: input.sealDecision,
    claim: "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  });
}
