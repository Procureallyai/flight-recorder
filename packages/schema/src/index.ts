import { z } from "zod";

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const identifierSchema = z.string().min(1).max(200);
const shortTextSchema = z.string().min(1).max(2_000);
const longTextSchema = z.string().max(100_000);

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const forbiddenJsonKeys = new Set(["__proto__", "constructor", "prototype"]);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string().max(100_000),
  z.array(jsonValueSchema).max(500),
  z.record(jsonValueSchema).superRefine((value, context) => {
    if (Object.keys(value).length > 500) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "JSON objects may contain at most 500 keys." });
    }
    for (const key of Object.keys(value)) {
      if (forbiddenJsonKeys.has(key)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Unsafe JSON object key." });
      }
    }
  }),
]));

const artifactPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((path) => {
    const segments = path.split("/");
    return (
      path === path.normalize("NFC") &&
      !path.startsWith("/") &&
      !path.startsWith("\\") &&
      !path.includes("\\") &&
      !path.includes("\u0000") &&
      !/^[a-zA-Z]:/u.test(path) &&
      segments.every((segment) =>
        segment !== "" &&
        segment !== "." &&
        segment !== ".." &&
        !/[. ]$/u.test(segment) &&
        !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(segment)
      )
    );
  }, "Artifact path must be a Unicode-normalised portable relative path without traversal or reserved segments.");

export const artifactSchema = z.object({
  id: identifierSchema,
  path: artifactPathSchema,
  mediaType: z.string().min(1).max(200),
  size: z.number().int().nonnegative().max(100_000_000),
  sha256: sha256Schema,
}).strict();

export const evidenceEventSchema = z.object({
  id: identifierSchema,
  index: z.number().int().nonnegative().max(9_999),
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
  summary: shortTextSchema,
  payload: z.record(jsonValueSchema),
  previousHash: sha256Schema.nullable(),
  hash: sha256Schema,
}).strict();

export const reviewFindingSchema = z.object({
  id: identifierSchema,
  reviewer: z.enum(["requirements", "security", "tests", "evidence", "synthesis"]),
  severity: z.enum(["blocking", "warning", "informational"]),
  title: shortTextSchema,
  detail: longTextSchema.min(1),
  evidenceIds: z.array(identifierSchema).max(500),
  resolved: z.boolean(),
}).strict();

export const passportManifestSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  passportId: identifierSchema,
  createdAt: z.string().datetime({ offset: true }),
  timestampType: z.literal("local-recorded-time"),
  evidenceClassification: z.enum(["synthetic-test-fixture", "genuine-session"]),
  project: z.object({
    name: shortTextSchema,
    repositoryCommit: z.string().min(1).max(200),
  }).strict(),
  session: z.object({
    task: longTextSchema.min(1),
    acceptanceCriteria: z.array(shortTextSchema).min(1).max(100),
  }).strict(),
  artifacts: z.array(artifactSchema).min(1).max(1_000),
  events: z.array(evidenceEventSchema).min(1).max(10_000),
  findings: z.array(reviewFindingSchema).max(1_000),
  eventChainHead: sha256Schema,
  merkleRoot: sha256Schema,
  sealDecision: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string()),
    humanApproved: z.boolean(),
  }).strict(),
  claim: z.literal(
    "The covered evidence has not changed since it was sealed by the holder of the corresponding signing key.",
  ),
}).strict().superRefine((manifest, context) => {
  const artifactIds = new Set<string>();
  const artifactPaths = new Set<string>();
  const portableArtifactPaths = new Set<string>();
  for (const [index, artifact] of manifest.artifacts.entries()) {
    if (artifactIds.has(artifact.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "id"], message: "Artifact identifiers must be unique." });
    }
    if (artifactPaths.has(artifact.path)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "path"], message: "Artifact paths must be unique." });
    }
    const portablePath = artifact.path.normalize("NFC").toLocaleLowerCase("en-US");
    if (portableArtifactPaths.has(portablePath)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["artifacts", index, "path"], message: "Artifact paths must not collide after portable case folding." });
    }
    artifactIds.add(artifact.id);
    artifactPaths.add(artifact.path);
    portableArtifactPaths.add(portablePath);
  }

  const eventIds = new Set<string>();
  for (const [index, event] of manifest.events.entries()) {
    if (eventIds.has(event.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["events", index, "id"], message: "Event identifiers must be unique." });
    }
    eventIds.add(event.id);
  }

  const findingIds = new Set<string>();
  for (const [index, finding] of manifest.findings.entries()) {
    if (findingIds.has(finding.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "id"], message: "Finding identifiers must be unique." });
    }
    for (const [referenceIndex, evidenceId] of finding.evidenceIds.entries()) {
      if (!eventIds.has(evidenceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["findings", index, "evidenceIds", referenceIndex],
          message: "Finding evidence identifiers must reference declared events.",
        });
      }
    }
    findingIds.add(finding.id);
  }
});

export const signatureSchema = z.object({
  algorithm: z.literal("Ed25519"),
  publicKeyPem: z.string().min(1).max(2_048),
  signedDigestSha256: sha256Schema,
  signatureBase64: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/u).max(512),
}).strict();

export const passportSchema = z.object({
  manifest: passportManifestSchema,
  signature: signatureSchema,
}).strict();

export type Artifact = z.infer<typeof artifactSchema>;
export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type PassportManifest = z.infer<typeof passportManifestSchema>;
export type Signature = z.infer<typeof signatureSchema>;
export type Passport = z.infer<typeof passportSchema>;
