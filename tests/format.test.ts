import { describe, expect, it } from "vitest";
import { buildOrderBys, formatReport } from "../src/format.js";
import { buildReportRequest, clampLimit } from "../src/tools/reporting.js";

describe("formatReport", () => {
  const response = {
    dimensionHeaders: [{ name: "country" }],
    metricHeaders: [
      { name: "sessions", type: "TYPE_INTEGER" },
      { name: "engagementRate", type: "TYPE_FLOAT" },
    ],
    rows: [
      { dimensionValues: [{ value: "Vietnam" }], metricValues: [{ value: "120" }, { value: "0.61" }] },
      { dimensionValues: [{ value: "Japan" }], metricValues: [{ value: "80" }, { value: "0.5" }] },
    ],
    totals: [{ dimensionValues: [{ value: "RESERVED_TOTAL" }], metricValues: [{ value: "200" }, { value: "0.57" }] }],
    rowCount: 5,
    metadata: { currencyCode: "USD", timeZone: "Asia/Ho_Chi_Minh", subjectToThresholding: true },
  };

  it("turns rows into typed records", () => {
    const out = formatReport(response as never);
    expect(out.rows).toEqual([
      { country: "Vietnam", sessions: 120, engagementRate: 0.61 },
      { country: "Japan", sessions: 80, engagementRate: 0.5 },
    ]);
    expect(out.metrics).toEqual([
      { name: "sessions", type: "TYPE_INTEGER" },
      { name: "engagementRate", type: "TYPE_FLOAT" },
    ]);
    expect(out.totals?.[0]?.sessions).toBe(200);
    expect(out.metadata).toEqual({ currencyCode: "USD", timeZone: "Asia/Ho_Chi_Minh", subjectToThresholding: true });
  });

  it("notes when rows were truncated", () => {
    const out = formatReport(response as never, "extra");
    expect(out.rowCount).toBe(5);
    expect(out.returnedRows).toBe(2);
    expect(out.note).toBe("Showing 2 of 5 rows; use offset/limit to page. extra");
  });

  it("handles empty responses", () => {
    expect(formatReport({})).toEqual({ rowCount: 0, returnedRows: 0, dimensions: [], metrics: [], rows: [] });
  });
});

describe("request building", () => {
  it("maps order-by fields to metric or dimension", () => {
    expect(
      buildOrderBys(
        [
          { field: "sessions", desc: true },
          { field: "country", desc: false },
        ],
        ["sessions"],
      ),
    ).toEqual([
      { metric: { metricName: "sessions" }, desc: true },
      { dimension: { dimensionName: "country" }, desc: false },
    ]);
    expect(buildOrderBys(undefined, [])).toBeUndefined();
  });

  it("clamps the row limit", () => {
    expect(clampLimit(undefined, 1000)).toEqual({ limit: 100 });
    expect(clampLimit(50, 1000)).toEqual({ limit: 50 });
    expect(clampLimit(5000, 1000).limit).toBe(1000);
    expect(clampLimit(5000, 1000).note).toMatch(/GA4_MCP_MAX_ROWS/);
  });

  it("defaults the date range to the last 28 days", () => {
    const { request } = buildReportRequest(
      "properties/1",
      { dimensions: [], metrics: ["sessions"], includeTotals: false, keepEmptyRows: false },
      1000,
    );
    expect(request.dateRanges).toEqual([{ startDate: "28daysAgo", endDate: "yesterday" }]);
    expect(request.metricAggregations).toBeUndefined();
  });
});
