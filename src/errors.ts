// gRPC status codes returned by Google client libraries.
const INVALID_ARGUMENT = 3;
const NOT_FOUND = 5;
const PERMISSION_DENIED = 7;
const RESOURCE_EXHAUSTED = 8;
const FAILED_PRECONDITION = 9;
const UNAUTHENTICATED = 16;

interface GoogleError {
  code?: number | string;
  details?: string;
  message?: string;
}

const AUTH_HELP =
  "Check your credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service account key, run `npx ga4-mcp-server auth`, or run `gcloud auth application-default login` with the analytics scope. See the README 'Authentication' section.";

/** Turn a Google API / network error into a short, actionable message for the model and user. */
export function explainError(err: unknown): string {
  const e = (err ?? {}) as GoogleError;
  const raw = (e.details || e.message || String(err)).trim();
  const code = typeof e.code === "number" ? e.code : undefined;

  if (/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(raw)) {
    return `Insufficient OAuth scope: ${raw}\nWrite tools need the analytics.edit scope. Re-authenticate with GA4_MCP_ENABLE_WRITES=true (e.g. \`npx ga4-mcp-server auth --enable-writes\`).`;
  }
  if (/Could not load the default credentials|invalid_grant|unauthorized_client|invalid_client/i.test(raw)) {
    return `Authentication failed: ${raw}\n${AUTH_HELP}`;
  }

  switch (code) {
    case INVALID_ARGUMENT:
      return `Invalid request: ${raw}\nTip: use get_metadata for valid dimension/metric names and check_compatibility to validate combinations.`;
    case NOT_FOUND:
      return `Not found: ${raw}\nTip: call list_properties to see property IDs you can access.`;
    case PERMISSION_DENIED:
      return `Permission denied: ${raw}\nThe signed-in user or service account needs at least Viewer access on this GA4 property (GA4 Admin → Property access management). If the Analytics APIs are disabled, enable "Google Analytics Data API" and "Google Analytics Admin API" in your Google Cloud project.`;
    case RESOURCE_EXHAUSTED:
      return `GA4 API quota exhausted: ${raw}\nWait a while, or request fewer/smaller reports.`;
    case FAILED_PRECONDITION:
      return `Precondition failed: ${raw}`;
    case UNAUTHENTICATED:
      return `Authentication failed: ${raw}\n${AUTH_HELP}`;
    default:
      return raw;
  }
}
