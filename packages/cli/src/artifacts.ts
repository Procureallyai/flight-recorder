import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { passportSchema } from "@flight-recorder/schema";
import type { VerificationArtifacts } from "@flight-recorder/verifier";

export async function collectArtifacts(passportPath: string, artifactRoot: string): Promise<VerificationArtifacts> {
  const passport = passportSchema.parse(JSON.parse(await readFile(passportPath, "utf8")));
  const canonicalRoot = await realpath(artifactRoot);
  const contents = new Map<string, Uint8Array>();
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
    contents.set(artifact.path, await readFile(canonicalArtifactPath));
  }
  return contents;
}
