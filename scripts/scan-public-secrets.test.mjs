import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { scanPublicText } from "./scan-public-secrets.mjs";

describe("public secret and privacy scanning", () => {
  it("finds a private feedback Session Identifier without returning its value", () => {
    const privateValue = "00000000-0000-7000-8000-000000000001";
    const findings = scanPublicText("README.md", `private reference: ${privateValue}`, {
      feedbackSessionId: privateValue,
    });

    assert.deepEqual(findings, [{
      file: "README.md",
      line: 1,
      label: "Private feedback Session Identifier",
    }]);
    assert.equal(JSON.stringify(findings).includes(privateValue), false);
  });

  for (const localPath of [
    "/Users/private-user/project/file.txt",
    "/home/private-user/project/file.txt",
    String.raw`C:\Users\private-user\project\file.txt`,
  ]) {
    it(`finds an absolute local home path in public evidence: ${localPath}`, () => {
      assert.deepEqual(scanPublicText("fixtures/example/capture.json", localPath), [{
        file: "fixtures/example/capture.json",
        line: 1,
        label: "Absolute local home path",
      }]);
    });
  }

  it("finds an account owner in captured Unix directory output", () => {
    const listing = String.raw`{"output":"total 24\ndrwxr-xr-x@ 7 private-user staff 224 Jul 18 20:48 ."}`;
    assert.deepEqual(scanPublicText("fixtures/example/capture.json", listing), [{
      file: "fixtures/example/capture.json",
      line: 1,
      label: "Local account name in command output",
    }]);
  });

  it("accepts the explicit account placeholder in captured Unix directory output", () => {
    const listing = String.raw`{"output":"total 24\ndrwxr-xr-x@ 7 [USER] staff 224 Jul 18 20:48 ."}`;
    assert.deepEqual(scanPublicText("fixtures/example/capture.json", listing), []);
  });

  it("finds a real local home path outside generated fixtures", () => {
    assert.deepEqual(scanPublicText("docs/operator-guide.md", "/Users/local-account/project/file.txt"), [{
      file: "docs/operator-guide.md",
      line: 1,
      label: "Absolute local home path",
    }]);
  });

  it("finds private generated-image paths without a local Session Identifier source", () => {
    assert.deepEqual(scanPublicText("design-qa.md", "source: ~/.codex/generated_images/session/image.png"), [{
      file: "design-qa.md",
      line: 1,
      label: "Private local generated-image path",
    }]);
  });

  it("keeps the two public demonstration-session fixtures free of local identity data", async () => {
    for (const file of [
      "fixtures/demo-session/capture.json",
      "fixtures/demo-session/passport-candidate.json",
    ]) {
      const content = await readFile(file, "utf8");
      assert.deepEqual(scanPublicText(file, content), []);
    }
  });
});
