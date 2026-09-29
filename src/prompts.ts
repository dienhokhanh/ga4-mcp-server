import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const propertyArg = z.string().optional().describe("GA4 property ID or display name (optional if a default is set).");
const daysArg = z.string().optional().describe("Number of days to look back (default 28).");

function target(property?: string): string {
  return property ? `GA4 property "${property}"` : "my default GA4 property (ask me which one if no default is set)";
}

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "weekly_traffic_summary",
    {
      title: "Weekly traffic summary",
      description: "Summarise the last 7 days vs. the previous 7 days.",
      argsSchema: { property: propertyArg },
    },
    ({ property }) =>
      userMessage(
        `Write a concise weekly traffic summary for ${target(property)}.
Use run_report with two date ranges (7daysAgo→yesterday named "this_week", 14daysAgo→8daysAgo named "last_week") and metrics activeUsers, sessions, engagementRate, keyEvents, totalRevenue.
Then break sessions down by sessionDefaultChannelGroup and by deviceCategory (use batch_run_reports).
Report week-over-week % changes, call out the biggest movers, and end with 2–3 suggested actions.`,
      ),
  );

  server.registerPrompt(
    "top_landing_pages",
    {
      title: "Top landing pages",
      description: "Find the best and worst performing landing pages.",
      argsSchema: { property: propertyArg, days: daysArg },
    },
    ({ property, days }) =>
      userMessage(
        `For ${target(property)} over the last ${days ?? "28"} days, run a report with dimension landingPagePlusQueryString and metrics sessions, engagementRate, keyEvents, sessionKeyEventRate, ordered by sessions descending, limit 25.
Present a table, then highlight high-traffic pages with low engagement or key event rates and suggest what to investigate.`,
      ),
  );

  server.registerPrompt(
    "channel_performance",
    {
      title: "Channel performance",
      description: "Compare acquisition channels on volume, engagement and conversion.",
      argsSchema: { property: propertyArg, days: daysArg },
    },
    ({ property, days }) =>
      userMessage(
        `For ${target(property)} over the last ${days ?? "28"} days, compare acquisition channels.
Run a report with dimension sessionDefaultChannelGroup and metrics sessions, activeUsers, engagementRate, keyEvents, sessionKeyEventRate, totalRevenue, including totals.
Show each channel's share of sessions and key events, rank channels by efficiency, and recommend where to invest more.`,
      ),
  );
}
