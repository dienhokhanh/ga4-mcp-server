# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository. You should get a response within a few days.

## How credentials are handled

- The server runs locally over stdio and only talks to Google's Analytics Data and Admin APIs.
- Credentials are read from the locations you configure: `GOOGLE_APPLICATION_CREDENTIALS`, the saved token file, or gcloud ADC. They are never logged or sent anywhere else.
- The browser sign-in token is written with owner-only permissions (`0600` on macOS/Linux) to your user config directory.
- By default only the `analytics.readonly` scope is requested. `analytics.edit` is requested only when you opt into write tools.

## Recommendations

- Never commit key or token files. The provided `.gitignore` excludes common names.
- Grant the least privilege: **Viewer** on the specific GA4 properties you need.
- Leave `GA4_MCP_ENABLE_WRITES` off unless you need it, and keep your MCP client's tool-approval prompts on for write tools.
- Report data flows into your AI client's context, so apply your organisation's data-handling policies.
