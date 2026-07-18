import { mkdir, lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { buildPassportBundle, type PassportBundleArtifacts } from "@flight-recorder/passport";
import { passportSchema } from "@flight-recorder/schema";
import { verifyPassport, type VerificationResult } from "@flight-recorder/verifier";
import { collectArtifacts } from "./artifacts.js";

export const MAX_BUNDLE_FILES = 1_100;
export const MAX_BUNDLE_BYTES = 120_000_000;
export const MAX_BUNDLE_FILE_BYTES = 25_000_000;

function portablePath(path: string): string {
  return path.split(sep).join("/");
}

async function inventoryDirectory(root: string): Promise<Map<string, Uint8Array>> {
  const canonicalRoot = await realpath(root);
  const files = new Map<string, Uint8Array>();
  const portableNames = new Set<string>();
  let totalBytes = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      const metadata = await lstat(candidate);
      if (metadata.isSymbolicLink()) throw new Error("Symbolic links are not permitted in a passport bundle.");
      if (metadata.isDirectory()) {
        await visit(candidate);
        continue;
      }
      if (!metadata.isFile()) throw new Error("Passport bundles may contain only regular files and directories.");
      const canonicalCandidate = await realpath(candidate);
      if (canonicalCandidate !== canonicalRoot && !canonicalCandidate.startsWith(`${canonicalRoot}${sep}`)) {
        throw new Error("A passport bundle file escapes the selected root.");
      }
      const path = portablePath(relative(canonicalRoot, canonicalCandidate));
      const foldedPath = path.normalize("NFC").toLocaleLowerCase("en-US");
      if (portableNames.has(foldedPath)) throw new Error("Passport bundle paths collide after portable case folding.");
      portableNames.add(foldedPath);
      if (metadata.size > MAX_BUNDLE_FILE_BYTES) throw new Error("A passport bundle file exceeds the per-file limit.");
      totalBytes += metadata.size;
      if (totalBytes > MAX_BUNDLE_BYTES) throw new Error("The passport bundle exceeds the total byte limit.");
      if (files.size + 1 > MAX_BUNDLE_FILES) throw new Error("The passport bundle exceeds the file-count limit.");
      files.set(path, await readFile(canonicalCandidate));
    }
  }

  await visit(canonicalRoot);
  return files;
}

function contentsEqual(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

export async function exportPassportBundle(passportFile: string, artifactRoot: string, outputParent: string): Promise<string> {
  const passportPath = resolve(passportFile);
  const artifactPath = resolve(artifactRoot);
  const passport = passportSchema.parse(JSON.parse(await readFile(passportPath, "utf8")) as unknown);
  const artifacts = await collectArtifacts(passportPath, artifactPath);
  const verification = verifyPassport(passport, artifacts);
  if (!verification.valid) throw new Error("Only a valid signed passport can be exported.");
  const bundle = buildPassportBundle(passport, artifacts);
  const parent = resolve(outputParent);
  await mkdir(parent, { recursive: true });
  const destination = join(parent, bundle.directoryName);
  await mkdir(destination, { recursive: false, mode: 0o755 });
  for (const [path, content] of bundle.files) {
    const output = join(destination, ...path.split("/"));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, { mode: 0o644, flag: "wx" });
  }
  return destination;
}

export interface BundleVerificationResult extends VerificationResult {
  bundle: {
    valid: boolean;
    missingFiles: string[];
    unexpectedFiles: string[];
    changedDerivedFiles: string[];
  };
}

export async function verifyPassportBundle(bundleDirectory: string): Promise<BundleVerificationResult> {
  const files = await inventoryDirectory(resolve(bundleDirectory));
  const passportBytes = files.get("passport.json");
  if (passportBytes === undefined) throw new Error("The passport bundle is missing passport.json.");
  const passport = passportSchema.parse(JSON.parse(Buffer.from(passportBytes).toString("utf8")) as unknown);
  const artifacts = new Map<string, Uint8Array>();
  for (const artifact of passport.manifest.artifacts) {
    const content = files.get(`artifacts/${artifact.path}`);
    if (content !== undefined) artifacts.set(artifact.path, content);
  }
  const passportVerification = verifyPassport(passport, artifacts);
  const missingArtifactFiles = passport.manifest.artifacts
    .map((artifact) => `artifacts/${artifact.path}`)
    .filter((path) => !files.has(path))
    .sort();
  if (missingArtifactFiles.length > 0) {
    return {
      valid: false,
      checks: passportVerification.checks,
      bundle: { valid: false, missingFiles: missingArtifactFiles, unexpectedFiles: [], changedDerivedFiles: ["bundle-index.json"] },
    };
  }
  const expected = buildPassportBundle(passport, artifacts as PassportBundleArtifacts).files;
  const missingFiles = [...expected.keys()].filter((path) => !files.has(path)).sort();
  const unexpectedFiles = [...files.keys()].filter((path) => !expected.has(path)).sort();
  const changedDerivedFiles = [...expected.entries()]
    .filter(([path, content]) => files.has(path) && !contentsEqual(content, files.get(path)!))
    .map(([path]) => path)
    .sort();
  const bundleValid = missingFiles.length === 0 && unexpectedFiles.length === 0 && changedDerivedFiles.length === 0;
  return {
    valid: passportVerification.valid && bundleValid,
    checks: passportVerification.checks,
    bundle: { valid: bundleValid, missingFiles, unexpectedFiles, changedDerivedFiles },
  };
}
