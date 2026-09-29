# ga4-mcp-server

[![CI](https://github.com/dienhokhanh/ga4-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/dienhokhanh/ga4-mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ga4-mcp-server)](https://www.npmjs.com/package/ga4-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io) server for **Google Analytics 4**. Ask your AI assistant questions like _"How did organic traffic change this week?"_ or _"Which landing pages convert worst?"_ and it queries GA4 for you.

Works with **Claude Code, Claude Desktop, OpenAI Codex, Cursor, VS Code (Copilot), Gemini CLI, Windsurf** and any other MCP client.

- 📊 **Reports**: standard, pivot, realtime and batched reports with filters, sorting, totals and date comparisons
- 🔎 **Discovery**: accounts, properties, data streams, dimension/metric catalogue, compatibility checks
- 🏷️ **Friendly property lookup**: say `"My Blog"` instead of `properties/123456789`
- 🧠 **Context-friendly output**: compact JSON records, row caps, and clear error messages with fix-it hints
- 🔐 **Three ways to sign in**: service account, browser sign-in, or gcloud Application Default Credentials
- ✍️ **Optional admin writes**: create custom dimensions/metrics and key events. **Off by default.**

## Quick start

**1. Get credentials.** You need Node.js 22+ and access to a GA4 property. The fastest route for most people is a service account:

1. In [Google Cloud Console](https://console.cloud.google.com/), pick or create a project and **enable** the _Google Analytics Data API_ and _Google Analytics Admin API_.
2. Go to **IAM & Admin → Service Accounts**, create a service account, and download a **JSON key**.
3. In **GA4 → Admin → Property access management**, add the service account's email as a **Viewer**.

Prefer to sign in with your own Google account? See [docs/authentication.md](docs/authentication.md).

**2. Add the server to your client** (replace the path and property):

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add ga4 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  -e GA4_DEFAULT_PROPERTY=123456789 \
  -- npx -y ga4-mcp-server
```

</details>

<details>
<summary><b>OpenAI Codex</b> (<code>~/.codex/config.toml</code>)</summary>

```toml
[mcp_servers.ga4]
command = "npx"
args = ["-y", "ga4-mcp-server"]

[mcp_servers.ga4.env]
GOOGLE_APPLICATION_CREDENTIALS = "/path/to/service-account.json"
GA4_DEFAULT_PROPERTY = "123456789"
```

Or: `codex mcp add ga4 --env GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json -- npx -y ga4-mcp-server`

</details>

<details>
<summary><b>Claude Desktop</b> (<code>claude_desktop_config.json</code>)</summary>

```json
{
  "mcpServers": {
    "ga4": {
      "command": "npx",
      "args": ["-y", "ga4-mcp-server"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "GA4_DEFAULT_PROPERTY": "123456789"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Cursor</b> (<code>~/.cursor/mcp.json</code>), <b>Gemini CLI</b> (<code>~/.gemini/settings.json</code>), <b>Windsurf</b></summary>

Same `mcpServers` block as Claude Desktop above.

</details>

<details>
<summary><b>VS Code</b> (<code>.vscode/mcp.json</code>)</summary>

```json
{
  "servers": {
    "ga4": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ga4-mcp-server"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

</details>

More ready-to-copy configs are in [`examples/`](examples/). On Windows, use paths like `C:\\keys\\sa.json` in JSON, or `'C:\keys\sa.json'` in TOML.

**3. Ask away:**

> Which GA4 properties can I access?
>
> Compare sessions and key events by channel for the last 28 days vs the previous 28 days.
>
> Show the top 20 landing pages by sessions last week, with engagement rate.
>
> How many people are on the site right now, by country?

## Tools

| Tool                                                                                 | What it does                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `list_accounts`                                                                      | Accounts you can access, each with its properties                                |
| `list_properties`                                                                    | Flat, filterable list of properties                                              |
| `get_property`                                                                       | Time zone, currency, industry, service level                                     |
| `list_data_streams`                                                                  | Web/app streams and measurement IDs                                              |
| `get_metadata`                                                                       | Searchable catalogue of dimensions & metrics (incl. custom)                      |
| `check_compatibility`                                                                | Can these dimensions and metrics be used together?                               |
| `run_report`                                                                         | Core Data API report: dimensions, metrics, date ranges, filters, sorting, totals |
| `batch_run_reports`                                                                  | Up to 5 reports in one call                                                      |
| `run_pivot_report`                                                                   | Cross-tab reports                                                                |
| `run_realtime_report`                                                                | Last 30 minutes of activity                                                      |
| `list_custom_dimensions`, `list_custom_metrics`, `list_key_events`, `list_audiences` | Property configuration                                                           |

**Write tools** (only when `GA4_MCP_ENABLE_WRITES=true`): `create_custom_dimension`, `create_custom_metric`, `create_key_event`, `archive_custom_dimension`, `archive_custom_metric`.

**Prompts:** `weekly_traffic_summary`, `top_landing_pages`, `channel_performance`.

Full parameter reference: [docs/tools.md](docs/tools.md).

## Configuration

| Variable                         | Default                    | Description                                                                |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | none                       | Path to a service account key (or other ADC JSON)                          |
| `GA4_DEFAULT_PROPERTY`           | none                       | Property ID or display name used when a tool call omits `property`         |
| `GA4_MCP_ENABLE_WRITES`          | `false`                    | Register write tools and request the `analytics.edit` scope                |
| `GA4_MCP_MAX_ROWS`               | `1000`                     | Hard cap on rows returned per report (protects the model's context window) |
| `GA4_MCP_TOKEN_FILE`             | OS config dir `token.json` | Where `ga4-mcp-server auth` saves the browser sign-in token                |

Credentials are chosen in this order: `GOOGLE_APPLICATION_CREDENTIALS` → saved browser sign-in token → Application Default Credentials.

## Enabling write tools

Write tools change your GA4 configuration, so they're opt-in:

1. Set `GA4_MCP_ENABLE_WRITES=true` in the server's `env`.
2. Give the service account **Editor** on the property (or re-run `npx ga4-mcp-server auth --enable-writes` for browser sign-in).

Tools are annotated (`readOnlyHint` / `destructiveHint`) so clients can ask you before running anything that changes data.

## Troubleshooting

| Message                                  | Fix                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Could not load the default credentials` | Set `GOOGLE_APPLICATION_CREDENTIALS`, or run `npx ga4-mcp-server auth`. See [authentication](docs/authentication.md).    |
| `Permission denied`                      | Add the service account / user to the GA4 property, and make sure both Analytics APIs are enabled in your Cloud project. |
| `... is not a valid dimension`           | Ask the assistant to call `get_metadata` with a search term to find the exact API name.                                  |
| `insufficient authentication scopes`     | Write tools need `GA4_MCP_ENABLE_WRITES=true` **and** credentials with the `analytics.edit` scope.                       |

Test the server interactively with the MCP Inspector: `npx @modelcontextprotocol/inspector npx -y ga4-mcp-server`.

## Development

```bash
git clone https://github.com/dienhokhanh/ga4-mcp-server.git
cd ga4-mcp-server
npm install
npm run build
npm test          # unit + integration tests (mocked Google APIs, no credentials needed)
npm run lint
npm run inspect   # open the MCP Inspector against the local build
npm run smoke     # optional: live read-only check against your GA4 (needs credentials)
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy & security

The server runs locally and talks only to Google's Analytics APIs. Report data goes to the AI client you connect it to, so treat it as you would any analytics export. Never commit credential files. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Not affiliated with or endorsed by Google. Google Analytics is a trademark of Google LLC.
