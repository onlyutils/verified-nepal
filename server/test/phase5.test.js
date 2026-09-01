import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler, __clearMediaTokenCache } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function makeHandler(opts = {}) {
  const kp = opts.kp ?? makeKeyPair();
  const ddb = opts.ddb ?? new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ...opts.envOverrides };
  const fetchJwks = opts.fetchJwks ?? (async () => ({ keys: [kp.jwk] }));
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: opts.fetch });
  return { handler, ddb, kp, env };
}

async function createNeed(handler, overrides = {}) {
  const body = {
    onBehalf: false,
    beneficiary: { name: overrides.name || "Rita Gurung", district: overrides.district || "Gorkha", ward: overrides.ward ?? 5, phone: "+9779800000001" },
    category: overrides.category || "goods",
    description: overrides.description || "Need description long enough for testing phase five governance",
    language: "en",
  };
  const res = await handler(makeEvent({ method: "POST", path: "/needs", body }));
  assert.equal(res.statusCode, 201);
  return JSON.parse(res.body);
}

describe("Phase5 USER gsi2/EMAIL backfill on /me", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });
  it("writes gsi2 and EMAIL pointer on first login and backfills on next /me", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, kp, fetchJwks });
    // new user first login via /me with userinfo
    const token = createToken(basePayload({ sub: "newuser-1", email: "newuser@example.com", name: "New User" }), kp.privateKey);
    const fetchImpl = async (url) => {
      return { ok: true, status: 200, json: async () => ({ email: "newuser@example.com", name: "New User" }) };
    };
    const handler2 = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, kp, fetchJwks, fetch: fetchImpl });
    let res = await handler2(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    let body = JSON.parse(res.body);
    assert.equal(body.email, "newuser@example.com");
    assert.deepEqual(body.districts, []);
    const stored = ddb.store.get("USER#newuser-1|PROFILE");
    assert.ok(stored.gsi2pk === "USER#helper");
    assert.ok(stored.gsi2sk === stored.createdAt);
    const ptr = ddb.store.get("EMAIL#newuser@example.com|META");
    assert.ok(ptr);
    assert.equal(ptr.sub, "newuser-1");
    // lowercased pointer
    const token2 = createToken(basePayload({ sub: "caseuser", email: "CASE@Example.COM" }), kp.privateKey);
    const fetchImpl2 = async () => ({ ok: true, json: async () => ({ email: "CASE@Example.COM", name: "Case" }) });
    const handler3 = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, kp, fetchJwks, fetch: fetchImpl2 });
    res = await handler3(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token2}` } }));
    assert.equal(res.statusCode, 200);
    const ptrLow = ddb.store.get("EMAIL#case@example.com|META");
    assert.ok(ptrLow);
    // existing user backfill: create user without gsi2/pointer
    ddb.store.set("USER#legacy-1|PROFILE", { PK: "USER#legacy-1", SK: "PROFILE", sub: "legacy-1", role: "helper", email: "legacy@example.com", name: "Legacy", createdAt: "2026-01-01T00:00:00.000Z" });
    const legacyTok = createToken(basePayload({ sub: "legacy-1" }), kp.privateKey);
    res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${legacyTok}` } }));
    assert.equal(res.statusCode, 200);
    body = JSON.parse(res.body);
    assert.deepEqual(body.districts, []);
    const backfilled = ddb.store.get("USER#legacy-1|PROFILE");
    assert.equal(backfilled.gsi2pk, "USER#helper");
    assert.equal(backfilled.gsi2sk, "2026-01-01T00:00:00.000Z");
    assert.ok(backfilled.districts);
    const ptr2 = ddb.store.get("EMAIL#legacy@example.com|META");
    assert.ok(ptr2);
  });
  it("GET /me returns districts and guidelinesAckAt", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#u1|PROFILE", { PK: "USER#u1", SK: "PROFILE", sub: "u1", role: "moderator", email: "m@x.com", name: "Mod", districts: ["Gorkha"], guidelinesAckAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const tok = createToken(basePayload({ sub: "u1" }), kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${tok}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(body.districts, ["Gorkha"]);
    assert.equal(body.guidelinesAckAt, "2026-02-01T00:00:00.000Z");
  });
});

