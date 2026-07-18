import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { passportSchema } from "@flight-recorder/schema";
import type { VerificationArtifacts } from "@flight-recorder/verifier";

export const MAX_PASSPORT_BYTES = 10_000_000;
export const MAX_ARTIFACT_BYTES = 25_000_000;
export const MAX_TOTAL_ARTIFACT_BYTES = 100_000_000;

async function readBoundedFile(path: string, maximumBytes: number, label: string): Promise<Buffer> {
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error(`${label} must be a regular file.`);
  if (metadata.size > maximumBytes) throw new Error(`${label} exceeds the ${maximumBytes}-byte verification limit.`);
  return readFile(path);
}

export async function collectArtifacts(passportPath: string, artifactRoot: string): Promise<VerificationArtifacts> {
  const passportBytes = await readBoundedFile(passportPath, MAX_PASSPORT_BYTES, "Passport");
  const passport = passportSchema.parse(JSON.parse(passportBytes.toString("utf8")));
  const canonicalRoot = await realpath(artifactRoot);
  const contents = new Map<string, Uint8Array>();
  let totalArtifactBytes = 0;
  for (const artifact of passport.manifest.artifacts) {
    const segments = artifact.path.split("/");
    let inspectedPath = canonicalRoot;
    let missing = false;
    for (const segment of segments) {
      inspectedPath = join(inspectedPath, segment);
      try {
        if ((await lstat(inspectedPath)).isSymbolicLink()) {
          throw new Error(`Symbolic links are not permitted in verification artifacts: ${artifact.path}`);
        }
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          missing = true;
          break;
        }
        throw error;
      }
    }
    if (missing) continue;

    const canonicalArtifactPath = await realpath(inspectedPath);
    const relativePath = relative(canonicalRoot, canonicalArtifactPath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`Artifact path escapes the verification directory: ${artifact.path}`);
    }
    const metadata = await stat(canonicalArtifactPath);
    if (!metadata.isFile()) throw new Error(`Verification artifact must be a regular file: ${artifact.path}`);
    if (metadata.size > MAX_ARTIFACT_BYTES) throw new Error(`Verification artifact exceeds the per-file limit: ${artifact.path}`);
    totalArtifactBytes += metadata.size;
    if (totalArtifactBytes > MAX_TOTAL_ARTIFACT_BYTES) throw new Error("Verification artifacts exceed the total byte limit.");
    contents.set(artifact.path, await readFile(canonicalArtifactPath));
  }
  return contents;
}
