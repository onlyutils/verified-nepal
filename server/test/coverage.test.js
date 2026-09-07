import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateCoverage, to3wRows, to3wGeoJson } from "../src/views/coverage.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const g = listMunicipalities("Rasuwa").find((m) => m.name === "Gosaikunda");
const n = (id, status, ward, extra = {}) => ({ id, status, category: "goods", createdAt: "2026-09-01T00:00:00.000Z", beneficiary: { name: "Ram Tamang", phone: "98", district: "Rasuwa", municipalityId: g.id, ward }, ...extra });

test("aggregateCoverage groups by municipality+ward and sorts unreached first", () => {
  const rows = aggregateCoverage([
    n("a", "published", 1), n("b", "matched", 1), n("c", "fulfilled", 1, { redeemedAt: "2026-09-05T00:00:00.000Z" }),
    n("d", "fulfilled", 2, { redeemedAt: "2026-09-03T00:00:00.000Z" }), n("e", "published", 3),
    { id: "old", status: "published", category: "goods", createdAt: "x", beneficiary: { district: "Rasuwa", ward: 4 } },
  ]);
  assert.deepEqual(rows.map((r) => [r.municipalityId, r.ward, r.open, r.matched, r.fulfilled, r.lastDeliveredAt]), [
    [null, 4, 1, 0, 0, null], [g.id, 3, 1, 0, 0, null], [g.id, 2, 0, 0, 1, "2026-09-03T00:00:00.000Z"], [g.id, 1, 1, 1, 1, "2026-09-05T00:00:00.000Z"],
  ]);
  assert.equal(rows[1].municipality, "Gosaikunda");
  assert.equal(rows[0].municipality, null);
});

test("3W rows carry an HXL row and no PII", () => {
  const out = to3wRows([n("a", "fulfilled", 1, { redeemedAt: "2026-09-05T00:00:00.000Z", deliveredBy: { kind: "org", label: "Nepal Red Cross" } }), n("b", "published", 2)]);
  assert.equal(out.header.length, out.hxl.length);
  assert.ok(out.hxl.includes("#adm3+code") && out.hxl.includes("#org+name") && out.hxl.includes("#status"));
  const text = JSON.stringify(out.rows);
  assert.ok(!text.includes("Ram") && !text.includes("98"));
  assert.equal(out.rows[0][out.header.indexOf("org")], "Nepal Red Cross");
  assert.equal(out.rows[1][out.header.indexOf("org")], "");
  assert.equal(out.rows[1][out.header.indexOf("status")], "open");
  assert.equal(out.rows[0][out.header.indexOf("province")], "Bagmati");
});

test("GeoJSON falls back ward → municipality → district centroid", () => {
  const fc = to3wGeoJson([n("a", "published", 1), n("b", "published", 99), { id: "c", status: "published", category: "goods", createdAt: "x", beneficiary: { district: "Rasuwa", ward: 1 } }]);
  assert.equal(fc.type, "FeatureCollection");
  assert.equal(fc.features.length, 3);
  assert.notDeepEqual(fc.features[0].geometry.coordinates, fc.features[1].geometry.coordinates);
  assert.deepEqual(fc.features[1].geometry.coordinates, [g.lng, g.lat]);
  assert.equal(fc.features[2].properties.municipality, null);
});
