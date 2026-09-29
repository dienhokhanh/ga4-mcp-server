import { describe, expect, it } from "vitest";
import { explainError } from "../src/errors.js";

describe("explainError", () => {
  it("adds hints for common gRPC failures", () => {
    expect(explainError({ code: 7, details: "User does not have sufficient permissions" })).toMatch(
      /Property access management/,
    );
    expect(explainError({ code: 3, details: "Field foo is not a valid dimension" })).toMatch(/get_metadata/);
    expect(explainError({ code: 8, details: "Exhausted property tokens" })).toMatch(/quota/i);
    expect(explainError({ code: 16, details: "Request had invalid credentials" })).toMatch(
      /GOOGLE_APPLICATION_CREDENTIALS/,
    );
  });

  it("explains missing credentials and scopes", () => {
    expect(explainError(new Error("Could not load the default credentials."))).toMatch(/Authentication failed/);
    expect(explainError({ code: 7, details: "Request had insufficient authentication scopes." })).toMatch(
      /GA4_MCP_ENABLE_WRITES/,
    );
  });

  it("passes other errors through", () => {
    expect(explainError(new Error("boom"))).toBe("boom");
    expect(explainError("plain")).toBe("plain");
  });
});
