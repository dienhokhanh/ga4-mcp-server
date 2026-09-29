import { describe, expect, it } from "vitest";
import { compact } from "../src/tools/common.js";

describe("compact", () => {
  it("drops empty protobuf defaults and converts timestamps", () => {
    expect(
      compact({
        name: "properties/1",
        displayName: "",
        parent: null,
        labels: [],
        nested: { a: undefined },
        createTime: { seconds: "1700000000", nanos: 500_000_000 },
        count: 0,
        flag: false,
      }),
    ).toEqual({ name: "properties/1", createTime: "2023-11-14T22:13:20.500Z", count: 0, flag: false });
  });
});
