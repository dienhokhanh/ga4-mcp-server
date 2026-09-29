import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { vi } from "vitest";
import type { Ga4Clients } from "../src/clients.js";
import { loadConfig, type Config } from "../src/config.js";
import { createServer } from "../src/server.js";

export const ACCOUNT_SUMMARIES = [
  {
    account: "accounts/100",
    displayName: "Acme Corp",
    propertySummaries: [
      { property: "properties/111", displayName: "Acme Website", propertyType: "PROPERTY_TYPE_ORDINARY" },
      { property: "properties/222", displayName: "Acme App", propertyType: "PROPERTY_TYPE_ORDINARY" },
    ],
  },
  {
    account: "accounts/200",
    displayName: "Side Project",
    propertySummaries: [{ property: "properties/333", displayName: "Blog", propertyType: "PROPERTY_TYPE_ORDINARY" }],
  },
];

/** Mock Google clients: every method resolves to `[response]` like the real gax clients. */
export function mockClients() {
  const resolved = (value: unknown) => vi.fn().mockResolvedValue([value]);
  const data = {
    runReport: resolved({}),
    batchRunReports: resolved({ reports: [] }),
    runPivotReport: resolved({}),
    runRealtimeReport: resolved({}),
    getMetadata: resolved({ dimensions: [], metrics: [] }),
    checkCompatibility: resolved({}),
  };
  const admin = {
    listAccountSummaries: resolved(ACCOUNT_SUMMARIES),
    getProperty: resolved({}),
    listDataStreams: resolved([]),
    listCustomDimensions: resolved([]),
    listCustomMetrics: resolved([]),
    listKeyEvents: resolved([]),
    createCustomDimension: resolved({}),
    createCustomMetric: resolved({}),
    createKeyEvent: resolved({}),
    archiveCustomDimension: resolved({}),
    archiveCustomMetric: resolved({}),
  };
  const adminAlpha = { listAudiences: resolved([]) };
  return { data, admin, adminAlpha };
}

export type MockClients = ReturnType<typeof mockClients>;

export async function connect(overrides: Partial<Config> = {}, clients: MockClients = mockClients()) {
  const config = { ...loadConfig({}), ...overrides };
  const server = createServer(config, clients as unknown as Ga4Clients);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { isError: !!result.isError, text, json };
  }

  return { client, clients, call };
}
