import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { protos } from "@google-analytics/admin";
import { z } from "zod";
import { compact, handle, idOf, propertyArg, READ_ONLY, type ToolContext } from "./common.js";

const { RestrictedMetricType } = protos.google.analytics.admin.v1beta.CustomMetric;

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
const ARCHIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;

const MEASUREMENT_UNITS = [
  "STANDARD",
  "CURRENCY",
  "FEET",
  "METERS",
  "KILOMETERS",
  "MILES",
  "MILLISECONDS",
  "SECONDS",
  "MINUTES",
  "HOURS",
] as const;

interface NamedDefinition {
  name?: string | null;
  parameterName?: string | null;
  displayName?: string | null;
}

/** Find a custom definition by numeric ID or parameter name. */
function findDefinition<T extends NamedDefinition>(items: T[], idOrParameter: string, kind: string): T {
  const needle = idOrParameter.trim();
  const byId = items.find((d) => idOf(d.name) === idOf(needle));
  if (byId) return byId;
  const byParam = items.filter((d) => d.parameterName === needle);
  if (byParam.length === 1) return byParam[0]!;
  if (byParam.length > 1) {
    throw new Error(
      `Parameter "${needle}" is used by several ${kind}s (${byParam.map((d) => idOf(d.name)).join(", ")}); pass the numeric ID.`,
    );
  }
  throw new Error(`No active ${kind} matches "${needle}". Call list_${kind.replace(" ", "_")}s to see IDs.`);
}

export function registerAdminReadTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_custom_dimensions",
    {
      title: "List custom dimensions",
      description:
        "List a property's custom dimensions (parameter name, display name, scope). In reports they're referenced as customEvent:<param>, customUser:<param> or customItem:<param>.",
      inputSchema: { property: propertyArg },
      annotations: READ_ONLY,
    },
    ({ property }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.admin.listCustomDimensions({ parent });
        return compact(items) ?? [];
      }),
  );

  server.registerTool(
    "list_custom_metrics",
    {
      title: "List custom metrics",
      description: "List a property's custom metrics (parameter name, display name, unit, scope).",
      inputSchema: { property: propertyArg },
      annotations: READ_ONLY,
    },
    ({ property }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.admin.listCustomMetrics({ parent });
        return compact(items) ?? [];
      }),
  );

  server.registerTool(
    "list_key_events",
    {
      title: "List key events",
      description:
        "List a property's key events (formerly called conversions), with counting method and creation time.",
      inputSchema: { property: propertyArg },
      annotations: READ_ONLY,
    },
    ({ property }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.admin.listKeyEvents({ parent });
        return compact(items) ?? [];
      }),
  );

  server.registerTool(
    "list_audiences",
    {
      title: "List audiences",
      description:
        "List a property's audiences (uses the v1alpha Admin API). By default returns a summary; set includeDefinitions for full filter clauses.",
      inputSchema: {
        property: propertyArg,
        includeDefinitions: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    ({ property, includeDefinitions }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.adminAlpha.listAudiences({ parent });
        if (includeDefinitions) return compact(items) ?? [];
        return items.map((a) =>
          compact({
            name: a.name,
            displayName: a.displayName,
            description: a.description,
            membershipDurationDays: a.membershipDurationDays,
            adsPersonalizationEnabled: a.adsPersonalizationEnabled,
          }),
        );
      }),
  );
}

export function registerAdminWriteTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "create_custom_dimension",
    {
      title: "Create custom dimension",
      description:
        "Create a custom dimension on a property. This changes the GA4 configuration and counts against the property's custom dimension quota. Confirm with the user before calling.",
      inputSchema: {
        property: propertyArg,
        parameterName: z
          .string()
          .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/)
          .describe("Event/user/item parameter name, e.g. plan_type."),
        displayName: z.string().min(1).max(82),
        scope: z.enum(["EVENT", "USER", "ITEM"]).default("EVENT"),
        description: z.string().max(150).optional(),
        disallowAdsPersonalization: z.boolean().optional().describe("USER scope only."),
      },
      annotations: WRITE,
    },
    ({ property, ...fields }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [created] = await ctx.clients.admin.createCustomDimension({ parent, customDimension: fields });
        return compact(created);
      }),
  );

  server.registerTool(
    "create_custom_metric",
    {
      title: "Create custom metric",
      description:
        "Create an event-scoped custom metric on a property. This changes the GA4 configuration. Confirm with the user before calling.",
      inputSchema: {
        property: propertyArg,
        parameterName: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
        displayName: z.string().min(1).max(82),
        measurementUnit: z.enum(MEASUREMENT_UNITS).default("STANDARD"),
        description: z.string().max(150).optional(),
        restrictedMetricType: z
          .array(z.enum(["COST_DATA", "REVENUE_DATA"]))
          .optional()
          .describe("Only for CURRENCY metrics."),
      },
      annotations: WRITE,
    },
    ({ property, restrictedMetricType, ...fields }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [created] = await ctx.clients.admin.createCustomMetric({
          parent,
          customMetric: {
            ...fields,
            scope: "EVENT",
            restrictedMetricType: restrictedMetricType?.map((t) => RestrictedMetricType[t]),
          },
        });
        return compact(created);
      }),
  );

  server.registerTool(
    "create_key_event",
    {
      title: "Create key event",
      description:
        "Mark an event name as a key event (conversion) on a property. Confirm with the user before calling.",
      inputSchema: {
        property: propertyArg,
        eventName: z.string().min(1).max(40),
        countingMethod: z.enum(["ONCE_PER_EVENT", "ONCE_PER_SESSION"]).default("ONCE_PER_EVENT"),
      },
      annotations: WRITE,
    },
    ({ property, eventName, countingMethod }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [created] = await ctx.clients.admin.createKeyEvent({ parent, keyEvent: { eventName, countingMethod } });
        return compact(created);
      }),
  );

  server.registerTool(
    "archive_custom_dimension",
    {
      title: "Archive custom dimension",
      description:
        "Archive (retire) a custom dimension. It stops collecting and disappears from reports; this cannot be undone via the API. Always confirm with the user first.",
      inputSchema: {
        property: propertyArg,
        customDimension: z.string().describe("Numeric ID or parameter name of the custom dimension."),
      },
      annotations: ARCHIVE,
    },
    ({ property, customDimension }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.admin.listCustomDimensions({ parent });
        const target = findDefinition(items, customDimension, "custom dimension");
        await ctx.clients.admin.archiveCustomDimension({ name: target.name });
        return { archived: target.name, parameterName: target.parameterName, displayName: target.displayName };
      }),
  );

  server.registerTool(
    "archive_custom_metric",
    {
      title: "Archive custom metric",
      description:
        "Archive (retire) a custom metric. It stops collecting and disappears from reports; this cannot be undone via the API. Always confirm with the user first.",
      inputSchema: {
        property: propertyArg,
        customMetric: z.string().describe("Numeric ID or parameter name of the custom metric."),
      },
      annotations: ARCHIVE,
    },
    ({ property, customMetric }) =>
      handle(async () => {
        const parent = await ctx.properties.resolve(property);
        const [items] = await ctx.clients.admin.listCustomMetrics({ parent });
        const target = findDefinition(items, customMetric, "custom metric");
        await ctx.clients.admin.archiveCustomMetric({ name: target.name });
        return { archived: target.name, parameterName: target.parameterName, displayName: target.displayName };
      }),
  );
}
