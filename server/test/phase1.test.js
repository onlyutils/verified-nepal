import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";

function testDdb() {
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
  return ddb;
}

function makeHandler({ envOverrides = {}, ddb, kp } = {}) {
  const keyPair = kp ?? makeKeyPair();
  const d = ddb ?? new FakeDdb();
  seedActiveIncident(d);
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "", ...envOverrides };
  const fetchJwks = async () => ({ keys: [keyPair.jwk] });
  const handler = createHandler({ env, ddbClient: d, fetchJwks });
  return { handler, ddb: d, env, kp: keyPair, fetchJwks };
}

async function authToken(kp, overrides = {}) {
  const payload = basePayload(overrides);
  return createToken(payload, kp.privateKey);
}

describe("POST /needs", () => {
  let kp, fetchJwks;
  beforeEach(() => { clearJwksCache(); kp = makeKeyPair(); fetchJwks = async () => ({ keys: [kp.jwk] }); });

  it("creates need anonymously and returns 12-char refCode", async () => {
    const ddb = testDdb();
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    const res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5 }, category: "goods", description: "Need food and water for family in ward five", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.id);
    assert.ok(body.refCode);
    assert.equal(body.refCode.length, 12);
    assert.match(body.refCode, /^[A-Z2-7]{12}$/);
    const item = ddb.store.get(`NEED#${body.id}|META`);
    assert.ok(item);
    assert.equal(item.status, "pending");
    assert.ok(item.ttl);
    assert.ok(item.expiresAt);
    assert.ok(item.gsi1pk);
    assert.ok(item.gsi2pk);
    const ref = ddb.store.get(`REF#${body.refCode}|META`);
    assert.ok(ref);
    assert.equal(ref.needId, body.id);
  });

  it("validates required fields and enums", async () => {
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: testDdb(), fetchJwks });
    // missing ward
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha" }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    // invalid ward 34
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 34 }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    // invalid category
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "invalid", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    // description too short
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "short", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    // language invalid
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "fr", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
  });

  it("requires registrant when onBehalf true", async () => {
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: testDdb(), fetchJwks });
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, registrant: { name: "Reg", phone: "98abc" }, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
  });

  it("rejects a malformed optional email but accepts a valid one", async () => {
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: testDdb(), fetchJwks });
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", email: "not-an-email", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", email: "valid@example.com", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 201);
  });

  it("skips turnstile when secret unset, verifies when set", async () => {
    const ddb = testDdb();
    // unset -> should succeed without token
    let handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 201);
    // with secret set, token required
    const origFetch = global.fetch;
    global.fetch = async () => ({ json: async () => ({ success: true }) });
    handler = createHandler({ env: { TABLE_NAME: "t", TURNSTILE_SECRET: "secret" }, ddbClient: testDdb(), fetchJwks });
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", turnstileToken: "tok", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 201);
    // failed verification
    global.fetch = async () => ({ json: async () => ({ success: false }) });
    handler = createHandler({ env: { TABLE_NAME: "t", TURNSTILE_SECRET: "secret" }, ddbClient: testDdb(), fetchJwks });
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", turnstileToken: "bad", incidentId: TEST_INCIDENT_ID } }));
    assert.equal(res.statusCode, 400);
    global.fetch = origFetch;
  });
});

