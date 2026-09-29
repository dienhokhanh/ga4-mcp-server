import type { AdminClient } from "./clients.js";

export interface PropertySummary {
  id: string;
  name: string;
  displayName: string;
  propertyType?: string;
  accountId: string;
  accountName: string;
}

export interface AccountSummary {
  accountId: string;
  displayName: string;
  properties: PropertySummary[];
}

const CACHE_TTL_MS = 5 * 60_000;

function lastSegment(resource: string | null | undefined): string {
  return (resource ?? "").split("/").pop() ?? "";
}

/**
 * Lists accounts/properties the caller can see and turns user input ("123", "properties/123",
 * "My Website") into a `properties/123` resource name.
 */
export class PropertyResolver {
  private cache?: { at: number; accounts: AccountSummary[] };

  constructor(
    private readonly getAdmin: () => AdminClient,
    private readonly defaultProperty?: string,
  ) {}

  async accounts(forceRefresh = false): Promise<AccountSummary[]> {
    if (!forceRefresh && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.accounts;
    }
    const [summaries] = await this.getAdmin().listAccountSummaries({ pageSize: 200 });
    const accounts = summaries.map((s) => ({
      accountId: lastSegment(s.account),
      displayName: s.displayName ?? "",
      properties: (s.propertySummaries ?? []).map((p) => ({
        id: lastSegment(p.property),
        name: p.property ?? "",
        displayName: p.displayName ?? "",
        propertyType: typeof p.propertyType === "string" ? p.propertyType : undefined,
        accountId: lastSegment(s.account),
        accountName: s.displayName ?? "",
      })),
    }));
    this.cache = { at: Date.now(), accounts };
    return accounts;
  }

  async properties(): Promise<PropertySummary[]> {
    return (await this.accounts()).flatMap((a) => a.properties);
  }

  /** Resolve to `properties/<id>`. Numeric input never needs an API call. */
  async resolve(input?: string): Promise<string> {
    const value = (input ?? this.defaultProperty ?? "").trim();
    if (!value) {
      throw new Error(
        "No property given. Pass `property` (ID or display name), set GA4_DEFAULT_PROPERTY, or call list_properties first.",
      );
    }
    const idMatch = /^(?:properties\/)?(\d+)$/.exec(value);
    if (idMatch) return `properties/${idMatch[1]}`;

    const all = await this.properties();
    const needle = value.toLowerCase();
    const exact = all.filter((p) => p.displayName.toLowerCase() === needle);
    const candidates = exact.length ? exact : all.filter((p) => p.displayName.toLowerCase().includes(needle));

    if (candidates.length === 1) return candidates[0]!.name;
    if (candidates.length === 0) {
      throw new Error(`No GA4 property matches "${value}". Call list_properties to see available properties.`);
    }
    const list = candidates
      .slice(0, 10)
      .map((p) => `- ${p.displayName} (${p.id}, account "${p.accountName}")`)
      .join("\n");
    throw new Error(`"${value}" matches ${candidates.length} properties; pass the numeric ID instead:\n${list}`);
  }
}
