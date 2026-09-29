import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { protos } from "@google-analytics/data";
import { z } from "zod";
import { buildOrderBys, formatReport } from "../format.js";
import { handle, propertyArg, READ_ONLY, type ToolContext } from "./common.js";

type FilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;
type RunReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;

const { MetricAggregation } = protos.google.analytics.data.v1beta;
type AggregationName = "TOTAL" | "MINIMUM" | "MAXIMUM" | "COUNT";
const TOTALS = [MetricAggregation.TOTAL];

const DEFAULT_LIMIT = 100;
const DEFAULT_DATE_RANGES = [{ startDate: "28daysAgo", endDate: "yesterday" }];

const FILTER_HELP = `A GA4 Data API FilterExpression object. Examples:
{"filter":{"fieldName":"country","stringFilter":{"matchType":"EXACT","value":"United States"}}}
{"filter":{"fieldName":"eventName","inListFilter":{"values":["purchase","sign_up"]}}}
{"filter":{"fieldName":"sessions","numericFilter":{"operation":"GREATER_THAN","value":{"int64Value":"100"}}}}
{"andGroup":{"expressions":[<expr>,<expr>]}} · {"orGroup":{"expressions":[...]}} · {"notExpression":<expr>}
stringFilter.matchType: EXACT | BEGINS_WITH | ENDS_WITH | CONTAINS | FULL_REGEXP | PARTIAL_REGEXP. Use dimension fields in dimensionFilter and metric fields in metricFilter.`;

export const filterArg = z.record(z.string(), z.unknown()).describe(FILTER_HELP);

const orderByArg = z
  .array(
    z.object({
      field: z.string().describe("A dimension or metric name from this request."),
      desc: z.boolean().optional().describe("Sort descending (default false)."),
    }),
  )
  .optional()
  .describe('Sort order, e.g. [{"field":"sessions","desc":true}].');

const dateRangeArg = z.object({
  startDate: z.string().describe('YYYY-MM-DD, "today", "yesterday" or "NdaysAgo" (e.g. "30daysAgo").'),
  endDate: z.string().describe('YYYY-MM-DD, "today", "yesterday" or "NdaysAgo".'),
  name: z.string().optional().describe("Optional label; adds a dateRange column when comparing ranges."),
});

const limitArg = z
  .number()
  .int()
  .min(1)
  .optional()
  .describe(`Max rows to return (default ${DEFAULT_LIMIT}; capped by GA4_MCP_MAX_ROWS).`);

export const reportShape = {
  dimensions: z
    .array(z.string())
    .max(9)
    .default([])
    .describe('Dimension API names, e.g. ["date","sessionDefaultChannelGroup"]. Use get_metadata to discover names.'),
  metrics: z
    .array(z.string())
    .min(1)
    .max(10)
    .describe('Metric API names, e.g. ["activeUsers","sessions","keyEvents","totalRevenue"].'),
  dateRanges: z
    .array(dateRangeArg)
    .min(1)
    .max(4)
    .optional()
    .describe("Up to 4 date ranges. Defaults to the last 28 days (28daysAgo → yesterday)."),
  dimensionFilter: filterArg.optional(),
  metricFilter: filterArg.optional(),
  orderBys: orderByArg,
  limit: limitArg,
  offset: z.number().int().min(0).optional().describe("Row offset for paging."),
  includeTotals: z.boolean().default(false).describe("Also return metric totals across all rows."),
  keepEmptyRows: z.boolean().default(false),
  currencyCode: z
    .string()
    .length(3)
    .optional()
    .describe('ISO 4217 code, e.g. "USD". Defaults to the property currency.'),
};

const reportSchema = z.object(reportShape);
export type ReportInput = z.infer<typeof reportSchema>;

/** Clamp the requested row limit to the configured maximum. */
export function clampLimit(requested: number | undefined, maxRows: number): { limit: number; note?: string } {
  const wanted = requested ?? DEFAULT_LIMIT;
  if (wanted <= maxRows) return { limit: wanted };
  return { limit: maxRows, note: `Row limit reduced from ${wanted} to ${maxRows} (GA4_MCP_MAX_ROWS).` };
}

export function buildReportRequest(
  property: string,
  input: ReportInput,
  maxRows: number,
): { request: RunReportRequest; note?: string } {
  const { limit, note } = clampLimit(input.limit, maxRows);
  const request: RunReportRequest = {
    property,
    dimensions: input.dimensions.map((name) => ({ name })),
    metrics: input.metrics.map((name) => ({ name })),
    dateRanges: input.dateRanges ?? DEFAULT_DATE_RANGES,
    dimensionFilter: input.dimensionFilter as FilterExpression | undefined,
    metricFilter: input.metricFilter as FilterExpression | undefined,
    orderBys: buildOrderBys(input.orderBys, input.metrics),
    limit,
    offset: input.offset,
    keepEmptyRows: input.keepEmptyRows,
    currencyCode: input.currencyCode,
    metricAggregations: input.includeTotals ? TOTALS : undefined,
  };
  return { request, note };
}

