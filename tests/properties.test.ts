import { describe, expect, it, vi } from "vitest";
import type { AdminClient } from "../src/clients.js";
import { PropertyResolver } from "../src/properties.js";
import { ACCOUNT_SUMMARIES } from "./helpers.js";

function resolver(defaultProperty?: string) {
  const listAccountSummaries = vi.fn().mockResolvedValue([ACCOUNT_SUMMARIES]);
  const admin = { listAccountSummaries } as unknown as AdminClient;
  return { r: new PropertyResolver(() => admin, defaultProperty), listAccountSummaries };
}

describe("PropertyResolver", () => {
  it("accepts numeric IDs and resource names without calling the API", async () => {
    const { r, listAccountSummaries } = resolver();
    await expect(r.resolve("111")).resolves.toBe("properties/111");
    await expect(r.resolve("properties/222")).resolves.toBe("properties/222");
    expect(listAccountSummaries).not.toHaveBeenCalled();
  });

  it("resolves display names (exact, case-insensitive) and unique substrings", async () => {
    const { r } = resolver();
    await expect(r.resolve("blog")).resolves.toBe("properties/333");
    await expect(r.resolve("Acme website")).resolves.toBe("properties/111");
    await expect(r.resolve("app")).resolves.toBe("properties/222");
  });

  it("rejects ambiguous and unknown names with guidance", async () => {
    const { r } = resolver();
    await expect(r.resolve("acme")).rejects.toThrow(/matches 2 properties/);
    await expect(r.resolve("nope")).rejects.toThrow(/list_properties/);
  });

  it("uses the default property and explains when none is set", async () => {
    await expect(resolver("333").r.resolve()).resolves.toBe("properties/333");
    await expect(resolver().r.resolve()).rejects.toThrow(/GA4_DEFAULT_PROPERTY/);
  });

  it("caches account summaries", async () => {
    const { r, listAccountSummaries } = resolver();
    await r.resolve("blog");
    await r.resolve("Acme App");
    expect(listAccountSummaries).toHaveBeenCalledTimes(1);
  });
});