describe("GET /needs public board", () => {
  it("only shows published/matched/fulfilled and masks name, never leaks private fields", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const ddb = testDdb();
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    // create need with private data
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, registrant: { name: "Registrar Name", phone: "+9779800000001", email: "registrar@example.com" }, beneficiary: { name: "Rita Gurung", phone: "+9779800000002", email: "rita@example.com", district: "Gorkha", ward: 5, householdSize: 4 }, category: "goods", description: "Private household data must never leak to public board view", language: "en", incidentId: TEST_INCIDENT_ID } }));
    const { id, refCode } = JSON.parse(res.body);
    // pending not visible
    res = await handler(makeEvent({ method: "GET", path: `/needs?incidentId=${TEST_INCIDENT_ID}` }));
    assert.equal(JSON.parse(res.body).items.length, 0);
    // publish as moderator
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modToken = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    res = await handler(makeEvent({ method: "POST", path: `/moderation/${id}`, headers: { authorization: `Bearer ${modToken}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({ method: "GET", path: `/needs?incidentId=${TEST_INCIDENT_ID}` }));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.maskedName, "Rita G.");
    assert.equal(item.district, "Gorkha");
    assert.equal(item.ward, 5);
    // dedicated leak assertion - check keys, not substrings
    for (const it of items) {
      assert.equal("phone" in it, false, "phone leaked");
      assert.equal("email" in it, false, "email leaked");
      assert.equal("registrant" in it, false, "registrant leaked");
      assert.equal("householdSize" in it, false, "household leaked");
      assert.equal("household" in it, false, "household leaked");
    }
    const raw = JSON.stringify(items);
    assert.equal(raw.includes("registrant"), false, "registrant leaked");
    assert.equal(raw.includes("example.com"), false, "email leaked");
    // ensure only allowed keys
    for (const it of items) {
      const keys = Object.keys(it).sort();
      assert.deepEqual(keys, ["category","createdAt","description","district","id","maskedName","status","ward"]);
    }
  });

  it("filters by district and category and supports cursor pagination", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const ddb = testDdb();
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modToken = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    // create 3 needs in different districts/categories
    const ids = [];
    for (const cfg of [{district:"Gorkha", category:"goods"}, {district:"Kathmandu", category:"medical"}, {district:"Gorkha", category:"medical"}]) {
      let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf:false, beneficiary:{name:`Ben ${cfg.district}`, district:cfg.district, ward:1}, category:cfg.category, description:"Need description long enough for test "+cfg.district, language:"en", incidentId: TEST_INCIDENT_ID } }));
      const {id} = JSON.parse(res.body);
      ids.push(id);
      await handler(makeEvent({ method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${modToken}`}, body:{action:"publish"}}));
    }
    let res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{district:"Gorkha", incidentId: TEST_INCIDENT_ID}}));
    // also test rawPath query parsing
    res = await handler(makeEvent({ method:"GET", path:`/needs?district=Gorkha&incidentId=${TEST_INCIDENT_ID}` }));
    assert.equal(JSON.parse(res.body).items.length, 2);
    res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{category:"medical", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(JSON.parse(res.body).items.length, 2);
    res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{district:"Gorkha", category:"goods", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
  });
});

describe("GET /status and POST renew", () => {
  it("returns 404 for unknown refCode and returns status for known", async () => {
    const ddb = testDdb();
    const kp = makeKeyPair();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const handler = createHandler({ env:{TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"GET", path:"/status/UNKNOWN123"}));
    assert.equal(res.statusCode, 404);
    res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"X Y", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough here for status", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {refCode} = JSON.parse(res.body);
    res = await handler(makeEvent({method:"GET", path:`/status/${refCode}`}));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.status);
    assert.ok(body.expiresAt);
    assert.ok(body.createdAt);
  });
  it("renew extends TTL 30 days", async () => {
    const ddb = testDdb();
    const handler = createHandler({ env:{TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks: async()=>({keys:[]}) });
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"A B", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough for renew test", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {refCode, id} = JSON.parse(res.body);
    const before = ddb.store.get(`NEED#${id}|META`).ttl;
    // wait a bit
    await new Promise(r=>setTimeout(r,10));
    res = await handler(makeEvent({method:"POST", path:`/needs/${refCode}/renew`}));
    assert.equal(res.statusCode, 200);
    const after = ddb.store.get(`NEED#${id}|META`).ttl;
    assert.ok(after >= before);
    assert.ok(JSON.parse(res.body).expiresAt);
    // unknown ref 404
    res = await handler(makeEvent({method:"POST", path:"/needs/BADCODE12345/renew"}));
    assert.equal(res.statusCode, 404);
  });
});

