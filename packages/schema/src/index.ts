import { z } from "zod";

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const artifactPathSchema = z
  .string()
  .min(1)
  .refine((path) => {
    const segments = path.split("/");
    return (
      !path.startsWith("/") &&
      !path.startsWith("\\") &&
      !path.includes("\\") &&
      !path.includes("\u0000") &&
      !/^[a-zA-Z]:/u.test(path) &&
      segments.every((segment) => segment !== "" && segment !== "." && segment !== "..")
    );
  }, "Artifact path must be a portable relative path without traversal segments.");

export const artifactSchema = z.object({
  id: z.string().min(1),
  path: artifactPathSchema,
  mediaType: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: sha256Schema,
});

export const evidenceEventSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  recordedAt: z.string().datetime({ offset: true }),
  type: z.enum([
    "task",
    "plan",
    "command",
    "file-change",
    "approval",
    "test",
    "review",
    "completion",
  ]),
  summary: z.string().min(1),
  payload: z.record(z.unknown()),
  previousHash: sha256Schema.nullable(),
  hash: sha256Schema,
});

export const reviewFindingSchema = z.object({
  id: z.string().min(1),
  reviewer: z.enum(["requirements", "security", "tests", "evidence", "synthesis"]),
  severity: z.enum(["blocking", "warning", "informational"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  resolved: z.boolean(),
});

export const passportManifestSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  passportId: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  timestampType: z.literal("local-recorded-time"),
  project: z.object({
    name: z.string().min(1),
    repositoryCommit: z.string().min(1),
  }),
  session: z.object({
    task: z.string().min(1),
    acceptanceCriteria: z.array(z.string().min(1)).min(1),
  }),
  artifacts: z.array(artifactSchema).min(1),
  events: z.array(evidenceEventSchema).min(1),
  findings: z.array(reviewFindingSchema),
  eventChainHead: sha256Schema,
  merkleRoot: sha256Schema,
  sealDecision: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string()),
    humanApproved: z.boolean(),
  }),
  claim: z.literal(
    "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  ),
}).superRefine((manifest, context) => {
  const artifactIds = new Set<string>();
  const artifactPaths = new Set<string>();
  for (const [index, artifact] of manifest.artifacts.entries()) {
    if (artifactIds.has(artifact.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "id"], message: "Artifact identifiers must be unique." });
    }
    if (artifactPaths.has(artifact.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "path"], message: "Artifact paths must be unique." });
    }
    artifactIds.add(artifact.id);
    artifactPaths.add(artifact.path);
  }

  const eventIds = new Set<string>();
  for (const [index, event] of manifest.events.entries()) {
    if (eventIds.has(event.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["events", index, "id"], message: "Event identifiers must be unique." });
    }
    eventIds.add(event.id);
  }
});

export const signatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  publicKeyPem: z.string().min(1).max(2048),
  signedDigestSha256: sha256Schema,
  signatureBase64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/u).max(512),
});

export const passportSchema = z.object({
  manifest: passportManifestSchema,
  signature: signatureSchema,
});

export type Artifact = z.infer<typeof artifactSchema>;
export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type PassportManifest = z.infer<typeof passportManifestSchema>;
export type Signature = z.infer<typeof signatureSchema>;
export type Passport = z.infer<typeof passportSchema>;
