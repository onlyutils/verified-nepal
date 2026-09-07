import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { KITS, expandKit, getKit } from "../src/lib/kits.js";
import { isGoodsCategory } from "../src/lib/goods-taxonomy.js";

test("kit expansion multiplies item quantities and weight", () => {
  const expanded = expandKit("family-kit", 3);
  assert.equal(expanded.weightKg, 135);
  assert.deepEqual(expanded.items[0], { category: "rice", qty: 90, unit: "kg" });
  assert.deepEqual(expanded.items.at(-1), { category: "jerrycan", qty: 3, unit: "20 L" });
});

test("unknown kit id returns undefined", () => {
  assert.equal(getKit("not-a-kit"), undefined);
  assert.equal(expandKit("not-a-kit", 2), undefined);
});

test("every kit category is in the goods taxonomy", () => {
  for (const kit of KITS) {
    for (const item of kit.items) assert.equal(isGoodsCategory(item.category), true, `${kit.id}: ${item.category}`);
  }
});

test("GET /kits is public and cached for one day", async () => {
  const handler = createHandler({ env: {} });
  const response = await handler({
    rawPath: "/kits",
    headers: {},
    requestContext: { http: { method: "GET", path: "/kits" } },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "public, max-age=86400");
  assert.deepEqual(JSON.parse(response.body), { kits: KITS });
});
