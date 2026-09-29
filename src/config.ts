import os from "node:os";
import path from "node:path";

export const READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const EDIT_SCOPE = "https://www.googleapis.com/auth/analytics.edit";

export interface Config {
  /** Register tools that modify GA4 configuration (custom definitions, key events). */
  enableWrites: boolean;
  /** Property used when a tool call omits `property`. ID, `properties/ID` or display name. */
  defaultProperty?: string;
  /** Path of the saved OAuth token written by `ga4-mcp-server auth`. */
  tokenFile: string;
  /** Hard cap on rows returned by a single report, to protect the model's context window. */
  maxRows: number;
}

function parseBool(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function defaultConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === "win32" && env.APPDATA) {
    return path.join(env.APPDATA, "ga4-mcp-server");
  }
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ga4-mcp-server");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    enableWrites: parseBool(env.GA4_MCP_ENABLE_WRITES),
    defaultProperty: env.GA4_DEFAULT_PROPERTY?.trim() || undefined,
    tokenFile: env.GA4_MCP_TOKEN_FILE?.trim() || path.join(defaultConfigDir(env), "token.json"),
    maxRows: parsePositiveInt(env.GA4_MCP_MAX_ROWS, 1000),
  };
}

export function scopesFor(config: Pick<Config, "enableWrites">): string[] {
  return [config.enableWrites ? EDIT_SCOPE : READONLY_SCOPE];
}
