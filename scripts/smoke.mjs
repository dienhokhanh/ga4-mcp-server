// Live, read-only smoke test against real GA4 using your configured credentials.
// Usage: npm run build && GA4_DEFAULT_PROPERTY=123456789 npm run smoke
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "smoke", version: "0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    env: { ...process.env, GA4_MCP_ENABLE_WRITES: "false" },
    stderr: "inherit",
  }),
);

async function step(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? "";
  console.log(`${res.isError ? "✗" : "✓"} ${name}: ${text.slice(0, 300)}${text.length > 300 ? "…" : ""}\n`);
  if (res.isError) process.exitCode = 1;
  return res.isError ? undefined : JSON.parse(text);
}

const props = await step("list_properties", {});
const property = process.env.GA4_DEFAULT_PROPERTY ?? props?.[0]?.id;
if (!property) {
  console.error("No accessible property found.");
  process.exit(1);
}
console.log(`Using property ${property}\n`);
await step("get_property", { property });
await step("get_metadata", { property, search: "session" });
await step("run_report", {
  property,
  dimensions: ["sessionDefaultChannelGroup"],
  metrics: ["sessions", "activeUsers"],
  dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
  orderBys: [{ field: "sessions", desc: true }],
  limit: 5,
  includeTotals: true,
});
await step("run_realtime_report", { property, metrics: ["activeUsers"] });
await client.close();
