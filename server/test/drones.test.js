import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { basePayload, createToken, FakeDdb, makeEvent, makeKeyPair, seedActiveIncident } from "./helpers.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const municipality = listMunicipalities("Gorkha")[0];

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
  profile("other", "helper");
  ddb.store.set("ORG#org-1|META", { PK: "ORG#org-1", SK: "META", type: "ORG", id: "org-1", name: "Relief Org", tier: "known", status: "verified", districts: ["Gorkha"] });
  ddb.store.set("ORG#org-2|META", { PK: "ORG#org-2", SK: "META", type: "ORG", id: "org-2", name: "Other Org", tier: "known", status: "verified", districts: ["Gorkha"] });
  ddb.store.set("USER#member|ORG#org-1", { PK: "USER#member", SK: "ORG#org-1", type: "ORGMEMBER", orgId: "org-1", role: "staff" });
  ddb.store.set("USER#other|ORG#org-2", { PK: "USER#other", SK: "ORG#org-2", type: "ORGMEMBER", orgId: "org-2", role: "staff" });
  return { handler, ddb, kp };
}

function authEvent(method, path, kp, sub, body, queryStringParameters) {
  const token = createToken(basePayload({ sub }), kp.privateKey);
  return makeEvent({ method, path, body, queryStringParameters, headers: { authorization: `Bearer ${token}` } });
}

function publicEvent(path, queryStringParameters) { return makeEvent({ method: "GET", path, queryStringParameters }); }
function jsonBody(response) { return JSON.parse(response.body); }

function requestBody(overrides = {}) {
  const start = new Date(Date.now() + 3600000).toISOString();
  const end = new Date(Date.now() + 7200000).toISOString();
  return {
    incidentId: "test-incident", district: "Gorkha", municipalityId: municipality.id, ward: 1,
    items: [{ kitId: "family-kit", households: 2 }], coldChain: false, priority: "urgent",
    windowStart: start, windowEnd: end, contactPhone: "9801234567", ...overrides,
  };
}

async function addOperator(handler, kp) {
  return jsonBody(await handler(authEvent("POST", "/orgs/org-1/drones/operators", kp, "member", {
    aircraft: "Sky Scout", payloadKg: 50, rangeKm: 100, permitStatus: "granted", baseDistrict: "Gorkha", contactPhone: "9801234567",
  })));
}

describe("drone tasking board", () => {
  beforeEach(() => clearJwksCache());

  it("computes payload weight from a kit line", async () => {
    const { handler, kp } = setup();
    const response = await handler(authEvent("POST", "/orgs/org-1/drones/requests", kp, "member", requestBody()));
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(jsonBody(response).weightKg, 90);
    assert.equal(jsonBody(response).items.find((item) => item.category === "rice").qty, 60);
  });

  it("assign requires an own active operator", async () => {
    const { handler, kp } = setup();
    const request = jsonBody(await handler(authEvent("POST", "/orgs/org-1/drones/requests", kp, "member", requestBody())));
    const other = jsonBody(await handler(authEvent("POST", "/orgs/org-2/drones/operators", kp, "other", {
      aircraft: "Other", payloadKg: 20, rangeKm: 20, baseDistrict: "Gorkha", contactPhone: "9801234567",
    })));
    let response = await handler(authEvent("POST", `/orgs/org-1/drones/requests/${request.id}/assign`, kp, "member", { operatorId: other.id }));
    assert.equal(response.statusCode, 400);
    const own = await addOperator(handler, kp);
    response = await handler(authEvent("POST", `/orgs/org-1/drones/requests/${request.id}/assign`, kp, "member", { operatorId: own.id }));
    assert.equal(response.statusCode, 200, response.body);
  });

  it("moves a mission from planned to flown and moderator confirmation delivers it", async () => {
    const { handler, kp, ddb } = setup();
    const request = jsonBody(await handler(authEvent("POST", "/orgs/org-1/drones/requests", kp, "member", requestBody({ items: [{ category: "rice", qty: 5, unit: "kg" }], weightKg: 5 }))));
    const operator = await addOperator(handler, kp);
    await handler(authEvent("POST", `/orgs/org-1/drones/requests/${request.id}/assign`, kp, "member", { operatorId: operator.id }));
    const etd = new Date(Date.now() + 3600000).toISOString();
    const eta = new Date(Date.now() + 5400000).toISOString();
    const mission = jsonBody(await handler(authEvent("POST", `/orgs/org-1/drones/requests/${request.id}/missions`, kp, "member", { etd, eta })));
    let response = await handler(authEvent("POST", `/orgs/org-1/drones/missions/${mission.id}/flown`, kp, "member", {}));
    assert.equal(response.statusCode, 200, response.body);
    response = await handler(authEvent("POST", `/moderation/drones/requests/${request.id}/confirm`, kp, "moderator", {}));
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(ddb.store.get(`DRONEREQ#${request.id}|META`).status, "delivered");
    assert.equal(ddb.store.get(`MISSION#${mission.id}|META`).status, "confirmed");
  });

  it("public board omits private names and phones and filters flights to today plus or minus one day", async () => {
    const { handler, kp } = setup();
    const request = jsonBody(await handler(authEvent("POST", "/moderation/drones/requests", kp, "moderator", requestBody())));
    await handler(authEvent("POST", "/moderation/drones/sites", kp, "moderator", {
      name: "Gorkha Field", district: "Gorkha", municipalityId: municipality.id, ward: 1, lat: 28, lng: 84,
      clearanceM: 20, surface: "field", groundContactName: "Ground Person", groundContactPhone: "9801234567",
    }));
    await addOperator(handler, kp);
    const board = jsonBody(await handler(publicEvent("/drones/board", { incidentId: "test-incident" })));
    assert.equal(board.requests[0].contactPhone, undefined);
    assert.equal(board.requests[0].requestedBy, undefined);
    assert.equal(board.sites[0].groundContactName, undefined);
    assert.equal(board.sites[0].groundContactPhone, undefined);
    assert.equal(board.sites[0].lat, 28);
    assert.equal(board.sites[0].lng, 84);
    assert.equal(board.operators[0].contactPhone, undefined);
    assert.equal(board.operators[0].name, undefined);
    assert.equal(board.requests[0].id, request.id);
    assert.equal(board.flights.length, 0);
  });
});
