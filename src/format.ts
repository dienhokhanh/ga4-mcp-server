import type { protos } from "@google-analytics/data";

type ReportResponse =
  | protos.google.analytics.data.v1beta.IRunReportResponse
  | protos.google.analytics.data.v1beta.IRunRealtimeReportResponse
  | protos.google.analytics.data.v1beta.IRunPivotReportResponse;
type Row = protos.google.analytics.data.v1beta.IRow;

export type Cell = string | number | null;
export type Record_ = Record<string, Cell>;

export interface OrderByInput {
  field: string;
  desc?: boolean;
}

export interface FormattedReport {
  rowCount: number;
  returnedRows: number;
  dimensions: string[];
  metrics: { name: string; type?: string }[];
  rows: Record_[];
  totals?: Record_[];
  metadata?: Record<string, unknown>;
  note?: string;
}

/** Map `{ field, desc }` to a GA4 OrderBy, deciding metric vs dimension from the request lists. */
export function buildOrderBys(
  orderBys: OrderByInput[] | undefined,
  metrics: string[],
): protos.google.analytics.data.v1beta.IOrderBy[] | undefined {
  if (!orderBys?.length) return undefined;
  return orderBys.map(({ field, desc }) =>
    metrics.includes(field)
      ? { metric: { metricName: field }, desc: !!desc }
      : { dimension: { dimensionName: field }, desc: !!desc },
  );
}

function toNumber(value: string | null | undefined): Cell {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function enumName(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function rowToRecord(row: Row, dimensions: string[], metrics: string[]): Record_ {
  const record: Record_ = {};
  dimensions.forEach((name, i) => {
    record[name] = row.dimensionValues?.[i]?.value ?? null;
  });
  metrics.forEach((name, i) => {
    record[name] = toNumber(row.metricValues?.[i]?.value);
  });
  return record;
}

/** Flatten a Data API response into compact JSON-friendly records. */
export function formatReport(response: ReportResponse, extraNote?: string): FormattedReport {
  const dimensions = (response.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const metricHeaders = response.metricHeaders ?? [];
  const metrics = metricHeaders.map((h) => h.name ?? "");
  const rows = (response.rows ?? []).map((r) => rowToRecord(r, dimensions, metrics));
  const rowCount = "rowCount" in response && typeof response.rowCount === "number" ? response.rowCount : rows.length;

  const result: FormattedReport = {
    rowCount,
    returnedRows: rows.length,
    dimensions,
    metrics: metricHeaders.map((h) => ({ name: h.name ?? "", type: enumName(h.type) })),
    rows,
  };

  if ("totals" in response && response.totals?.length) {
    result.totals = response.totals.map((r) => rowToRecord(r, dimensions, metrics));
  }

  if ("metadata" in response && response.metadata) {
    const m = response.metadata as protos.google.analytics.data.v1beta.IResponseMetaData;
    const metadata: Record<string, unknown> = {};
    if (m.currencyCode) metadata.currencyCode = m.currencyCode;
    if (m.timeZone) metadata.timeZone = m.timeZone;
    if (m.dataLossFromOtherRow) metadata.dataLossFromOtherRow = true;
    if (m.subjectToThresholding) metadata.subjectToThresholding = true;
    if (m.samplingMetadatas?.length) metadata.sampled = m.samplingMetadatas;
    if (Object.keys(metadata).length) result.metadata = metadata;
  }

  const notes: string[] = [];
  if (rowCount > rows.length) {
    notes.push(`Showing ${rows.length} of ${rowCount} rows; use offset/limit to page.`);
  }
  if (extraNote) notes.push(extraNote);
  if (notes.length) result.note = notes.join(" ");
  return result;
}