export function registerReportingTools(server: McpServer, ctx: ToolContext): void {
  const { maxRows } = ctx.config;

  server.registerTool(
    "run_report",
    {
      title: "Run GA4 report",
      description:
        'Run a Google Analytics 4 report (Data API runReport). Returns rows as JSON records keyed by dimension/metric name. Examples: traffic by channel, top pages, conversions by campaign, revenue by country, daily trend with dimension "date".',
      inputSchema: { property: propertyArg, ...reportShape },
      annotations: READ_ONLY,
    },
    ({ property, ...input }) =>
      handle(async () => {
        const { request, note } = buildReportRequest(await ctx.properties.resolve(property), input, maxRows);
        const [response] = await ctx.clients.data.runReport(request);
        return formatReport(response, note);
      }),
  );

  server.registerTool(
    "batch_run_reports",
    {
      title: "Run several GA4 reports",
      description:
        "Run up to 5 reports for one property in a single API call (cheaper and faster than separate run_report calls). Each request takes the same fields as run_report.",
      inputSchema: {
        property: propertyArg,
        requests: z.array(reportSchema).min(1).max(5),
      },
      annotations: READ_ONLY,
    },
    ({ property, requests }) =>
      handle(async () => {
        const resolved = await ctx.properties.resolve(property);
        const built = requests.map((r) => buildReportRequest(resolved, r, maxRows));
        const [response] = await ctx.clients.data.batchRunReports({
          property: resolved,
          requests: built.map(({ request }) => ({ ...request, property: undefined })),
        });
        return (response.reports ?? []).map((r, i) => formatReport(r, built[i]?.note));
      }),
  );

  server.registerTool(
    "run_pivot_report",
    {
      title: "Run GA4 pivot report",
      description:
        'Run a pivot (cross-tab) report. Every dimension must appear in exactly one pivot\'s fieldNames. Example: pivots [{fieldNames:["country"],limit:5},{fieldNames:["deviceCategory"],limit:3}] with metric sessions.',
      inputSchema: {
        property: propertyArg,
        dimensions: z.array(z.string()).min(1).max(9),
        metrics: reportShape.metrics,
        dateRanges: reportShape.dateRanges,
        pivots: z
          .array(
            z.object({
              fieldNames: z.array(z.string()).min(1).describe("Dimension names in this pivot."),
              limit: z.number().int().min(1).describe("Number of unique combinations to return for this pivot."),
              offset: z.number().int().min(0).optional(),
              orderBys: orderByArg,
              metricAggregations: z.array(z.enum(["TOTAL", "MINIMUM", "MAXIMUM", "COUNT"])).optional(),
            }),
          )
          .min(1)
          .max(3),
        dimensionFilter: filterArg.optional(),
        metricFilter: filterArg.optional(),
        keepEmptyRows: z.boolean().default(false),
        currencyCode: reportShape.currencyCode,
      },
      annotations: READ_ONLY,
    },
    ({
      property,
      dimensions,
      metrics,
      dateRanges,
      pivots,
      dimensionFilter,
      metricFilter,
      keepEmptyRows,
      currencyCode,
    }) =>
      handle(async () => {
        const [response] = await ctx.clients.data.runPivotReport({
          property: await ctx.properties.resolve(property),
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dateRanges: dateRanges ?? DEFAULT_DATE_RANGES,
          pivots: pivots.map((p) => ({
            fieldNames: p.fieldNames,
            limit: p.limit,
            offset: p.offset,
            orderBys: buildOrderBys(p.orderBys, metrics),
            metricAggregations: p.metricAggregations?.map((a: AggregationName) => MetricAggregation[a]),
          })),
          dimensionFilter: dimensionFilter as FilterExpression | undefined,
          metricFilter: metricFilter as FilterExpression | undefined,
          keepEmptyRows,
          currencyCode,
        });
        const pivotHeaders = (response.pivotHeaders ?? []).map((h) => ({
          rowCount: h.rowCount,
          combinations: (h.pivotDimensionHeaders ?? []).map((d) =>
            (d.dimensionValues ?? []).map((v) => v.value).join(" / "),
          ),
        }));
        return { ...formatReport(response), pivotHeaders };
      }),
  );

  server.registerTool(
    "run_realtime_report",
    {
      title: "Run GA4 realtime report",
      description:
        "Report on events from the last 30 minutes (up to 60 for GA4 360). Realtime supports a limited set of fields, e.g. dimensions country, city, deviceCategory, unifiedScreenName, eventName, minutesAgo; metrics activeUsers, eventCount, keyEvents, screenPageViews.",
      inputSchema: {
        property: propertyArg,
        dimensions: z.array(z.string()).max(9).default([]),
        metrics: z.array(z.string()).min(1).max(10).describe('e.g. ["activeUsers"]'),
        dimensionFilter: filterArg.optional(),
        metricFilter: filterArg.optional(),
        orderBys: orderByArg,
        limit: limitArg,
        minuteRanges: z
          .array(
            z.object({
              startMinutesAgo: z.number().int().min(0).optional(),
              endMinutesAgo: z.number().int().min(0).optional(),
              name: z.string().optional(),
            }),
          )
          .max(2)
          .optional()
          .describe("Defaults to the last 30 minutes."),
        includeTotals: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    ({ property, dimensions, metrics, dimensionFilter, metricFilter, orderBys, limit, minuteRanges, includeTotals }) =>
      handle(async () => {
        const clamped = clampLimit(limit, maxRows);
        const [response] = await ctx.clients.data.runRealtimeReport({
          property: await ctx.properties.resolve(property),
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          dimensionFilter: dimensionFilter as FilterExpression | undefined,
          metricFilter: metricFilter as FilterExpression | undefined,
          orderBys: buildOrderBys(orderBys, metrics),
          limit: clamped.limit,
          minuteRanges,
          metricAggregations: includeTotals ? TOTALS : undefined,
        });
        return formatReport(response, clamped.note);
      }),
  );
}