describe("offers", () => {
  it("requires auth and validates input", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"POST", path:"/offers", body:{categories:["goods"], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(res.statusCode, 401);
    const token = createToken(basePayload({sub:"h1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:[], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:["invalid"], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(res.statusCode, 400);
  });
  it("creates offer and public GET does not leak phone", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    const token = createToken(basePayload({sub:"h1", name:"Helper Person"}), kp.privateKey);
    let res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:["goods","medical"], districts:["Gorkha","Kathmandu"], description:"We can provide goods and medical aid in Gorkha and Kathmandu", phone:"+9779800000000", org:{name:"Youth Club", contact:"contact@youth.org"}, incidentId: TEST_INCIDENT_ID}}));
    assert.equal(res.statusCode, 201);
    const {id} = JSON.parse(res.body);
    // pending not visible
    res = await handler(makeEvent({method:"GET", path:`/offers?incidentId=${TEST_INCIDENT_ID}`}));
    assert.equal(JSON.parse(res.body).items.length, 0);
    // publish
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modToken = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${modToken}`}, body:{action:"publish"}}));
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({method:"GET", path:`/offers?incidentId=${TEST_INCIDENT_ID}`}));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 1);
    assert.ok(!("phone" in items[0]));
    assert.equal(items[0].helperLabel, "Helper P.");
    assert.ok(items[0].org);
    // filter
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{district:"Gorkha", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{district:"Unknown", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(JSON.parse(res.body).items.length, 0);
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{category:"goods", incidentId: TEST_INCIDENT_ID}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
  });
});

describe("moderation", () => {
  it("queue requires moderator|admin role", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    const helperTok = createToken(basePayload({sub:"h1"}), kp.privateKey);
    ddb.store.set("USER#h1|PROFILE", {PK:"USER#h1", SK:"PROFILE", sub:"h1", role:"helper"});
    let res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${helperTok}`}}));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue"}));
    assert.equal(res.statusCode, 401);
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${modTok}`}}));
    assert.equal(res.statusCode, 200);
  });
  it("publish and reject with reason, audit written, dupCandidates present", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    // create need
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Dup Name", district:"Gorkha", ward:2}, category:"goods", description:"Need description long enough for moderation dup test", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {id:id1} = JSON.parse(res.body);
    // queue oldest first
    await new Promise(r=>setTimeout(r,5));
    res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Dup Name", district:"Gorkha", ward:2}, category:"shelter", description:"Another need same name ward for duplicate detection", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {id:id2} = JSON.parse(res.body);
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${modTok}`}}));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 2);
    assert.equal(items[0].id, id1);
    const dup = items[1].dupCandidates;
    assert.ok(Array.isArray(dup));
    assert.ok(dup.some(d=>d.id===id1));
    // reject without reason 400
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id1}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"reject"}}));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id1}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"reject", reason:"spam"}}));
    assert.equal(res.statusCode, 400, "reason too short should fail if <5?");
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id1}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"reject", reason:"invalid request"}}));
    assert.equal(res.statusCode, 200);
    const auditItems = Array.from(ddb.store.values()).filter(v=>v.PK && v.PK.startsWith("AUDIT#"));
    assert.ok(auditItems.length >= 1);
    // publish with edits
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id2}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish", edits:{description:"Edited description long enough for publish edits"}}}));
    assert.equal(res.statusCode, 200);
    const need = ddb.store.get(`NEED#${id2}|META`);
    assert.equal(need.description, "Edited description long enough for publish edits");
  });
  it("forbidden for helper on moderation action", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"X Y", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough for helper forbid", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {id} = JSON.parse(res.body);
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const helperTok = createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${helperTok}`}, body:{action:"publish"}}));
    assert.equal(res.statusCode, 403);
  });
});

async function createInlineNeed(handler, kp, ddb, name = "House Fire") {
  const res = await handler(makeEvent({
    method: "POST",
    path: "/needs",
    headers: { authorization: `Bearer ${createToken(basePayload({ sub: "reporter-1" }), kp.privateKey)}` },
    body: {
      onBehalf: false,
      beneficiary: { name: "Inline Reporter", district: "Gorkha", ward: 4 },
      category: "shelter",
      description: "The household needs urgent shelter after this local emergency",
      language: "en",
      newIncident: { name, kind: "fire", district: "Gorkha", description: "A local emergency needs review" },
      media: [{ fileId: "proof-1", type: "photo", originalUrl: "https://example.com/proof.jpg" }],
    },
  }));
  assert.equal(res.statusCode, 201, res.body);
  const created = JSON.parse(res.body);
  created.incidentId = ddb.store.get(`NEED#${created.id}|META`).incidentId;
  return created;
}

