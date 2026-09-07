import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";
import { handlePostNeeds } from "../src/controllers/needController.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const municipalityId = listMunicipalities("Gorkha")[0].id;
const env = { TABLE_NAME: "t", REQUIRE_TURNSTILE: "0" };

function body(submissionId) {
  return {
    onBehalf: false,
    beneficiary: { name: "Ram Tamang", phone: "9800000000", district: "Gorkha", municipalityId, ward: 1 },
    category: "goods",
    description: "Need rice and tarpaulin for this family",
    language: "en",
    incidentId: TEST_INCIDENT_ID,
    submissionId,
  };
}

test("replaying a submission id returns the original need", async () => {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const ctx = { getDdb: () => ddb, env };
  const first = await handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body("submission-123") }), ctx);
  const second = await handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body("submission-123") }), ctx);
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers["x-idempotent-replay"], "1");
  assert.deepEqual(JSON.parse(second.body), JSON.parse(first.body));
  assert.equal(ddb.store.size, 4);
});

test("different submission ids create different needs", async () => {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const ctx = { getDdb: () => ddb, env };
  const first = await handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body("submission-aaa") }), ctx);
  const second = await handlePostNeeds(makeEvent({ method: "POST", path: "/needs", body: body("submission-bbb") }), ctx);
  assert.notEqual(JSON.parse(first.body).id, JSON.parse(second.body).id);
  assert.equal(ddb.store.size, 7);
});
