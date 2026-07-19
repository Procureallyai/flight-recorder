import { describe, expect, it } from "vitest";
import { normaliseSystemDirectoryAlias } from "./safe-path.js";

describe("normaliseSystemDirectoryAlias", () => {
  it("accepts the macOS private alias for temporary directories", () => {
    expect(normaliseSystemDirectoryAlias("/tmp/example", "darwin")).toBe("/private/tmp/example");
    expect(normaliseSystemDirectoryAlias("/var/example", "darwin")).toBe("/private/var/example");
  });

  it("does not invent the macOS alias on Linux", () => {
    expect(normaliseSystemDirectoryAlias("/tmp/example", "linux")).toBe("/tmp/example");
    expect(normaliseSystemDirectoryAlias("/var/example", "linux")).toBe("/var/example");
  });

  it("leaves unrelated paths unchanged", () => {
    expect(normaliseSystemDirectoryAlias("/workspace/output", "darwin")).toBe("/workspace/output");
  });
});
