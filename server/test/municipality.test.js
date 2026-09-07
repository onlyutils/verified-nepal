import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";
import { handlePostNeeds } from "../src/controllers/needController.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";
import { createNeed, getNeedById } from "../src/models/need.js";

const gosaikunda = listMunicipalities("Rasuwa").find((m) => m.name === "Gosaikunda");
const env = { TABLE_NAME: "t", REQUIRE_TURNSTILE: "0" };

function postNeed(body) {
  return { requestContext: { http: { method: "POST", path: "/needs" } }, body: JSON.stringify(body) };
}
function base(overrides = {}) {
  return {
    onBehalf: false, category: "goods", description: "Need rice and tarpaulin for the family", language: "en", incidentId: TEST_INCIDENT_ID,
    beneficiary: { name: "Ram Tamang", phone: "9800000000", district: "Rasuwa", ward: 3, municipalityId: gosaikunda.id, ...overrides },
  };
}

test("need requires a municipality that belongs to the district and a ward within its range", async () => {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const ctx = { getDdb: () => ddb, env };
  await assert.rejects(handlePostNeeds(postNeed(base({ municipalityId: undefined })), ctx), /beneficiary.municipalityId/);
  await assert.rejects(handlePostNeeds(postNeed(base({ district: "Nuwakot" })), ctx), /municipality is not in/);
  await assert.rejects(handlePostNeeds(postNeed(base({ ward: gosaikunda.wards + 1 })), ctx), /ward must be 1-/);
  const res = await handlePostNeeds(postNeed(base()), ctx);
  assert.equal(res.statusCode, 201);
  const { id } = JSON.parse(res.body);
  const need = await getNeedById(ddb, "t", id);
  assert.equal(need.beneficiary.municipalityId, gosaikunda.id);
  assert.equal(need.source, "web");
});

test("source is on-behalf or staff when applicable", async () => {
  const ddb = new FakeDdb();
  const a = await createNeed(ddb, "t", { onBehalf: true, regName: "A", regPhone: "9811111111", benName: "B", district: "Rasuwa", ward: 1, municipalityId: gosaikunda.id, category: "goods", description: "x".repeat(12), language: "en", incidentId: "general", registrantSub: "s1", source: "on-behalf" });
  assert.equal((await getNeedById(ddb, "t", a.id)).source, "on-behalf");
  const b = await createNeed(ddb, "t", { onBehalf: false, benName: "B", benPhone: "9811111111", district: "Rasuwa", ward: 1, municipalityId: gosaikunda.id, category: "goods", description: "x".repeat(12), language: "en", incidentId: "general", registeredByStaff: true, source: "staff" });
  assert.equal((await getNeedById(ddb, "t", b.id)).source, "staff");
});
