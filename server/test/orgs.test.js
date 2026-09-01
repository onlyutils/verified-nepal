import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";
import { routeOrgs } from "../src/routes/orgRoutes.js";

function seedUser(fake, sub, role, email) {
  const item = {
    PK: `USER#${sub}`,
    SK: "PROFILE",
    type: "USER",
    sub,
    role,
    email,
    name: "Test User",
    guidelinesAckAt: "2026-01-01T00:00:00.000Z",
    districts: [],
    createdAt: new Date().toISOString(),
    gsi2pk: `USER#${role}`,
    gsi2sk: new Date().toISOString(),
  };
  fake.store.set(fake.key(item.PK, item.SK), JSON.parse(JSON.stringify(item)));
}

function validOrgBody(overrides = {}) {
  const base = {
    name: "Helping Hands",
    orgType: "ngo",
    contactName: "Ram Sharma",
    contactPhone: "+977-9801234567",
    districts: ["Rasuwa"],
    description: "We help people in Rasuwa district with relief goods distribution and support for communities.",
  };
  return { ...base, ...overrides };
}

function validCenterBody(overrides = {}) {
  const base = {
    name: "Rasuwa Drop Center",
    district: "Rasuwa",
    address: "Ward 5, Rasuwa Bazar",
    contactPhone: "+977-9801234567",
    accepts: ["rice", "blanket"],
  };
  return { ...base, ...overrides };
}

