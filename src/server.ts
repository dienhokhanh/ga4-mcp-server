import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Ga4Clients } from "./clients.js";
import type { Config } from "./config.js";
import { registerPrompts } from "./prompts.js";
import { PropertyResolver } from "./properties.js";
import { registerAdminReadTools, registerAdminWriteTools } from "./tools/admin.js";
import type { ToolContext } from "./tools/common.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerReportingTools } from "./tools/reporting.js";
import { VERSION } from "./version.js";

const INSTRUCTIONS = `Google Analytics 4 tools.
Workflow: if you don't know the property, call list_properties (or list_accounts). Properties can be referenced by numeric ID or display name.
Before building an unfamiliar report, call get_metadata with a search term to find exact dimension/metric API names (custom ones look like customEvent:param). Use check_compatibility when a report fails with incompatible fields.
Prefer batch_run_reports for several related reports. Dates accept YYYY-MM-DD, "today", "yesterday" and "NdaysAgo".`;

export function createServer(config: Config, clients: Ga4Clients): McpServer {
  const server = new McpServer({ name: "ga4-mcp-server", version: VERSION }, { instructions: INSTRUCTIONS });

  const ctx: ToolContext = {
    clients,
    config,
    properties: new PropertyResolver(() => clients.admin, config.defaultProperty),
  };

  registerDiscoveryTools(server, ctx);
  registerMetadataTools(server, ctx);
  registerReportingTools(server, ctx);
  registerAdminReadTools(server, ctx);
  if (config.enableWrites) registerAdminWriteTools(server, ctx);
  registerPrompts(server);

  return server;
}