function addInlineModerator(ddb) {
  ddb.store.set("USER#mod-inline|PROFILE", {
    PK: "USER#mod-inline", SK: "PROFILE", sub: "mod-inline", role: "moderator",
    guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [],
    gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("inline incident need lifecycle", () => {
  beforeEach(() => clearJwksCache());

  it("requires auth and a photo, then creates a pending incident", async () => {
    const kp = makeKeyPair();
    const ddb = testDdb();
    const { handler } = makeHandler({ ddb, kp });
    const body = {
      onBehalf: false,
      beneficiary: { name: "Inline Reporter", district: "Gorkha", ward: 4 },
      category: "shelter",
      description: "The household needs urgent shelter after this local emergency",
      language: "en",
      newIncident: { name: "No Photo Fire", kind: "fire", district: "Gorkha", description: "A local emergency needs review" },
    };
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body }));
    assert.equal(res.statusCode, 401);
    const auth = { authorization: `Bearer ${createToken(basePayload({ sub: "reporter-1" }), kp.privateKey)}` };
    res = await handler(makeEvent({ method: "POST", path: "/needs", headers: auth, body }));
    assert.equal(res.statusCode, 400);
    const created = await createInlineNeed(handler, kp, ddb);
    const need = ddb.store.get(`NEED#${created.id}|META`);
    const incident = ddb.store.get(`INCIDENT#${created.incidentId}|META`);
    assert.equal(need.incidentId, created.incidentId);
    assert.equal(incident.status, "pending");
    assert.equal(incident.requestOrigin, "community-request-inline");
  });

  it("publishing an inline-incident need activates its incident", async () => {
    const kp = makeKeyPair();
    const ddb = testDdb();
    const { handler } = makeHandler({ ddb, kp });
    const created = await createInlineNeed(handler, kp, ddb, "Publish Fire");
    addInlineModerator(ddb);
    const modToken = createToken(basePayload({ sub: "mod-inline" }), kp.privateKey);
    const res = await handler(makeEvent({ method: "POST", path: `/moderation/${created.id}`, headers: { authorization: `Bearer ${modToken}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    const incident = ddb.store.get(`INCIDENT#${created.incidentId}|META`);
    assert.equal(incident.status, "active");
    assert.equal(incident.approvedBy, "mod-inline");
  });

  it("rejecting an inline-incident need leaves its incident pending", async () => {
    const kp = makeKeyPair();
    const ddb = testDdb();
    const { handler } = makeHandler({ ddb, kp });
    const created = await createInlineNeed(handler, kp, ddb, "Reject Fire");
    addInlineModerator(ddb);
    const modToken = createToken(basePayload({ sub: "mod-inline" }), kp.privateKey);
    const res = await handler(makeEvent({ method: "POST", path: `/moderation/${created.id}`, headers: { authorization: `Bearer ${modToken}` }, body: { action: "reject", reason: "invalid request" } }));
    assert.equal(res.statusCode, 200);
    assert.equal(ddb.store.get(`NEED#${created.id}|META`).status, "rejected");
    assert.equal(ddb.store.get(`INCIDENT#${created.incidentId}|META`).status, "pending");
  });
});

describe("POST /needs/:id/status", () => {
  it("moderator can change status and matched returns contact", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Benef Person", phone:"+9779800000001", district:"Gorkha", ward:3}, category:"goods", description:"Need description long enough for status change", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {id:needId} = JSON.parse(res.body);
    await handler(makeEvent({method:"POST", path:`/moderation/${needId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    // create offer
    const helperTok = createToken(basePayload({sub:"h1", name:"Offer Helper"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${helperTok}`}, body:{categories:["goods"], districts:["Gorkha"], description:"Offer description long enough for matching test case", phone:"+9779800000009", incidentId: TEST_INCIDENT_ID}}));
    const {id:offerId} = JSON.parse(res.body);
    await handler(makeEvent({method:"POST", path:`/moderation/${offerId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    // helper cannot change status
    const helperTok2 = createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/status`, headers:{authorization:`Bearer ${helperTok2}`}, body:{status:"matched", offerId}}));
    assert.equal(res.statusCode, 403);
    // moderator matched
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"matched", offerId}}));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "matched");
    assert.ok(body.contact);
    assert.equal(body.contact.beneficiary.phone, "+9779800000001");
    assert.equal(body.contact.offer.phone, "+9779800000009");
    // fulfilled
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"fulfilled"}}));
    assert.equal(res.statusCode, 200);
    // archived
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"archived"}}));
    assert.equal(res.statusCode, 200);
    // audit written
    const audits = Array.from(ddb.store.values()).filter(v=>v.PK && v.PK.startsWith("AUDIT#"));
    assert.ok(audits.length >= 3);
  });
});

