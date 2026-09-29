import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { protos } from "@google-analytics/data";
import { z } from "zod";
import { handle, propertyArg, READ_ONLY, type ToolContext } from "./common.js";
import { filterArg } from "./reporting.js";

type FilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;

interface Field {
  apiName?: string | null;
  uiName?: string | null;
  description?: string | null;
  category?: string | null;
  customDefinition?: boolean | null;
  type?: unknown;
}

interface CompatibilityEntry {
  compatibility?: unknown;
  dimensionMetadata?: Field | null;
  metricMetadata?: Field | null;
}

function matches(field: Field, search?: string): boolean {
  if (!search) return true;
  const s = search.toLowerCase();
  return [field.apiName, field.uiName, field.category, field.description].some((v) =>
    (v ?? "").toLowerCase().includes(s),
  );
}

function shape(field: Field, includeDescriptions: boolean, isMetric: boolean) {
  return {
    apiName: field.apiName,
    uiName: field.uiName,
    category: field.category,
    ...(isMetric && field.type !== undefined && field.type !== null ? { type: String(field.type) } : {}),
    ...(field.customDefinition ? { custom: true } : {}),
    ...(includeDescriptions && field.description ? { description: field.description } : {}),
  };
}

export function registerMetadataTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "get_metadata",
    {
      title: "Get dimensions & metrics",
      description:
        "List the dimension and metric API names available for reports on a property, including the property's custom dimensions/metrics (e.g. customEvent:plan_type). Use `search` to narrow the list — the full catalogue is large.",
      inputSchema: {
        property: propertyArg,
        kind: z.enum(["all", "dimensions", "metrics"]).default("all"),
        search: z
          .string()
          .optional()
          .describe('Case-insensitive match on name, UI name, category or description, e.g. "session", "ecommerce".'),
        customOnly: z.boolean().default(false).describe("Only return the property's custom definitions."),
        includeDescriptions: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    ({ property, kind, search, customOnly, includeDescriptions }) =>
      handle(async () => {
        const name = `${await ctx.properties.resolve(property)}/metadata`;
        const [metadata] = await ctx.clients.data.getMetadata({ name });
        const pick = (fields: Field[] | null | undefined, isMetric: boolean) =>
          (fields ?? [])
            .filter((f) => (!customOnly || f.customDefinition) && matches(f, search))
            .map((f) => shape(f, includeDescriptions, isMetric));
        return {
          ...(kind !== "metrics" ? { dimensions: pick(metadata.dimensions, false) } : {}),
          ...(kind !== "dimensions" ? { metrics: pick(metadata.metrics, true) } : {}),
        };
      }),
  );

  server.registerTool(
    "check_compatibility",
    {
      title: "Check dimension/metric compatibility",
      description:
        "Check whether a set of dimensions and metrics can be used together in one report. Returns the incompatible fields (if any). Use before run_report when mixing scopes, e.g. item-scoped with session-scoped fields.",
      inputSchema: {
        property: propertyArg,
        dimensions: z.array(z.string()).default([]),
        metrics: z.array(z.string()).default([]),
        dimensionFilter: filterArg.optional(),
        metricFilter: filterArg.optional(),
      },
      annotations: READ_ONLY,
    },
    ({ property, dimensions, metrics, dimensionFilter, metricFilter }) =>
      handle(async () => {
        const [result] = await ctx.clients.data.checkCompatibility({
          property: await ctx.properties.resolve(property),
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dimensionFilter: dimensionFilter as FilterExpression | undefined,
          metricFilter: metricFilter as FilterExpression | undefined,
        });
        // The API rates every field in the catalogue; only report on the ones requested.
        const incompatible = (list: CompatibilityEntry[] | null | undefined, requested: string[]) =>
          (list ?? [])
            .filter((c) => String(c.compatibility) === "INCOMPATIBLE")
            .map((c) => (c.dimensionMetadata ?? c.metricMetadata)?.apiName ?? "")
            .filter((apiName) => requested.includes(apiName));
        const incompatibleDimensions = incompatible(result.dimensionCompatibilities, dimensions);
        const incompatibleMetrics = incompatible(result.metricCompatibilities, metrics);
        return {
          compatible: incompatibleDimensions.length === 0 && incompatibleMetrics.length === 0,
          incompatibleDimensions,
          incompatibleMetrics,
        };
      }),
  );
}
