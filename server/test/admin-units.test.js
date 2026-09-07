import { test } from "node:test";
import assert from "node:assert/strict";
import { getMunicipality, municipalityInDistrict, wardInMunicipality, listMunicipalities, wardCentroid, DISTRICT_CENTROIDS, PROVINCE_OF } from "../src/lib/adminUnits.js";
import { DISTRICTS } from "../src/constants.js";
import data from "../src/data/admin-units.json" with { type: "json" };

test("dataset has exactly 753 local units of the four allowed types", () => {
  assert.equal(data.municipalities.length, 753);
  const types = new Set(data.municipalities.map((m) => m.type));
  assert.deepEqual([...types].sort(), ["Metropolitan City", "Municipality", "Rural Municipality", "Submetropolitan City"]);
});

test("every municipality district is a known server district and every district has at least one", () => {
  const seen = new Set();
  for (const m of data.municipalities) {
    assert.ok(DISTRICTS.includes(m.district), `unknown district ${m.district} on ${m.name}`);
    seen.add(m.district);
  }
  assert.equal(seen.size, 77);
});

test("ward counts and centroids are present", () => {
  for (const m of data.municipalities) {
    assert.ok(m.wards >= 1 && m.wards <= 33, `${m.name} wards=${m.wards}`);
    const keys = Object.keys(m.wardCentroids).map(Number);
    assert.ok(keys.length >= 1 && keys.length <= m.wards && Math.max(...keys) === m.wards, `${m.name} ward keys`);
    assert.ok(m.lat > 26 && m.lat < 31 && m.lng > 80 && m.lng < 89);
  }
});

test("helpers", () => {
  const rasuwa = listMunicipalities("Rasuwa");
  assert.equal(rasuwa.length, 5);
  const gosaikunda = rasuwa.find((m) => m.name === "Gosaikunda");
  assert.ok(gosaikunda);
  assert.equal(getMunicipality(gosaikunda.id).district, "Rasuwa");
  assert.equal(municipalityInDistrict(gosaikunda.id, "Rasuwa"), true);
  assert.equal(municipalityInDistrict(gosaikunda.id, "Nuwakot"), false);
  assert.equal(wardInMunicipality(gosaikunda.id, 1), true);
  assert.equal(wardInMunicipality(gosaikunda.id, gosaikunda.wards + 1), false);
  assert.equal(wardInMunicipality(999999, 1), false);
  assert.ok(Array.isArray(wardCentroid(gosaikunda.id, 1)));
  assert.equal(wardCentroid(gosaikunda.id, 99), undefined);
  assert.ok(DISTRICT_CENTROIDS.Rasuwa);
  assert.equal(PROVINCE_OF.Rasuwa, "Bagmati");
});