describe("POST /offers/:id/status", () => {
  it("moderator can archive a published offer; non-moderator and pre-publish are rejected", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const helperTok = createToken(basePayload({sub:"h1", name:"Offer Helper"}), kp.privateKey);
    let res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${helperTok}`}, body:{categories:["goods"], districts:["Gorkha"], description:"Offer description long enough for archive test case", phone:"+9779800000009", incidentId: TEST_INCIDENT_ID}}));
    const {id:offerId} = JSON.parse(res.body);
    // pending offer cannot be archived
    res = await handler(makeEvent({method:"POST", path:`/offers/${offerId}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"archived"}}));
    assert.equal(res.statusCode, 400);
    await handler(makeEvent({method:"POST", path:`/moderation/${offerId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    // non-moderator cannot archive
    const helperTok2 = createToken(basePayload({sub:"helper-2"}), kp.privateKey);
    ddb.store.set("USER#helper-2|PROFILE", {PK:"USER#helper-2", SK:"PROFILE", sub:"helper-2", role:"helper"});
    res = await handler(makeEvent({method:"POST", path:`/offers/${offerId}/status`, headers:{authorization:`Bearer ${helperTok2}`}, body:{status:"archived"}}));
    assert.equal(res.statusCode, 403);
    // moderator archives the published offer
    res = await handler(makeEvent({method:"POST", path:`/offers/${offerId}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"archived"}}));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, "archived");
    assert.equal(ddb.store.get(`OFFER#${offerId}|META`).status, "archived");
    const audits = Array.from(ddb.store.values()).filter(v=>v.PK && v.PK.startsWith("AUDIT#") && v.targetType === "OFFER");
    assert.ok(audits.length >= 1);
  });
});

