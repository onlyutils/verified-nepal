import assert from "node:assert/strict";
import test from "node:test";
import { fillTemplate, leadHeadline, responseDay } from "./edition.ts";

test("responseDay counts from 26 Aug 2026 in Nepal time", () => {
  assert.equal(responseDay(new Date("2026-08-26T00:00:00+05:45")), 1);
  assert.equal(responseDay(new Date("2026-08-26T23:59:00+05:45")), 1);
  assert.equal(responseDay(new Date("2026-08-27T00:01:00+05:45")), 2);
  assert.equal(responseDay(new Date("2026-08-31T17:45:00+05:45")), 6);
  // Never below 1, even if a clock is behind.
  assert.equal(responseDay(new Date("2026-08-20T00:00:00+05:45")), 1);
});

test("fillTemplate replaces every placeholder and leaves unknown ones", () => {
  assert.equal(fillTemplate("{a} and {b} and {a}", { a: "1", b: "2" }), "1 and 2 and 1");
  assert.equal(fillTemplate("{a} {zzz}", { a: "1" }), "1 {zzz}");
});

test("leadHeadline picks the no-missing variant when missing is null", () => {
  const t = { leadHeadline: "{rescued} rescued; {missing} missing", leadHeadlineNoMissing: "{rescued} rescued" };
  assert.equal(leadHeadline(t, "2,189", "54"), "2,189 rescued; 54 missing");
  assert.equal(leadHeadline(t, "2,189", null), "2,189 rescued");
});
