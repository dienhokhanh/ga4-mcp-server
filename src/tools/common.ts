import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Ga4Clients } from "../clients.js";
import type { Config } from "../config.js";
import { explainError } from "../errors.js";
import type { PropertyResolver } from "../properties.js";

export interface ToolContext {
  clients: Ga4Clients;
  properties: PropertyResolver;
  config: Config;
}

export const propertyArg = z
  .string()
  .optional()
  .describe(
    'GA4 property: numeric ID ("123456789"), resource name ("properties/123456789") or display name ("My Website"). Defaults to GA4_DEFAULT_PROPERTY if set.',
  );

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data ?? null) }] };
}

export function fail(err: unknown): CallToolResult {
  return { isError: true, content: [{ type: "text", text: explainError(err) }] };
}

/** Run a tool body, returning compact JSON on success or a friendly error message. */
export async function handle(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

function isTimestamp(value: object): value is { seconds: string | number; nanos?: number } {
  const keys = Object.keys(value);
  return "seconds" in value && keys.every((k) => k === "seconds" || k === "nanos");
}

/**
 * Strip null/empty protobuf defaults and convert Timestamps to ISO strings so admin
 * resources stay small in the model's context.
 */
export function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(compact).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    if (isTimestamp(value)) {
      const ms = Number(value.seconds) * 1000 + Math.floor((value.nanos ?? 0) / 1e6);
      return new Date(ms).toISOString();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined || value === "") return undefined;
  return value;
}

export function idOf(resource: string | null | undefined): string {
  return (resource ?? "").split("/").pop() ?? "";
}