describe("Phase5 guidelines acknowledgment gate", () => {
  beforeEach(() => { clearJwksCache(); });
  it("moderator without ack gets 403, admin exempt, ack then succeeds", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    // moderator without ack
    ddb.store.set("USER#mod-noack|PROFILE", { PK: "USER#mod-noack", SK: "PROFILE", sub: "mod-noack", role: "moderator", email: "mod@x.com", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin", email: "admin@x.com", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#admin", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-noack" }), kp.privateKey);
    const adminTok = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    // moderation queue should 403 for mod without ack
    let res = await handler(makeEvent({ method: "GET", path: "/moderation/queue", headers: { authorization: `Bearer ${modTok}` } }));
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "guidelines_not_acknowledged");
    // admin exempt
    res = await handler(makeEvent({ method: "GET", path: "/moderation/queue", headers: { authorization: `Bearer ${adminTok}` } }));
    assert.equal(res.statusCode, 200);
    // ack
    res = await handler(makeEvent({ method: "POST", path: "/me/ack-guidelines", headers: { authorization: `Bearer ${modTok}` } }));
    assert.equal(res.statusCode, 200);
    assert.ok(JSON.parse(res.body).guidelinesAckAt);
    // now succeeds
    res = await handler(makeEvent({ method: "GET", path: "/moderation/queue", headers: { authorization: `Bearer ${modTok}` } }));
    assert.equal(res.statusCode, 200);
  });
  it("ack gate applies to all moderation/claims paths", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod2|PROFILE", { PK: "USER#mod2|PROFILE".replace("|PROFILE","|PROFILE"), SK: "PROFILE", sub: "mod2", role: "moderator", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    // correct key
    ddb.store.delete("USER#mod2|PROFILE");
    ddb.store.set("USER#mod2|PROFILE", { PK: "USER#mod2", SK: "PROFILE", sub: "mod2", role: "moderator", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const tok = createToken(basePayload({ sub: "mod2" }), kp.privateKey);
    const paths = [
      { method: "GET", path: "/moderation/flags" },
      { method: "GET", path: "/moderation/projects" },
      { method: "GET", path: "/moderation/dispatches" },
    ];
    for (const p of paths) {
      const r = await handler(makeEvent({ method: p.method, path: p.path, headers: { authorization: `Bearer ${tok}` } }));
      assert.equal(r.statusCode, 403, `should 403 for ${p.path}`);
      assert.equal(JSON.parse(r.body).error, "guidelines_not_acknowledged");
    }
  });
});

describe("Phase5 district scoping", () => {
  beforeEach(() => clearJwksCache());
  it("queue filtering + 403 out_of_scope for needs/offers/projects/claims", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    // moderator scoped to Gorkha
    ddb.store.set("USER#mod-g|PROFILE", { PK: "USER#mod-g", SK: "PROFILE", sub: "mod-g", role: "moderator", email: "g@x.com", name: "GM", districts: ["Gorkha"], guidelinesAckAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    ddb.store.set("USER#mod-all|PROFILE", { PK: "USER#mod-all", SK: "PROFILE", sub: "mod-all", role: "moderator", email: "all@x.com", name: "All", districts: [], guidelinesAckAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const modGTok = createToken(basePayload({ sub: "mod-g" }), kp.privateKey);
    const modAllTok = createToken(basePayload({ sub: "mod-all" }), kp.privateKey);
    // create needs in two districts
    const { id: idGorkha } = await createNeed(handler, { district: "Gorkha", ward: 1, name: "Gorkha Person" });
    const { id: idKaski } = await createNeed(handler, { district: "Kaski", ward: 2, name: "Kaski Person" });
    // queue for scoped mod should only see Gorkha
    let res = await handler(makeEvent({ method: "GET", path: "/moderation/queue", headers: { authorization: `Bearer ${modGTok}` } }));
    assert.equal(res.statusCode, 200);
    const items = JSON.parse(res.body).items;
    assert.ok(items.some(i => i.id === idGorkha));
    assert.equal(items.some(i => i.id === idKaski), false);
    // out_of_scope on action for other district
    res = await handler(makeEvent({ method: "POST", path: `/moderation/${idKaski}`, headers: { authorization: `Bearer ${modGTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "out_of_scope");
    // scoped mod can publish Gorkha
    res = await handler(makeEvent({ method: "POST", path: `/moderation/${idGorkha}`, headers: { authorization: `Bearer ${modGTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    const claimCode = JSON.parse(res.body).claimCode;
    // claim redeem on Kaski should be out_of_scope even if published by all-mod
    res = await handler(makeEvent({ method: "POST", path: `/moderation/${idKaski}`, headers: { authorization: `Bearer ${modAllTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    const claimKaski = JSON.parse(res.body).claimCode;
    // scoped mod redeem Kaski should fail
    res = await handler(makeEvent({ method: "POST", path: `/claims/${claimKaski}/redeem`, headers: { authorization: `Bearer ${modGTok}` }, body: {} }));
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "out_of_scope");
    // redeem Gorkha should succeed
    res = await handler(makeEvent({ method: "POST", path: `/claims/${claimCode}/redeem`, headers: { authorization: `Bearer ${modGTok}` }, body: {} }));
    assert.equal(res.statusCode, 200);
    // status change out_of_scope
    const { id: idG2 } = await createNeed(handler, { district: "Gorkha", ward: 3, name: "G2" });
    await handler(makeEvent({ method: "POST", path: `/moderation/${idG2}`, headers: { authorization: `Bearer ${modAllTok}` }, body: { action: "publish" } }));
    const { id: idK2 } = await createNeed(handler, { district: "Kaski", ward: 2, name: "K2" });
    await handler(makeEvent({ method: "POST", path: `/moderation/${idK2}`, headers: { authorization: `Bearer ${modAllTok}` }, body: { action: "publish" } }));
    res = await handler(makeEvent({ method: "POST", path: `/needs/${idK2}/status`, headers: { authorization: `Bearer ${modGTok}` }, body: { status: "matched" } }));
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "out_of_scope");
    res = await handler(makeEvent({ method: "POST", path: `/needs/${idG2}/status`, headers: { authorization: `Bearer ${modGTok}` }, body: { status: "matched" } }));
    assert.equal(res.statusCode, 200);
    // projects scoping
    // create projects via handler (anonymous)
    async function createProject(district) {
      const body = {
        title: { en: `Proj ${district}` },
        description: { en: "Description long enough for project governance test case here" },
        type: "tuin",
        district,
        ward: 1,
        locationText: "loc",
        costEstimateNpr: 100000,
        committee: { name: "Com", contactName: "C", phone: "+9779800000001", bank: { bankName: "B", accountName: "A", accountNumber: "1" } }
      };
      const r = await handler(makeEvent({ method: "POST", path: "/projects", body }));
      assert.equal(r.statusCode, 201);
      return JSON.parse(r.body).id;
    }
    const projG = await createProject("Gorkha");
    const projK = await createProject("Kaski");
    res = await handler(makeEvent({ method: "GET", path: "/moderation/projects", headers: { authorization: `Bearer ${modGTok}` } }));
    assert.equal(res.statusCode, 200);
    const projs = JSON.parse(res.body).items;
    assert.ok(projs.some(p => p.id === projG));
    assert.equal(projs.some(p => p.id === projK), false);
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${projK}`, headers: { authorization: `Bearer ${modGTok}` }, body: { action: "verify-committee" } }));
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "out_of_scope");
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${projG}`, headers: { authorization: `Bearer ${modGTok}` }, body: { action: "verify-committee" } }));
    assert.equal(res.statusCode, 200);
    // dispatches are not district-scoped: scoped mod can moderate any dispatch
    const dispRes = await handler(makeEvent({ method: "POST", path: "/dispatches", body: { title: "Hello", body: "This is a dispatch body long enough for testing dispatches indeed", author: { displayName: "A", email: "a@b.com" }, tags: ["story"], language: "en" } }));
    assert.equal(dispRes.statusCode, 201);
    const dispId = JSON.parse(dispRes.body).id;
    res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${dispId}`, headers: { authorization: `Bearer ${modGTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
  });
});

describe("Phase5 admin user endpoints", () => {
  beforeEach(() => clearJwksCache());
  it("lookup, list per role, set role with self-demotion guard, audit", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin", email: "admin@example.com", name: "Admin", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#admin", gsi2sk: "2026-01-01T00:00:00.000Z" });
    ddb.store.set("USER#user-1|PROFILE", { PK: "USER#user-1", SK: "PROFILE", sub: "user-1", role: "helper", email: "user1@example.com", name: "User One", districts: [], createdAt: "2026-01-02T00:00:00.000Z", gsi2pk: "USER#helper", gsi2sk: "2026-01-02T00:00:00.000Z" });
    ddb.store.set("EMAIL#user1@example.com|META", { PK: "EMAIL#user1@example.com", SK: "META", sub: "user-1" });
    const adminTok = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    // lookup
    let res = await handler(makeEvent({ method: "GET", path: "/admin/users/lookup", queryStringParameters: { email: "user1@example.com" }, headers: { authorization: `Bearer ${adminTok}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).sub, "user-1");
    res = await handler(makeEvent({ method: "GET", path: "/admin/users/lookup", queryStringParameters: { email: "nope@x.com" }, headers: { authorization: `Bearer ${adminTok}` } }));
    assert.equal(res.statusCode, 404);
    // list per role
    res = await handler(makeEvent({ method: "GET", path: "/admin/users", queryStringParameters: { role: "helper" }, headers: { authorization: `Bearer ${adminTok}` } }));
    assert.equal(res.statusCode, 200);
    assert.ok(JSON.parse(res.body).items.some(i => i.sub === "user-1"));
    // set role
    res = await handler(makeEvent({ method: "POST", path: "/admin/users/user-1/role", headers: { authorization: `Bearer ${adminTok}` }, body: { role: "moderator", districts: ["Gorkha"] } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "moderator");
    assert.deepEqual(JSON.parse(res.body).districts, ["Gorkha"]);
    const updated = ddb.store.get("USER#user-1|PROFILE");
    assert.equal(updated.role, "moderator");
    assert.equal(updated.gsi2pk, "USER#moderator");
    // audit created
    const audits = Array.from(ddb.store.values()).filter(v => v.action === "role.set" && v.targetId === "user-1");
    assert.ok(audits.length >=1);
    assert.equal(audits[0].targetType, "USER");
    assert.ok(audits[0].targetLabel.includes("***"));
    assert.ok(audits[0].actorSub === "admin-1");
    assert.ok(audits[0].actorName);
    assert.ok(audits[0].ts);
    // self-demotion guard
    res = await handler(makeEvent({ method: "POST", path: "/admin/users/admin-1/role", headers: { authorization: `Bearer ${adminTok}` }, body: { role: "helper" } }));
    assert.equal(res.statusCode, 403);
    // helper cannot access admin
    ddb.store.set("USER#helper-1|PROFILE", { PK: "USER#helper-1", SK: "PROFILE", sub: "helper-1", role: "helper", email: "h@x.com", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#helper", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const helperTok = createToken(basePayload({ sub: "helper-1" }), kp.privateKey);
    res = await handler(makeEvent({ method: "GET", path: "/admin/users", headers: { authorization: `Bearer ${helperTok}` } }));
    assert.equal(res.statusCode, 403);
  });
});

describe("Phase5 admin stats and audit", () => {
  beforeEach(() => clearJwksCache());
  it("/admin/stats via COUNT, public /audit masked", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin", email: "admin@x.com", name: "Admin", districts: [], guidelinesAckAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#admin", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const adminTok = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", email: "mod@x.com", districts: [], guidelinesAckAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    // create some needs/offers/projects/dispatches
    await createNeed(handler, { district: "Gorkha", ward: 1, name: "A B" });
    const { id } = await createNeed(handler, { district: "Gorkha", ward: 2, name: "C D" });
    await handler(makeEvent({ method: "POST", path: `/moderation/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    // stats
    let res = await handler(makeEvent({ method: "GET", path: "/admin/stats", headers: { authorization: `Bearer ${adminTok}` } }));
    assert.equal(res.statusCode, 200);
    const stats = JSON.parse(res.body);
    assert.ok(typeof stats.needs.pending === "number");
    assert.ok(typeof stats.needs.published === "number");
    assert.ok(typeof stats.offers === "object");
    assert.ok(typeof stats.projects === "object");
    assert.ok(typeof stats.dispatches === "object");
    assert.ok(typeof stats.oldestPendingAgeHours === "number");
    assert.ok(typeof stats.moderators === "number");
    assert.equal(stats.moderators, 1);
    // audit: after publish, check stored audit has full shape
    const auditsStored = Array.from(ddb.store.values()).filter(v => v.PK && v.PK.startsWith("AUDIT#"));
    assert.ok(auditsStored.length >=1);
    for (const a of auditsStored) {
      assert.ok(a.actorSub);
      assert.ok(a.actorName !== undefined);
      assert.ok(a.action);
      assert.ok(a.targetType);
      assert.ok(a.targetId);
      assert.ok(a.targetLabel !== undefined);
      assert.ok(a.ts);
    }
    // public /audit masked
    const month = new Date().toISOString().slice(0,7);
    res = await handler(makeEvent({ method: "GET", path: "/audit", queryStringParameters: { month } }));
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["cache-control"]?.includes("public"));
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.items));
    // should be newest first
    if (body.items.length >=2) assert.ok(body.items[0].ts >= body.items[1].ts);
    for (const it of body.items) {
      assert.ok(it.ts);
      assert.ok(it.actorName !== undefined);
      assert.ok(it.action);
      assert.ok(it.targetType);
      assert.ok(it.targetLabel !== undefined);
      // never private fields
      assert.equal("actorSub" in it, false);
      assert.equal("targetId" in it, false); // targetId not exposed publicly
      // targetLabel masked checks
      if (it.targetType === "NEED") assert.ok(it.targetLabel.includes("Ward"));
      if (it.targetType === "USER") assert.ok(it.targetLabel.includes("***"));
    }
    // project audit masking
    const projBody = {
      title: { en: "Great Bridge" },
      description: { en: "Description long enough for project governance test case here for audit masking" },
      type: "bridge",
      district: "Gorkha",
      ward: 1,
      locationText: "loc",
      costEstimateNpr: 100000,
      committee: { name: "Com", contactName: "C", phone: "+9779800000001", bank: { bankName: "B", accountName: "A", accountNumber: "1" } }
    };
    let r = await handler(makeEvent({ method: "POST", path: "/projects", body: projBody }));
    const projId = JSON.parse(r.body).id;
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${projId}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${projId}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    res = await handler(makeEvent({ method: "GET", path: "/audit", queryStringParameters: { month } }));
    const projAudit = JSON.parse(res.body).items.find(i => i.targetType === "PROJECT");
    assert.ok(projAudit);
    assert.equal(projAudit.targetLabel, "Great Bridge");
  });
});
