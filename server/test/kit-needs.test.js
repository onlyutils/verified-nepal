import { test } from "node:test";
import assert from "node:assert/strict";
import { handlePostNeeds } from "../src/controllers/needController.js";
import { toPublicNeedListItem, toStatusView } from "../src/views/need.js";
import { to3wRows } from "../src/views/coverage.js";
import { FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const municipalityId = listMunicipalities("Gorkha")[0].id;
const env = { TABLE_NAME: "t", REQUIRE_TURNSTILE: "0" };

function body(overrides = {}) {
  return {
    onBehalf: false,
    beneficiary: { name: "Ram Tamang", phone: "9800000000", district: "Gorkha", municipalityId, ward: 1 },
    category: "goods",
    description: "Need rice and tarpaulin for this family",
    language: "en",
    incidentId: TEST_INCIDENT_ID,
    ...overrides,
  };
}

test("POST /needs validates and expands a standard kit", async () => {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const response = await handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body({ kit: { kitId: "family-kit", households: 3 } }) }), { getDdb: () => ddb, env });
  assert.equal(response.statusCode, 201);
  const created = JSON.parse(response.body);
  const stored = ddb.store.get(`NEED#${created.id}|META`);
  assert.deepEqual(stored.kit, { kitId: "family-kit", households: 3 });
  assert.equal(stored.kitItems.find((item) => item.category === "rice").qty, 90);
  assert.equal(stored.kitWeightKg, 135);
});

test("POST /needs rejects unknown and invalid kit values", async () => {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const ctx = { getDdb: () => ddb, env };
  await assert.rejects(
    () => handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body({ kit: { kitId: "not-a-kit", households: 1 } }) }), ctx),
    /kit\.kitId is unknown/,
  );
  await assert.rejects(
    () => handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body({ kit: { kitId: "family-kit", households: 0 } }) }), ctx),
    /kit\.households must be integer/,
  );
});

test("public need views expose kit name and households, not expanded internals", () => {
  const need = {
    id: "n1",
    status: "published",
    category: "goods",
    description: "Need rice and tarpaulin for this family",
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-10-01T00:00:00.000Z",
    beneficiary: { name: "Ram Tamang", district: "Gorkha", municipalityId, ward: 1 },
    kit: { kitId: "family-kit", households: 2 },
    kitItems: [{ category: "rice", qty: 60, unit: "kg" }],
    kitWeightKg: 90,
  };
  const list = toPublicNeedListItem(need);
  const status = toStatusView(need);
  for (const view of [list, status]) {
    assert.equal(view.kit.name, "Family kit");
    assert.equal(view.kit.households, 2);
    assert.equal(view.kit.items, undefined);
    assert.equal(view.kit.kitId, undefined);
    assert.equal(view.kit.weightKg, undefined);
  }
});

test("3W rows include planned kit columns", () => {
  const out = to3wRows([{
    id: "n1",
    status: "published",
    category: "goods",
    createdAt: "2026-09-01T00:00:00.000Z",
    beneficiary: { district: "Gorkha", municipalityId, ward: 1 },
    kit: { kitId: "family-kit", households: 4 },
  }]);
  assert.equal(out.header[out.header.indexOf("kit")], "kit");
  assert.equal(out.hxl[out.header.indexOf("kit")], "#item+kit");
  assert.equal(out.hxl[out.header.indexOf("kit_households")], "#reached+households+planned");
  assert.equal(out.rows[0][out.header.indexOf("kit")], "family-kit");
  assert.equal(out.rows[0][out.header.indexOf("kit_households")], "4");
});
