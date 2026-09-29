import fs from "node:fs";
import { scopesFor, type Config } from "./config.js";

export type AuthMethod = "service-account-or-adc-env" | "saved-oauth-token" | "application-default";

/** Options passed to the Google API clients (a subset of GoogleAuthOptions). */
export type AuthOptions = { keyFilename?: string; scopes: string[] };

export interface ResolvedAuth {
  method: AuthMethod;
  options: AuthOptions;
}

/**
 * Decide which credentials to use. Order of precedence:
 *   1. GOOGLE_APPLICATION_CREDENTIALS (service account key or any ADC-compatible JSON)
 *   2. A token saved by `ga4-mcp-server auth` (browser OAuth sign-in)
 *   3. Application Default Credentials (e.g. `gcloud auth application-default login`)
 */
export function resolveAuth(config: Config, env: NodeJS.ProcessEnv = process.env): ResolvedAuth {
  const scopes = scopesFor(config);

  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {
      method: "service-account-or-adc-env",
      options: { keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS, scopes },
    };
  }

  if (fs.existsSync(config.tokenFile)) {
    return {
      method: "saved-oauth-token",
      options: { keyFilename: config.tokenFile, scopes },
    };
  }

  return { method: "application-default", options: { scopes } };
}

export function describeAuth(auth: ResolvedAuth): string {
  switch (auth.method) {
    case "service-account-or-adc-env":
      return `credentials file from GOOGLE_APPLICATION_CREDENTIALS (${auth.options.keyFilename})`;
    case "saved-oauth-token":
      return `saved OAuth token (${auth.options.keyFilename})`;
    case "application-default":
      return "Application Default Credentials";
  }
}
