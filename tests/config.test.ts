import path from "node:path";
import { describe, expect, it } from "vitest";
import { EDIT_SCOPE, loadConfig, READONLY_SCOPE, scopesFor } from "../src/config.js";

describe("loadConfig", () => {
  it("uses safe defaults", () => {
    const config = loadConfig({ XDG_CONFIG_HOME: "/cfg", APPDATA: "C:\\AppData" });
    expect(config.enableWrites).toBe(false);
    expect(config.defaultProperty).toBeUndefined();
    expect(config.maxRows).toBe(1000);
    expect(path.basename(config.tokenFile)).toBe("token.json");
    expect(config.tokenFile).toContain("ga4-mcp-server");
  });

  it("reads environment overrides", () => {
    const config = loadConfig({
      GA4_MCP_ENABLE_WRITES: "TRUE",
      GA4_DEFAULT_PROPERTY: " 12345 ",
      GA4_MCP_MAX_ROWS: "50",
      GA4_MCP_TOKEN_FILE: "/tmp/t.json",
    });
    expect(config).toEqual({ enableWrites: true, defaultProperty: "12345", maxRows: 50, tokenFile: "/tmp/t.json" });
  });

  it("ignores an invalid row cap", () => {
    expect(loadConfig({ GA4_MCP_MAX_ROWS: "-3" }).maxRows).toBe(1000);
    expect(loadConfig({ GA4_MCP_MAX_ROWS: "abc" }).maxRows).toBe(1000);
  });

  it("requests the edit scope only when writes are enabled", () => {
    expect(scopesFor({ enableWrites: false })).toEqual([READONLY_SCOPE]);
    expect(scopesFor({ enableWrites: true })).toEqual([EDIT_SCOPE]);
  });
});
