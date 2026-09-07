import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const gorkhaMunicipalityId = listMunicipalities("Gorkha")[0].id;

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  const token = (sub) => createToken(basePayload({ sub }), kp.privateKey);
  return { handler, ddb, token };
}

function seedProfile(ddb, sub, role, extra = {}) {
  ddb.store.set(`USER#${sub}|PROFILE`, {
    PK: `USER#${sub}`, SK: "PROFILE", type: "USER", sub, role, districts: [], ...extra,
  });
}

describe("work tally", () => {
  beforeEach(() => clearJwksCache());

  it("tallies a moderation publish and keeps its audit item", async () => {
    const { handler, ddb, token } = setup();
    seedProfile(ddb, "moderator-1", "moderator", { guidelinesAckAt: "2026-01-01T00:00:00.000Z" });
    const created = await handler(makeEvent({
      method: "POST", path: "/needs", body: {
        onBehalf: false,
        beneficiary: { name: "Rita Gurung", phone: "+9779800000001", district: "Gorkha", municipalityId: gorkhaMunicipalityId, ward: 5 },
        category: "goods", description: "Need food and water for this moderation test", language: "en", incidentId: TEST_INCIDENT_ID,
      },
    }));
    assert.equal(created.statusCode, 201);
    const { id } = JSON.parse(created.body);
    const published = await handler(makeEvent({
      method: "POST", path: `/moderation/${id}`, headers: { authorization: `Bearer ${token("moderator-1")}` }, body: { action: "publish" },
    }));
    assert.equal(published.statusCode, 200);
    const month = new Date().toISOString().slice(0, 7);
    const work = ddb.store.get(`USER#moderator-1|WORK#${month}`);
    assert.equal(work.c_publish, 1);
    assert.equal(work.total, 1);
    assert.ok(Array.from(ddb.store.values()).some((item) => item.type === "AUDIT" && item.actorSub === "moderator-1" && item.action === "publish"));
  });

  it("tallies an on-behalf need registration", async () => {
    const { handler, ddb, token } = setup();
    seedProfile(ddb, "helper-1", "helper");
    const res = await handler(makeEvent({
      method: "POST", path: "/needs", headers: { authorization: `Bearer ${token("helper-1")}` }, body: {
        onBehalf: true, consent: true,
        registrant: { name: "Helper One", phone: "+9779800000001" },
        beneficiary: { name: "Rita Gurung", district: "Gorkha", municipalityId: gorkhaMunicipalityId, ward: 5 },
        category: "goods", description: "Need food and water for this helper test", language: "en", incidentId: TEST_INCIDENT_ID,
      },
    }));
    assert.equal(res.statusCode, 201);
    const month = new Date().toISOString().slice(0, 7);
    const work = ddb.store.get(`USER#helper-1|WORK#${month}`);
    assert.equal(work.c_need_register, 1);
    assert.equal(work.total, 1);
  });

  it("returns newest months first and sums lifetime counts", async () => {
    const { handler, ddb, token } = setup();
    seedProfile(ddb, "helper-1", "helper");
    ddb.store.set("USER#helper-1|WORK#2026-09", {
      PK: "USER#helper-1", SK: "WORK#2026-09", type: "WORK", sub: "helper-1", month: "2026-09",
      c_publish: 2, c_need_register: 1, total: 3, updatedAt: "2026-09-07T00:00:00.000Z",
    });
    ddb.store.set("USER#helper-1|WORK#2026-08", {
      PK: "USER#helper-1", SK: "WORK#2026-08", type: "WORK", sub: "helper-1", month: "2026-08",
      c_publish: 1, c_reject: 2, total: 3, updatedAt: "2026-08-31T00:00:00.000Z",
    });
    const res = await handler(makeEvent({ method: "GET", path: "/me/work", headers: { authorization: `Bearer ${token("helper-1")}` } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      months: [
        { month: "2026-09", counts: { publish: 2, need_register: 1 }, total: 3 },
        { month: "2026-08", counts: { publish: 1, reject: 2 }, total: 3 },
      ],
      lifetime: { counts: { publish: 3, need_register: 1, reject: 2 }, total: 6 },
    });
  });

  it("allows admins to read another user's work but rejects non-admins", async () => {
    const { handler, ddb, token } = setup();
    seedProfile(ddb, "helper-1", "helper");
    seedProfile(ddb, "admin-1", "admin");
    ddb.store.set("USER#helper-1|WORK#2026-09", {
      PK: "USER#helper-1", SK: "WORK#2026-09", type: "WORK", sub: "helper-1", month: "2026-09", c_publish: 1, total: 1,
    });
    let res = await handler(makeEvent({ method: "GET", path: "/admin/work/helper-1", headers: { authorization: `Bearer ${token("helper-1")}` } }));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({ method: "GET", path: "/admin/work/helper-1", headers: { authorization: `Bearer ${token("admin-1")}` } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).lifetime, { counts: { publish: 1 }, total: 1 });
  });
});
