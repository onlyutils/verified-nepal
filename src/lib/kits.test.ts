import { test } from "node:test";
import assert from "node:assert/strict";
import { expandKit, getKit, KITS } from "./kits.ts";

test("kit expansion multiplies item quantities and weight", () => {
  const expanded = expandKit("hygiene-parcel", 4);
  assert.equal(expanded?.weightKg, 24);
  assert.deepEqual(expanded?.items[0], { category: "soap", qty: 24, unit: "piece" });
});

test("unknown kit id returns undefined", () => {
  assert.equal(getKit("not-a-kit"), undefined);
  assert.equal(expandKit("not-a-kit", 2), undefined);
});

test("catalogue has all named kits", () => {
  assert.deepEqual(KITS.map((kit) => kit.id), [
    "family-kit",
    "hygiene-parcel",
    "kitchen-set",
    "tarpaulin-4x6",
    "water-day",
    "shelter-toolkit",
  ]);
});
