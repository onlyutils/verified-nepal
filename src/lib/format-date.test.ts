import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime, formatMonth } from "./format-date.ts";

describe("date formatters", () => {
  it("return an empty string for missing or invalid dates", () => {
    for (const value of [undefined, null, "not-a-date", Number.NaN, new Date("invalid")]) {
      assert.doesNotThrow(() => formatDateTime(value, "en"));
      assert.equal(formatDateTime(value, "en"), "");
      assert.equal(formatMonth(value, "en"), "");
    }
  });

  it("formats valid dates", () => {
    assert.match(formatDateTime("2026-01-02T03:04:00.000Z", "en"), /2026.*NPT/);
    assert.match(formatMonth("2026-01-02T03:04:00.000Z", "en"), /2026/);
  });
});
