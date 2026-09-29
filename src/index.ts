#!/usr/bin/env node
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { describeAuth, resolveAuth } from "./auth.js";
import { createClients } from "./clients.js";
import { EDIT_SCOPE, loadConfig, READONLY_SCOPE } from "./config.js";
import { runAuthFlow } from "./oauth-flow.js";
import { createServer } from "./server.js";
import { VERSION } from "./version.js";

const HELP = `ga4-mcp-server ${VERSION} — MCP server for Google Analytics 4

Usage:
  ga4-mcp-server                         Start the MCP server on stdio (what MCP clients run)
  ga4-mcp-server auth --client-secret <client_secret.json> [--enable-writes] [--no-browser]
                                         Sign in with Google in the browser and save a token
  ga4-mcp-server --help | --version

Environment:
  GOOGLE_APPLICATION_CREDENTIALS  Service account key (or other ADC JSON) to use
  GA4_DEFAULT_PROPERTY            Property ID or name used when a tool omits "property"
  GA4_MCP_ENABLE_WRITES=true      Register tools that change GA4 configuration
  GA4_MCP_MAX_ROWS                Max rows per report (default 1000)
  GA4_MCP_TOKEN_FILE              Where the OAuth token is stored

Docs: https://github.com/dienhokhanh/ga4-mcp-server#readme`;

async function authCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      "client-secret": { type: "string" },
      "enable-writes": { type: "boolean", default: false },
      "no-browser": { type: "boolean", default: false },
    },
  });
  const clientSecretFile = values["client-secret"] ?? process.env.GA4_MCP_OAUTH_CLIENT_FILE;
  if (!clientSecretFile) {
    throw new Error("Missing --client-secret <path to OAuth client JSON> (or set GA4_MCP_OAUTH_CLIENT_FILE).");
  }
  const config = loadConfig();
  const writes = values["enable-writes"] || config.enableWrites;
  const saved = await runAuthFlow({
    clientSecretFile,
    tokenFile: config.tokenFile,
    scopes: [writes ? EDIT_SCOPE : READONLY_SCOPE],
    openBrowser: !values["no-browser"],
  });
  console.error(
    `Saved credentials to ${saved}${writes ? " (with edit scope)" : ""}. You can now start the MCP server.`,
  );
}

async function serve(): Promise<void> {
  const config = loadConfig();
  const auth = resolveAuth(config);
  const server = createServer(config, createClients(auth.options));
  await server.connect(new StdioServerTransport());
  // stdout carries the MCP protocol; diagnostics go to stderr.
  console.error(
    `ga4-mcp-server ${VERSION} running on stdio — auth: ${describeAuth(auth)}; writes ${config.enableWrites ? "enabled" : "disabled"}`,
  );
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
  } else if (command === "--version" || command === "-v") {
    console.log(VERSION);
  } else if (command === "auth") {
    await authCommand(rest);
  } else if (command === undefined) {
    await serve();
  } else {
    console.error(`Unknown command "${command}".\n\n${HELP}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