describe("orgs Phase1", () => {
  beforeEach(() => clearJwksCache());

  function buildOpts(fake, kp) {
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const getDdb = () => fake;
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    return { fetchJwks, getDdb, env };
  }

  async function call(routeFn, method, path, { body, token, query } = {}, opts) {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    // also support lowercase? getAuthToken checks case-insensitive
    const queryStringParameters = query || undefined;
    let rawPath = path;
    if (query && Object.keys(query).length) {
      const qs = new URLSearchParams(query).toString();
      rawPath = `${path}?${qs}`;
    }
    const event = makeEvent({ method, path: rawPath, headers, body, queryStringParameters });
    // routeOrgs takes method, path, event, opts
    const res = await routeFn(method, path, event, opts);
    if (!res) return { status: 404, body: { error: "Not Found" }, raw: res };
    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch (_) { parsed = res.body; }
    return { status: res.statusCode, body: parsed, raw: res };
  }

  it("1. POST /orgs without token → 401", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const opts = buildOpts(fake, kp);
    const res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody() }, opts);
    assert.equal(res.status, 401);
  });

  it("2. POST /orgs valid → 201 and stores org + membership + audit", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com", name: "Test User" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.status, "pending");
    const id = res.body.id;
    const orgItem = fake.store.get(`ORG#${id}|META`);
    assert.ok(orgItem);
    assert.equal(orgItem.gsi2pk, "ORG#pending");
    assert.equal(orgItem.ownerSub, sub);
    const memUser = fake.store.get(`USER#${sub}|ORG#${id}`);
    assert.ok(memUser);
    assert.equal(memUser.role, "owner");
    const memOrg = fake.store.get(`ORG#${id}|MEMBER#${sub}`);
    assert.ok(memOrg);
    assert.equal(memOrg.role, "owner");
    const audits = Array.from(fake.store.values()).filter((v) => v.type === "AUDIT" && v.action === "org.create");
    assert.ok(audits.length >= 1);
  });

  it("3. Validation: missing name, bad orgType, districts [], 4th org → 400", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    let res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "" }), token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /name must be at least 2 characters/);
    res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ orgType: "invalid" }), token }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ districts: [] }), token }, opts);
    assert.equal(res.status, 400);
    // create 3 orgs
    for (let i = 0; i < 3; i++) {
      const r = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: `Org ${i}` }), token }, opts);
      assert.equal(r.status, 201);
    }
    res = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Org 4th" }), token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /too many organizations/);
  });

  it("4. GET /orgs/mine lists the org with role owner; another user gets []", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    const otherSub = "user-2";
    seedUser(fake, sub, "helper", "user@example.com");
    seedUser(fake, otherSub, "helper", "other@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const otherToken = createToken(basePayload({ sub: otherSub, email: "other@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const create = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    assert.equal(create.status, 201);
    let res = await call(routeOrgs, "GET", "/orgs/mine", { token }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].role, "owner");
    res = await call(routeOrgs, "GET", "/orgs/mine", { token: otherToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 0);
  });

  it("5. POST /orgs/{id} by owner updates name; non-member → 403; moderator → 403", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    const otherSub = "user-2";
    const modSub = "mod-1";
    seedUser(fake, sub, "helper", "user@example.com");
    seedUser(fake, otherSub, "helper", "other@example.com");
    seedUser(fake, modSub, "moderator", "mod@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const otherToken = createToken(basePayload({ sub: otherSub, email: "other@example.com" }), kp.privateKey);
    const modToken = createToken(basePayload({ sub: modSub, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const created = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = created.body.id;
    let res = await call(routeOrgs, "POST", `/orgs/${orgId}`, { body: { name: "New Name" }, token }, opts);
    assert.equal(res.status, 200);
    const orgItem = fake.store.get(`ORG#${orgId}|META`);
    assert.equal(orgItem.name, "New Name");
    res = await call(routeOrgs, "POST", `/orgs/${orgId}`, { body: { name: "Hacked" }, token: otherToken }, opts);
    assert.equal(res.status, 403);
    res = await call(routeOrgs, "POST", `/orgs/${orgId}`, { body: { name: "Mod Hack" }, token: modToken }, opts);
    assert.equal(res.status, 403);
  });

  it("6. POST /orgs/{id}/centers by owner → 201; validation", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    let res = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    assert.equal(res.status, 201);
    const cid = res.body.id;
    const centerItem = fake.store.get(`CENTER#${cid}|META`);
    assert.equal(centerItem.gsi1pk, "CENTER#Rasuwa");
    assert.equal(centerItem.gsi2pk, "CENTER#public");
    assert.equal(centerItem.orgStatus, "pending");
    const pointer = fake.store.get(`ORG#${orgId}|CENTER#${cid}`);
    assert.ok(pointer);
    res = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody({ lat: 27.5 }), token }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody({ accepts: ["gold"] }), token }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody({ ward: 40 }), token }, opts);
    assert.equal(res.status, 400);
  });

  it("7. GET /centers?district=Rasuwa public shape; GET /centers lists it; GET /centers/{id} stock [] recent []", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    const centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    let res = await call(routeOrgs, "GET", "/centers", {}, opts);
    // without query, but route is GET /centers with optional query district via event.queryStringParameters
    // Our helper passes path without query, so we test with query param object
    res = await call(routeOrgs, "GET", "/centers", { query: { district: "Rasuwa" } }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    const pub = res.body.items[0];
    assert.ok(!("createdBy" in pub));
    assert.ok(pub.org);
    assert.equal(pub.org.id, orgId);
    assert.equal(pub.org.status, "pending");
    res = await call(routeOrgs, "GET", "/centers", {}, opts);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length >= 1);
    res = await call(routeOrgs, "GET", `/centers/${cid}`, {}, opts);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.stock, []);
    assert.deepEqual(res.body.recent, []);
  });

  it("8. POST /centers/{id} by owner {status:closed} → hidden; GET filtered", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    const centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    let res = await call(routeOrgs, "POST", `/centers/${cid}`, { body: { status: "closed" }, token }, opts);
    assert.equal(res.status, 200);
    const item = fake.store.get(`CENTER#${cid}|META`);
    assert.equal(item.gsi2pk, "CENTER#hidden");
    res = await call(routeOrgs, "GET", "/centers", { query: { district: "Rasuwa" } }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 0);
    res = await call(routeOrgs, "GET", `/centers/${cid}`, {}, opts);
    assert.equal(res.status, 404);
    res = await call(routeOrgs, "GET", `/centers/${cid}`, { token }, opts);
    assert.equal(res.status, 200);
  });

  it("9. Entries: intake, distribution, stock, insufficient, validation", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    const centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    let res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "intake", category: "rice", qty: 50 }, token }, opts);
    assert.equal(res.status, 201);
    assert.equal(res.body.unit, "kg");
    assert.equal(res.body.delta, 50);
    const stored = Array.from(fake.store.values()).find((v) => v.type === "GOODS" && v.category === "rice" && v.qty === 50);
    assert.ok(stored);
    assert.equal(stored.gsi1pk, "GOODS#Rasuwa");
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "distribution", category: "rice", qty: 20 }, token }, opts);
    assert.equal(res.status, 201);
    assert.equal(res.body.delta, -20);
    res = await call(routeOrgs, "GET", `/centers/${cid}/stock`, {}, opts);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, [{ category: "rice", unit: "kg", qty: 30 }]);
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "distribution", category: "rice", qty: 100 }, token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /insufficient stock/);
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "intake", category: "rice", qty: 0 }, token }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "intake", category: "gold", qty: 10 }, token }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 10 }, token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /destinationType must be center\|external/);
    res = await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "bogus", category: "rice", qty: 10 }, token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /unsupported entryType/);
  });

  it("10. GET /centers/{id}/entries anonymous omits createdBy; with token includes; goods-ledger", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    seedUser(fake, sub, "helper", "user@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com", name: "Test User" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    const centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "intake", category: "rice", qty: 50 }, token }, opts);
    await call(routeOrgs, "POST", `/centers/${cid}/entries`, { body: { entryType: "distribution", category: "rice", qty: 20 }, token }, opts);
    let res = await call(routeOrgs, "GET", `/centers/${cid}/entries`, {}, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    for (const it of res.body.items) {
      assert.ok(!("createdBy" in it));
      assert.ok(!("createdByName" in it));
    }
    res = await call(routeOrgs, "GET", `/centers/${cid}/entries`, { token }, opts);
    assert.equal(res.status, 200);
    assert.ok(res.body.items[0].createdByName);
    res = await call(routeOrgs, "GET", "/goods-ledger", { query: { district: "Rasuwa" } }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    // newest first: distribution should be first (created later)
    assert.equal(res.body.items[0].entryType, "distribution");
    assert.ok(!("createdBy" in res.body.items[0]));
  });

  it("11. GET /moderation/orgs as helper → 403; as moderator lists pending with centersCount and ownerEmail", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    const modSub = "mod-1";
    seedUser(fake, sub, "helper", "user@example.com");
    seedUser(fake, modSub, "moderator", "mod@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const modToken = createToken(basePayload({ sub: modSub, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    let res = await call(routeOrgs, "GET", "/moderation/orgs", { token }, opts);
    assert.equal(res.status, 403);
    res = await call(routeOrgs, "GET", "/moderation/orgs", { token: modToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].centersCount, 1);
    assert.ok(res.body.items[0].ownerEmail);
  });

  it("12. POST /moderation/orgs/{id} verify and audit", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    const modSub = "mod-1";
    seedUser(fake, sub, "helper", "user@example.com");
    seedUser(fake, modSub, "moderator", "mod@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const modToken = createToken(basePayload({ sub: modSub, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    const centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    let res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId}`, { body: { action: "verify" }, token: modToken }, opts);
    assert.equal(res.status, 400);
    res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId}`, { body: { action: "verify", tier: "self_declared", note: "Called the contact number, spoke to the chair" }, token: modToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "verified");
    const orgItem = fake.store.get(`ORG#${orgId}|META`);
    assert.equal(orgItem.tier, "self_declared");
    assert.equal(orgItem.verifiedBy, modSub);
    assert.equal(orgItem.verificationNote, "Called the contact number, spoke to the chair");
    assert.equal(orgItem.gsi2pk, "ORG#verified");
    const centerItem = fake.store.get(`CENTER#${cid}|META`);
    assert.equal(centerItem.orgStatus, "verified");
    assert.equal(centerItem.orgTier, "self_declared");
    const audits = Array.from(fake.store.values()).filter((v) => v.type === "AUDIT" && v.action === "verify" && v.targetType === "ORG");
    assert.ok(audits.length >= 1);
  });

  it("13. suspend, reinstate, reject, verify on rejected → 400", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "user-1";
    const modSub = "mod-1";
    seedUser(fake, sub, "helper", "user@example.com");
    seedUser(fake, modSub, "moderator", "mod@example.com");
    const token = createToken(basePayload({ sub, email: "user@example.com" }), kp.privateKey);
    const modToken = createToken(basePayload({ sub: modSub, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    // create org and center, verify
    let orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token }, opts);
    const orgId = orgRes.body.id;
    let centerRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token }, opts);
    const cid = centerRes.body.id;
    await call(routeOrgs, "POST", `/moderation/orgs/${orgId}`, { body: { action: "verify", tier: "self_declared", note: "Called the contact number, spoke to the chair" }, token: modToken }, opts);
    let res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId}`, { body: { action: "suspend", reason: "Duplicate of another org" }, token: modToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(fake.store.get(`CENTER#${cid}|META`).gsi2pk, "CENTER#hidden");
    res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId}`, { body: { action: "reinstate" }, token: modToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(fake.store.get(`CENTER#${cid}|META`).gsi2pk, "CENTER#public");
    // create second org for reject test
    orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Second Org" }), token }, opts);
    const orgId2 = orgRes.body.id;
    const c2 = await call(routeOrgs, "POST", `/orgs/${orgId2}/centers`, { body: validCenterBody({ name: "Second Center" }), token }, opts);
    const cid2 = c2.body.id;
    res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId2}`, { body: { action: "reject", reason: "Not a real org" }, token: modToken }, opts);
    assert.equal(res.status, 200);
    assert.equal(fake.store.get(`ORG#${orgId2}|META`).status, "rejected");
    assert.equal(fake.store.get(`CENTER#${cid2}|META`).gsi2pk, "CENTER#hidden");
    res = await call(routeOrgs, "POST", `/moderation/orgs/${orgId2}`, { body: { action: "verify", tier: "self_declared", note: "try verify rejected" }, token: modToken }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /only pending organizations can be verified/);
  });

  it("14. index.js router delegates /orgs and /centers to routeOrgs", async () => {
    const { createHandler } = await import("../src/index.js");
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const handler = createHandler({ ...buildOpts(fake, kp), ddbClient: fake });
    const anon = await handler(makeEvent({ method: "GET", path: "/centers" }));
    assert.equal(anon.statusCode, 200);
    assert.deepEqual(JSON.parse(anon.body), { items: [] });
    const noToken = await handler(makeEvent({ method: "POST", path: "/orgs", body: validOrgBody() }));
    assert.equal(noToken.statusCode, 401);
  });
});
