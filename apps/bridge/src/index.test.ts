import { describe, expect, it } from "vitest";
import { startLocalBridge, TESTED_CODEX_VERSION } from "./index.js";

const syntheticToken = "A".repeat(43);

describe("local bridge", () => {
  it("binds only to loopback and requires one-time authenticated pairing", async () => {
    const bridge = await startLocalBridge({
      preflight: { available: true, supported: true, version: TESTED_CODEX_VERSION },
      tokenFactory: () => syntheticToken,
    });
    try {
      expect(new URL(bridge.origin).hostname).toBe("127.0.0.1");
      expect(bridge.launchUrl).toBe(`${bridge.origin}/pair#${syntheticToken}`);

      const unauthenticated = await fetch(`${bridge.origin}/status`);
      expect(unauthenticated.status).toBe(401);

      const pairPage = await fetch(`${bridge.origin}/pair`);
      expect(pairPage.status).toBe(200);
      expect(pairPage.headers.get("cache-control")).toBe("no-store");
      expect(pairPage.headers.get("content-security-policy")).toContain("default-src 'none'");

      const paired = await fetch(`${bridge.origin}/pair`, {
        method: "POST",
        headers: { "x-flight-recorder-pairing-token": syntheticToken },
      });
      expect(paired.status).toBe(204);
      const cookie = paired.headers.get("set-cookie");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");

      const reused = await fetch(`${bridge.origin}/pair`, {
        method: "POST",
        headers: { "x-flight-recorder-pairing-token": syntheticToken },
      });
      expect(reused.status).toBe(409);

      const status = await fetch(`${bridge.origin}/status`, { headers: { cookie: cookie! } });
      expect(status.status).toBe(200);
      const body = await status.json() as { bindAddress: string; capabilities: string[]; appServer: { connected: boolean }; codex: { version?: string } };
      expect(body).toMatchObject({ bindAddress: "127.0.0.1", appServer: { connected: false }, codex: { version: TESTED_CODEX_VERSION } });
      expect(body.capabilities).not.toContain("command");
      expect(JSON.stringify(body)).not.toContain(syntheticToken);
    } finally {
      await bridge.close();
    }
  });

  it("rejects non-loopback origins and cross-origin requests", async () => {
    await expect(startLocalBridge({
      preflight: { available: false, supported: false },
      knownOrigins: ["https://example.invalid"],
      tokenFactory: () => syntheticToken,
    })).rejects.toThrow("loopback");

    const bridge = await startLocalBridge({ preflight: { available: false, supported: false }, tokenFactory: () => syntheticToken });
    try {
      const response = await fetch(`${bridge.origin}/pair`, { headers: { origin: "https://example.invalid" } });
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      await bridge.close();
    }
  });

  it("rejects invalid pairing tokens and generic routes without echoing secrets", async () => {
    const bridge = await startLocalBridge({ preflight: { available: false, supported: false }, tokenFactory: () => syntheticToken });
    try {
      const invalid = await fetch(`${bridge.origin}/pair`, {
        method: "POST",
        headers: { "x-flight-recorder-pairing-token": "B".repeat(43) },
      });
      expect(invalid.status).toBe(401);
      expect(await invalid.text()).not.toContain(syntheticToken);

      const paired = await fetch(`${bridge.origin}/pair`, { method: "POST", headers: { "x-flight-recorder-pairing-token": syntheticToken } });
      const cookie = paired.headers.get("set-cookie")!;
      const generic = await fetch(`${bridge.origin}/command`, { method: "POST", headers: { cookie } });
      expect(generic.status).toBe(404);
    } finally {
      await bridge.close();
    }
  });
});
