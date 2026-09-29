import { describe, expect, it } from "vitest";
import { connect, mockClients } from "./helpers.js";

const WRITE_TOOLS = [
  "create_custom_dimension",
  "create_custom_metric",
  "create_key_event",
  "archive_custom_dimension",
  "archive_custom_metric",
];

describe("tool registration", () => {
  it("registers read-only tools by default", async () => {
    const { client } = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("run_report");
    expect(names).toContain("list_properties");
    for (const w of WRITE_TOOLS) expect(names).not.toContain(w);
  });

  it("registers write tools when enabled", async () => {
    const { client } = await connect({ enableWrites: true });
    const names = (await client.listTools()).tools.map((t) => t.name);
    for (const w of WRITE_TOOLS) expect(names).toContain(w);
  });

  it("marks read tools as read-only", async () => {
    const { client } = await connect();
    const tool = (await client.listTools()).tools.find((t) => t.name === "run_report");
    expect(tool?.annotations?.readOnlyHint).toBe(true);
  });

  it("exposes prompts", async () => {
    const { client } = await connect();
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    expect(prompts).toEqual(["weekly_traffic_summary", "top_landing_pages", "channel_performance"]);
    const prompt = await client.getPrompt({ name: "top_landing_pages", arguments: { property: "Blog", days: "7" } });
    expect(JSON.stringify(prompt.messages)).toContain("last 7 days");
  });
});

describe("discovery tools", () => {
  it("lists and filters properties", async () => {
    const { call } = await connect();
    const all = await call("list_properties");
    expect((all.json as unknown[]).length).toBe(3);
    const side = await call("list_properties", { account: "side" });
    expect(side.json).toEqual([
      expect.objectContaining({ id: "333", displayName: "Blog", accountName: "Side Project" }),
    ]);
  });

  it("resolves a property name for get_property", async () => {
    const clients = mockClients();
    clients.admin.getProperty.mockResolvedValue([
      { name: "properties/333", displayName: "Blog", timeZone: "UTC", parent: "" },
    ]);
    const { call } = await connect({}, clients);
    const res = await call("get_property", { property: "Blog" });
    expect(clients.admin.getProperty).toHaveBeenCalledWith({ name: "properties/333" });
    expect(res.json).toEqual({ name: "properties/333", displayName: "Blog", timeZone: "UTC" });
  });
});

