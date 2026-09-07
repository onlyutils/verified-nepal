import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { basePayload, createToken, FakeDdb, makeEvent, makeKeyPair, seedActiveIncident } from "./helpers.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const municipality = listMunicipalities("Gorkha")[0];
const plannedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  seedActiveIncident(ddb, { affectedDistricts: ["Gorkha"] });
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  const profile = (sub, role, districts = []) => ddb.store.set(`USER#${sub}|PROFILE`, {
    PK: `USER#${sub}`, SK: "PROFILE", type: "USER", sub, role, name: role === "moderator" ? "District Moderator" : "Org Member",
    districts, guidelinesAckAt: "2026-01-01T00:00:00.000Z",
  });
  profile("member", "helper");
  profile("moderator", "moderator", ["Gorkha"]);
  ddb.store.set("ORG#org-1|META", { PK: "ORG#org-1", SK: "META", type: "ORG", id: "org-1", name: "Relief Org", tier: "known", status: "verified", districts: ["Gorkha"] });
  ddb.store.set("USER#member|ORG#org-1", { PK: "USER#member", SK: "ORG#org-1", type: "ORGMEMBER", orgId: "org-1", role: "staff" });
  return { handler, ddb, kp };
}

function token(kp, sub) {
  return `Bearer ${createToken(basePayload({ sub }), kp.privateKey)}`;
}

function event(method, path, kp, sub, body, queryStringParameters) {
  return makeEvent({ method, path, body, queryStringParameters, headers: { authorization: token(kp, sub) } });
}

function publicEvent(path, queryStringParameters) {
  return makeEvent({ method: "GET", path, queryStringParameters });
}

function body(response) {
  return JSON.parse(response.body);
}

function validBody(overrides = {}) {
  return {
    incidentId: "test-incident",
    district: "Gorkha",
    municipalityId: municipality.id,
    wards: [1, 2],
    plannedDate,
    items: [{ kitId: "family-kit", households: 2 }],
    transport: "vehicle",
    staffCount: 4,
    contactPhone: "+977-9801234567",
    ...overrides,
  };
}

describe("distribution filing", () => {
  beforeEach(() => clearJwksCache());

  it("creates a distribution and expands kit lines", async () => {
    const { handler, kp, ddb } = setup();
    const response = await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody()));
    assert.equal(response.statusCode, 201, response.body);
    const created = body(response);
    assert.equal(created.items.find((item) => item.category === "rice").qty, 60);
    assert.equal(created.items.find((item) => item.category === "rice").kitId, "family-kit");
    assert.equal(ddb.store.get(`DIST#${created.id}|META`).status, "planned");
  });

  it("rejects a ward outside the municipality with 400", async () => {
    const { handler, kp } = setup();
    const response = await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody({ wards: [400] })));
    assert.equal(response.statusCode, 400);
  });

  it("rejects an unverified organization with 403", async () => {
    const { handler, kp, ddb } = setup();
    ddb.store.get("ORG#org-1|META").status = "pending";
    const response = await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody()));
    assert.equal(response.statusCode, 403);
  });

  it("moderator acknowledgement records ackBy and an audit row", async () => {
    const { handler, kp, ddb } = setup();
    const created = body(await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody())));
    const response = await handler(event("POST", `/moderation/distributions/${created.id}/ack`, kp, "moderator", { note: "Checked with DDMC" }));
    assert.equal(response.statusCode, 200, response.body);
    const stored = ddb.store.get(`DIST#${created.id}|META`);
    assert.equal(stored.status, "acknowledged");
    assert.equal(stored.ackBy.role, "moderator");
    assert.ok([...ddb.store.values()].some((item) => item.type === "AUDIT" && item.action === "distribution.ack" && item.reason === "on behalf of the district office"));
  });

  it("complete records households reached", async () => {
    const { handler, kp, ddb } = setup();
    const created = body(await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody())));
    const response = await handler(event("POST", `/orgs/org-1/distributions/${created.id}/complete`, kp, "member", { householdsReached: 35 }));
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(ddb.store.get(`DIST#${created.id}|META`).householdsReached, 35);
  });

  it("public view hides the contact phone", async () => {
    const { handler, kp } = setup();
    await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody()));
    const response = await handler(publicEvent("/distributions", { incidentId: "test-incident", district: "Gorkha" }));
    assert.equal(response.statusCode, 200);
    const item = body(response).items[0];
    assert.equal(item.contactPhone, undefined);
    assert.equal(item.createdBy, undefined);
  });

  it("DDMC CSV has an HXL row and one row per ward", async () => {
    const { handler, kp } = setup();
    await handler(event("POST", "/orgs/org-1/distributions", kp, "member", validBody()));
    const response = await handler(publicEvent("/export/ddmc-log", { district: "Gorkha", date: plannedDate, format: "csv" }));
    assert.equal(response.statusCode, 200);
    const lines = response.body.split("\n");
    assert.match(lines[0], /^date,district,municipality,ward,/);
    assert.match(lines[1], /#adm2\+name/);
    assert.equal(lines.length, 4);
    assert.match(response.headers["content-disposition"], /verifiednepal-ddmc-Gorkha-/);
  });
});
