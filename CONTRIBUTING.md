# Contributing

Thanks for helping improve `ga4-mcp-server`! Bug reports, docs fixes and new tools are all welcome.

## Setup

```bash
npm install
npm run build
npm test
```

Node.js 22+ is required.

## Project layout

```
src/
  index.ts        CLI entry: `auth` subcommand, --help/--version, starts the stdio server
  server.ts       Creates the McpServer and registers tools/prompts
  config.ts       Environment variables
  auth.ts         Chooses credentials (service account → saved token → ADC)
  oauth-flow.ts   Browser sign-in (loopback + PKCE)
  clients.ts      Lazily created Google Data/Admin API clients
  properties.ts   Property lookup by ID or display name
  format.ts       Compact report output
  errors.ts       Friendly error messages
  tools/          One file per tool group
  prompts.ts      MCP prompt templates
tests/            Vitest tests with mocked Google clients
scripts/          Docs generator and live smoke test
```

## Guidelines

- **Keep output small.** Tool results go into an LLM's context window. Prefer compact records, drop empty fields, and cap rows.
- **Errors should say how to fix the problem.** Add mappings to `src/errors.ts` when you hit a confusing Google error.
- **Write tools are opt-in.** Anything that changes GA4 configuration goes in `registerAdminWriteTools`, with accurate `destructiveHint` annotations and "confirm with the user" guidance in the description.
- **Tests must not need credentials.** Use the mock clients in `tests/helpers.ts`. Use `npm run smoke` for manual live checks.
- After adding or changing a tool, run `npm run build && npm run docs` to regenerate `docs/tools.md`.

## Before opening a PR

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

Add a line to `CHANGELOG.md` under **Unreleased**.

## Releasing (maintainers)

1. Update `version` in `package.json` **and** `server.json` (both places), and move the changelog entries under the new version.
2. Commit, then tag: `git tag v0.2.0 && git push --tags`.
3. The `release` workflow publishes to npm (with provenance), creates a GitHub Release and publishes to the MCP Registry.
