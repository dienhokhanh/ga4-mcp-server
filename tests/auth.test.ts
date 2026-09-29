import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveAuth } from "../src/auth.js";
import { loadConfig, READONLY_SCOPE } from "../src/config.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ga4-mcp-auth-"));
const tokenFile = path.join(dir, "token.json");
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("resolveAuth", () => {
  it("falls back to Application Default Credentials", () => {
    const auth = resolveAuth(loadConfig({ GA4_MCP_TOKEN_FILE: tokenFile }), {});
    expect(auth.method).toBe("application-default");
    expect(auth.options).toEqual({ scopes: [READONLY_SCOPE] });
  });

  it("uses a saved OAuth token when present", () => {
    fs.writeFileSync(tokenFile, "{}");
    const auth = resolveAuth(loadConfig({ GA4_MCP_TOKEN_FILE: tokenFile }), {});
    expect(auth.method).toBe("saved-oauth-token");
    expect(auth.options.keyFilename).toBe(tokenFile);
  });

  it("prefers GOOGLE_APPLICATION_CREDENTIALS over everything", () => {
    fs.writeFileSync(tokenFile, "{}");
    const auth = resolveAuth(loadConfig({ GA4_MCP_TOKEN_FILE: tokenFile }), {
      GOOGLE_APPLICATION_CREDENTIALS: "/keys/sa.json",
    });
    expect(auth.method).toBe("service-account-or-adc-env");
    expect(auth.options.keyFilename).toBe("/keys/sa.json");
  });
});
