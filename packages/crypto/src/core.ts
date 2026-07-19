import type { PassportManifest } from "@flight-recorder/schema";

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

export function validateSealPolicy(manifest: PassportManifest): string[] {
  const reasons: string[] = [];
  if (!manifest.sealDecision.ready) reasons.push("The manifest is not marked ready.");
  if (!manifest.sealDecision.humanApproved) reasons.push("Explicit human approval is missing.");
  if (manifest.sealDecision.blockingReasons.length > 0) reasons.push("Blocking reasons remain recorded.");
  if (manifest.findings.some((finding) => finding.severity === "blocking" && !finding.resolved)) {
    reasons.push("Blocking review findings remain unresolved.");
  }
  const decisionsByFinding = new Map(manifest.findingDecisions.map((decision) => [decision.findingId, decision]));
  if (manifest.evidenceClassification === "genuine-session" && manifest.findings.some((finding) => finding.resolved && decisionsByFinding.get(finding.id)?.decision !== "resolved")) {
    reasons.push("Every resolved genuine-session finding requires a recorded human resolution decision.");
  }
  if (manifest.findings.some((finding) => !finding.resolved && decisionsByFinding.get(finding.id)?.decision === "resolved")) {
    reasons.push("A human resolution decision cannot rewrite an unresolved original finding.");
  }
  if (manifest.findings.some((finding) => finding.severity === "blocking" && decisionsByFinding.get(finding.id)?.decision === "accepted-risk")) {
    reasons.push("Accepted risk cannot clear a blocking finding.");
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