describe("reporting tools", () => {
  it("builds a runReport request and formats the response", async () => {
    const clients = mockClients();
    clients.data.runReport.mockResolvedValue([
      {
        dimensionHeaders: [{ name: "sessionDefaultChannelGroup" }],
        metricHeaders: [{ name: "sessions", type: "TYPE_INTEGER" }],
        rows: [{ dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "42" }] }],
        rowCount: 1,
      },
    ]);
    const { call } = await connect({}, clients);
    const res = await call("run_report", {
      property: "111",
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["sessions"],
      orderBys: [{ field: "sessions", desc: true }],
      includeTotals: true,
      limit: 10,
    });

    expect(res.isError).toBe(false);
    expect(res.json).toMatchObject({ rows: [{ sessionDefaultChannelGroup: "Organic Search", sessions: 42 }] });
    const request = clients.data.runReport.mock.calls[0]![0];
    expect(request).toMatchObject({
      property: "properties/111",
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    });
    expect(request.metricAggregations).toHaveLength(1);
  });

  it("caps rows at GA4_MCP_MAX_ROWS", async () => {
    const clients = mockClients();
    const { call } = await connect({ maxRows: 20 }, clients);
    const res = await call("run_report", { property: "111", metrics: ["sessions"], limit: 500 });
    expect(clients.data.runReport.mock.calls[0]![0].limit).toBe(20);
    expect((res.json as { note: string }).note).toMatch(/reduced from 500 to 20/);
  });

  it("runs batch reports in one call", async () => {
    const clients = mockClients();
    clients.data.batchRunReports.mockResolvedValue([{ reports: [{ rowCount: 0 }, { rowCount: 0 }] }]);
    const { call } = await connect({}, clients);
    const res = await call("batch_run_reports", {
      property: "111",
      requests: [{ metrics: ["sessions"] }, { dimensions: ["country"], metrics: ["activeUsers"] }],
    });
    expect(res.json).toHaveLength(2);
    const request = clients.data.batchRunReports.mock.calls[0]![0];
    expect(request.property).toBe("properties/111");
    expect(request.requests).toHaveLength(2);
    expect(request.requests[0].property).toBeUndefined();
  });

  it("reports only the requested fields as incompatible", async () => {
    const clients = mockClients();
    clients.data.checkCompatibility.mockResolvedValue([
      {
        dimensionCompatibilities: [
          { dimensionMetadata: { apiName: "itemName" }, compatibility: "INCOMPATIBLE" },
          { dimensionMetadata: { apiName: "somethingElse" }, compatibility: "INCOMPATIBLE" },
        ],
        metricCompatibilities: [{ metricMetadata: { apiName: "sessions" }, compatibility: "COMPATIBLE" }],
      },
    ]);
    const { call } = await connect({}, clients);
    const res = await call("check_compatibility", { property: "1", dimensions: ["itemName"], metrics: ["sessions"] });
    expect(res.json).toEqual({ compatible: false, incompatibleDimensions: ["itemName"], incompatibleMetrics: [] });
  });

  it("searches metadata", async () => {
    const clients = mockClients();
    clients.data.getMetadata.mockResolvedValue([
      {
        dimensions: [
          { apiName: "country", uiName: "Country", category: "Geography" },
          { apiName: "customEvent:plan", uiName: "Plan", category: "Custom", customDefinition: true },
        ],
        metrics: [{ apiName: "sessions", uiName: "Sessions", category: "Session", type: "TYPE_INTEGER" }],
      },
    ]);
    const { call } = await connect({}, clients);
    const custom = await call("get_metadata", { property: "1", customOnly: true });
    expect(custom.json).toEqual({
      dimensions: [{ apiName: "customEvent:plan", uiName: "Plan", category: "Custom", custom: true }],
      metrics: [],
    });
    const search = await call("get_metadata", { property: "1", kind: "metrics", search: "sess" });
    expect(search.json).toEqual({
      metrics: [{ apiName: "sessions", uiName: "Sessions", category: "Session", type: "TYPE_INTEGER" }],
    });
    expect(clients.data.getMetadata).toHaveBeenCalledWith({ name: "properties/1/metadata" });
  });

  it("returns friendly errors from the API", async () => {
    const clients = mockClients();
    clients.data.runReport.mockRejectedValue(Object.assign(new Error("x"), { code: 7, details: "No access" }));
    const { call } = await connect({}, clients);
    const res = await call("run_report", { property: "1", metrics: ["sessions"] });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/Permission denied: No access/);
  });
});

describe("admin tools", () => {
  it("archives a custom dimension by parameter name", async () => {
    const clients = mockClients();
    clients.admin.listCustomDimensions.mockResolvedValue([
      [
        { name: "properties/1/customDimensions/10", parameterName: "plan", displayName: "Plan" },
        { name: "properties/1/customDimensions/11", parameterName: "tier", displayName: "Tier" },
      ],
    ]);
    const { call } = await connect({ enableWrites: true }, clients);
    const res = await call("archive_custom_dimension", { property: "1", customDimension: "tier" });
    expect(clients.admin.archiveCustomDimension).toHaveBeenCalledWith({ name: "properties/1/customDimensions/11" });
    expect(res.json).toMatchObject({ archived: "properties/1/customDimensions/11" });
  });

  it("creates a custom dimension", async () => {
    const clients = mockClients();
    const { call } = await connect({ enableWrites: true }, clients);
    await call("create_custom_dimension", { property: "1", parameterName: "plan_type", displayName: "Plan type" });
    expect(clients.admin.createCustomDimension).toHaveBeenCalledWith({
      parent: "properties/1",
      customDimension: { parameterName: "plan_type", displayName: "Plan type", scope: "EVENT" },
    });
  });

  it("summarises audiences unless definitions are requested", async () => {
    const clients = mockClients();
    clients.adminAlpha.listAudiences.mockResolvedValue([
      [{ name: "properties/1/audiences/5", displayName: "Buyers", filterClauses: [{ big: true }] }],
    ]);
    const { call } = await connect({}, clients);
    const res = await call("list_audiences", { property: "1" });
    expect(res.json).toEqual([{ name: "properties/1/audiences/5", displayName: "Buyers" }]);
  });
});
