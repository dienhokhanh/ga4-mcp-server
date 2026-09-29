import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compact, handle, propertyArg, READ_ONLY, type ToolContext } from "./common.js";

export function registerDiscoveryTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_accounts",
    {
      title: "List GA4 accounts",
      description:
        "List the Google Analytics accounts the authenticated user can access, each with its GA4 properties (ID and display name). Start here when you don't know the property ID.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => handle(() => ctx.properties.accounts(true)),
  );

  server.registerTool(
    "list_properties",
    {
      title: "List GA4 properties",
      description:
        "List accessible GA4 properties as a flat list. Optionally filter by account (ID or name) or by a case-insensitive search on the property name.",
      inputSchema: {
        account: z.string().optional().describe("Account ID or (partial) account display name."),
        search: z.string().optional().describe("Case-insensitive substring of the property display name."),
      },
      annotations: READ_ONLY,
    },
    ({ account, search }) =>
      handle(async () => {
        let props = await ctx.properties.properties();
        if (account) {
          const a = account.toLowerCase().replace(/^accounts\//, "");
          props = props.filter((p) => p.accountId === a || p.accountName.toLowerCase().includes(a));
        }
        if (search) {
          const s = search.toLowerCase();
          props = props.filter((p) => p.displayName.toLowerCase().includes(s));
        }
        return props;
      }),
  );

  server.registerTool(
    "get_property",
    {
      title: "Get GA4 property details",
      description:
        "Get a GA4 property's settings: time zone, currency, industry category, service level (Standard/360), creation time and parent account.",
      inputSchema: { property: propertyArg },
      annotations: READ_ONLY,
    },
    ({ property }) =>
      handle(async () => {
        const name = await ctx.properties.resolve(property);
        const [result] = await ctx.clients.admin.getProperty({ name });
        return compact(result);
      }),
  );

  server.registerTool(
    "list_data_streams",
    {
      title: "List data streams",
      description:
        "List a property's data streams (web, Android, iOS) including measurement IDs (G-XXXX), website URLs and app IDs.",
      inputSchema: { property: propertyArg },
      annotations: READ_ONLY,
    },
    ({ property }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [streams] = await ctx.clients.admin.listDataStreams({ parent });
        return compact(streams) ?? [];
      }),
  );
}
