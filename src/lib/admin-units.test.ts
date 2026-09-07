import { test } from "node:test";
import assert from "node:assert/strict";
import { municipalities, municipalitiesFor, municipalityById } from "./admin-units.ts";

test("753 municipalities, Rasuwa has 5", () => {
  assert.equal(municipalities.length, 753);
  assert.equal(municipalitiesFor("Rasuwa").length, 5);
  const one = municipalitiesFor("Rasuwa")[0];
  assert.equal(municipalityById(one.id)?.district, "Rasuwa");
  assert.equal(municipalityById(undefined), undefined);
});