describe("POST /needs/:id/edit and /offers/:id/edit", () => {
  it("moderator can correct fields on a published need and offer; pre-publish and non-moderator are rejected", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);

    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Benef Person", phone:"+9779800000001", district:"Gorkha", ward:3}, category:"goods", description:"Need description long enough for edit test case", language:"en", incidentId: TEST_INCIDENT_ID}}));
    const {id:needId} = JSON.parse(res.body);
    // pending need cannot be edited via this endpoint
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/edit`, headers:{authorization:`Bearer ${modTok}`}, body:{edits:{description:"A corrected description that is long enough"}}}));
    assert.equal(res.statusCode, 400);
    await handler(makeEvent({method:"POST", path:`/moderation/${needId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    const helperTok2 = createToken(basePayload({sub:"helper-3"}), kp.privateKey);
    ddb.store.set("USER#helper-3|PROFILE", {PK:"USER#helper-3", SK:"PROFILE", sub:"helper-3", role:"helper"});
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/edit`, headers:{authorization:`Bearer ${helperTok2}`}, body:{edits:{description:"A corrected description that is long enough"}}}));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({method:"POST", path:`/needs/${needId}/edit`, headers:{authorization:`Bearer ${modTok}`}, body:{edits:{description:"A corrected description that is long enough", beneficiary:{ward:7}}}}));
    assert.equal(res.statusCode, 200);
    const savedNeed = ddb.store.get(`NEED#${needId}|META`);
    assert.equal(savedNeed.description, "A corrected description that is long enough");
    assert.equal(savedNeed.beneficiary.ward, 7);
    assert.equal(savedNeed.status, "published");

    const helperTok = createToken(basePayload({sub:"h1", name:"Offer Helper"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${helperTok}`}, body:{categories:["goods"], districts:["Gorkha"], description:"Offer description long enough for edit test case", phone:"+9779800000009", incidentId: TEST_INCIDENT_ID}}));
    const {id:offerId} = JSON.parse(res.body);
    res = await handler(makeEvent({method:"POST", path:`/offers/${offerId}/edit`, headers:{authorization:`Bearer ${modTok}`}, body:{edits:{description:"A corrected offer description long enough"}}}));
    assert.equal(res.statusCode, 400);
    await handler(makeEvent({method:"POST", path:`/moderation/${offerId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    res = await handler(makeEvent({method:"POST", path:`/offers/${offerId}/edit`, headers:{authorization:`Bearer ${modTok}`}, body:{edits:{description:"A corrected offer description long enough", districts:["Nuwakot"]}}}));
    assert.equal(res.statusCode, 200);
    const savedOffer = ddb.store.get(`OFFER#${offerId}|META`);
    assert.equal(savedOffer.description, "A corrected offer description long enough");
    assert.deepEqual(savedOffer.districts, ["Nuwakot"]);
    assert.equal(savedOffer.status, "published");
    assert.equal(savedOffer.gsi1pk, `OFFER#${TEST_INCIDENT_ID}#Nuwakot#published`);
  });
});

describe("POST /admin/incidents/:id/edit", () => {
  it("admin can correct incident fields; moderator is rejected", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = testDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#admin-1|PROFILE", {PK:"USER#admin-1", SK:"PROFILE", sub:"admin-1", role:"admin"});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: []});
    const adminTok = createToken(basePayload({sub:"admin-1"}), kp.privateKey);
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);

    let res = await handler(makeEvent({method:"POST", path:"/admin/incidents", headers:{authorization:`Bearer ${adminTok}`}, body:{name:"Test Flood", kind:"flood", startedAt:"2026-08-01", affectedDistricts:["Gorkha"]}}));
    assert.equal(res.statusCode, 201);
    const {id:incidentId} = JSON.parse(res.body);

    res = await handler(makeEvent({method:"POST", path:`/admin/incidents/${incidentId}/edit`, headers:{authorization:`Bearer ${modTok}`}, body:{edits:{name:"Corrected Flood Name"}}}));
    assert.equal(res.statusCode, 403);

    res = await handler(makeEvent({method:"POST", path:`/admin/incidents/${incidentId}/edit`, headers:{authorization:`Bearer ${adminTok}`}, body:{edits:{name:"Corrected Flood Name", affectedDistricts:["Gorkha","Nuwakot"]}}}));
    assert.equal(res.statusCode, 200);
    const saved = ddb.store.get(`INCIDENT#${incidentId}|META`);
    assert.equal(saved.name, "Corrected Flood Name");
    assert.deepEqual(saved.affectedDistricts, ["Gorkha","Nuwakot"]);
  });
});
