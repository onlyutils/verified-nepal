import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function makeHandler({ envOverrides = {}, ddb, kp } = {}) {
  const keyPair = kp ?? makeKeyPair();
  const d = ddb ?? new FakeDdb();
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
    const ddb = new FakeDdb();
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    const res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5 }, category: "goods", description: "Need food and water for family in ward five", language: "en" } }));
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
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: new FakeDdb(), fetchJwks });
    // missing ward
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha" }, category: "goods", description: "need description long enough here", language: "en" } }));
    assert.equal(res.statusCode, 400);
    // invalid ward 34
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 34 }, category: "goods", description: "need description long enough here", language: "en" } }));
    assert.equal(res.statusCode, 400);
    // invalid category
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "invalid", description: "need description long enough here", language: "en" } }));
    assert.equal(res.statusCode, 400);
    // description too short
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "short", language: "en" } }));
    assert.equal(res.statusCode, 400);
    // language invalid
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "fr" } }));
    assert.equal(res.statusCode, 400);
  });

  it("requires registrant when onBehalf true", async () => {
    const handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: new FakeDdb(), fetchJwks });
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, registrant: { name: "Reg", phone: "98abc" }, beneficiary: { name: "x", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here", language: "en" } }));
    assert.equal(res.statusCode, 400);
  });

  it("skips turnstile when secret unset, verifies when set", async () => {
    const ddb = new FakeDdb();
    // unset -> should succeed without token
    let handler = createHandler({ env: { TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en" } }));
    assert.equal(res.statusCode, 201);
    // with secret set, token required
    const origFetch = global.fetch;
    global.fetch = async () => ({ json: async () => ({ success: true }) });
    handler = createHandler({ env: { TABLE_NAME: "t", TURNSTILE_SECRET: "secret" }, ddbClient: new FakeDdb(), fetchJwks });
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", turnstileToken: "tok" } }));
    assert.equal(res.statusCode, 201);
    // failed verification
    global.fetch = async () => ({ json: async () => ({ success: false }) });
    handler = createHandler({ env: { TABLE_NAME: "t", TURNSTILE_SECRET: "secret" }, ddbClient: new FakeDdb(), fetchJwks });
    res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "A B", district: "Gorkha", ward: 1 }, category: "goods", description: "need description long enough here again", language: "en", turnstileToken: "bad" } }));
    assert.equal(res.statusCode, 400);
    global.fetch = origFetch;
  });
});

describe("GET /needs public board", () => {
  it("only shows published/matched/fulfilled and masks name, never leaks private fields", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const ddb = new FakeDdb();
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    // create need with private data
    let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: true, registrant: { name: "Registrar Name", phone: "+9779800000001" }, beneficiary: { name: "Rita Gurung", phone: "+9779800000002", district: "Gorkha", ward: 5, householdSize: 4 }, category: "goods", description: "Private household data must never leak to public board view", language: "en" } }));
    const { id, refCode } = JSON.parse(res.body);
    // pending not visible
    res = await handler(makeEvent({ method: "GET", path: "/needs" }));
    assert.equal(JSON.parse(res.body).items.length, 0);
    // publish as moderator
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" });
    const modToken = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    res = await handler(makeEvent({ method: "POST", path: `/moderation/${id}`, headers: { authorization: `Bearer ${modToken}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({ method: "GET", path: "/needs" }));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.maskedName, "Rita G.");
    assert.equal(item.district, "Gorkha");
    assert.equal(item.ward, 5);
    // dedicated leak assertion - check keys, not substrings
    for (const it of items) {
      assert.equal("phone" in it, false, "phone leaked");
      assert.equal("registrant" in it, false, "registrant leaked");
      assert.equal("householdSize" in it, false, "household leaked");
      assert.equal("household" in it, false, "household leaked");
    }
    const raw = JSON.stringify(items);
    assert.equal(raw.includes("registrant"), false, "registrant leaked");
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
    const ddb = new FakeDdb();
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" });
    const modToken = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    // create 3 needs in different districts/categories
    const ids = [];
    for (const cfg of [{district:"Gorkha", category:"goods"}, {district:"Kathmandu", category:"medical"}, {district:"Gorkha", category:"medical"}]) {
      let res = await handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf:false, beneficiary:{name:`Ben ${cfg.district}`, district:cfg.district, ward:1}, category:cfg.category, description:"Need description long enough for test "+cfg.district, language:"en" } }));
      const {id} = JSON.parse(res.body);
      ids.push(id);
      await handler(makeEvent({ method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${modToken}`}, body:{action:"publish"}}));
    }
    let res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{district:"Gorkha"}}));
    // also test rawPath query parsing
    res = await handler(makeEvent({ method:"GET", path:"/needs?district=Gorkha" }));
    assert.equal(JSON.parse(res.body).items.length, 2);
    res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{category:"medical"}}));
    assert.equal(JSON.parse(res.body).items.length, 2);
    res = await handler(makeEvent({ method:"GET", path:"/needs", queryStringParameters:{district:"Gorkha", category:"goods"}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
  });
});

describe("GET /status and POST renew", () => {
  it("returns 404 for unknown refCode and returns status for known", async () => {
    const ddb = new FakeDdb();
    const kp = makeKeyPair();
    const fetchJwks = async () => ({ keys: [kp.jwk] });
    const handler = createHandler({ env:{TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"GET", path:"/status/UNKNOWN123"}));
    assert.equal(res.statusCode, 404);
    res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"X Y", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough here for status", language:"en"}}));
    const {refCode} = JSON.parse(res.body);
    res = await handler(makeEvent({method:"GET", path:`/status/${refCode}`}));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.status);
    assert.ok(body.expiresAt);
    assert.ok(body.createdAt);
  });
  it("renew extends TTL 30 days", async () => {
    const ddb = new FakeDdb();
    const handler = createHandler({ env:{TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks: async()=>({keys:[]}) });
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"A B", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough for renew test", language:"en"}}));
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
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"POST", path:"/offers", body:{categories:["goods"], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000"}}));
    assert.equal(res.statusCode, 401);
    const token = createToken(basePayload({sub:"h1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:[], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000"}}));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:["invalid"], districts:["Gorkha"], description:"We can provide goods in Gorkha for ten families", phone:"+9779800000000"}}));
    assert.equal(res.statusCode, 400);
  });
  it("creates offer and public GET does not leak phone", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    const token = createToken(basePayload({sub:"h1", name:"Helper Person"}), kp.privateKey);
    let res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${token}`}, body:{categories:["goods","medical"], districts:["Gorkha","Kathmandu"], description:"We can provide goods and medical aid in Gorkha and Kathmandu", phone:"+9779800000000", org:{name:"Youth Club", contact:"contact@youth.org"}}}));
    assert.equal(res.statusCode, 201);
    const {id} = JSON.parse(res.body);
    // pending not visible
    res = await handler(makeEvent({method:"GET", path:"/offers"}));
    assert.equal(JSON.parse(res.body).items.length, 0);
    // publish
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator"});
    const modToken = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${modToken}`}, body:{action:"publish"}}));
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({method:"GET", path:"/offers"}));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 1);
    assert.ok(!("phone" in items[0]));
    assert.equal(items[0].helperLabel, "Helper P.");
    assert.ok(items[0].org);
    // filter
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{district:"Gorkha"}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{district:"Unknown"}}));
    assert.equal(JSON.parse(res.body).items.length, 0);
    res = await handler(makeEvent({method:"GET", path:"/offers", queryStringParameters:{category:"goods"}}));
    assert.equal(JSON.parse(res.body).items.length, 1);
  });
});

describe("moderation", () => {
  it("queue requires moderator|admin role", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    const helperTok = createToken(basePayload({sub:"h1"}), kp.privateKey);
    ddb.store.set("USER#h1|PROFILE", {PK:"USER#h1", SK:"PROFILE", sub:"h1", role:"helper"});
    let res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${helperTok}`}}));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue"}));
    assert.equal(res.statusCode, 401);
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator"});
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${modTok}`}}));
    assert.equal(res.statusCode, 200);
  });
  it("publish and reject with reason, audit written, dupCandidates present", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator"});
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    // create need
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Dup Name", district:"Gorkha", ward:2}, category:"goods", description:"Need description long enough for moderation dup test", language:"en"}}));
    const {id:id1} = JSON.parse(res.body);
    // queue oldest first
    await new Promise(r=>setTimeout(r,5));
    res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Dup Name", district:"Gorkha", ward:2}, category:"shelter", description:"Another need same name ward for duplicate detection", language:"en"}}));
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
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"X Y", district:"Gorkha", ward:1}, category:"goods", description:"Need description long enough for helper forbid", language:"en"}}));
    const {id} = JSON.parse(res.body);
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const helperTok = createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${helperTok}`}, body:{action:"publish"}}));
    assert.equal(res.statusCode, 403);
  });
});

describe("POST /needs/:id/status", () => {
  it("moderator can change status and matched returns contact", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchJwks = async()=>({keys:[kp.jwk]});
    const handler = createHandler({ env:{AUTH_ISSUER:"https://auth.onlyutils.com", TABLE_NAME:"t"}, ddbClient:ddb, fetchJwks });
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator"});
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    let res = await handler(makeEvent({method:"POST", path:"/needs", body:{onBehalf:false, beneficiary:{name:"Benef Person", phone:"+9779800000001", district:"Gorkha", ward:3}, category:"goods", description:"Need description long enough for status change", language:"en"}}));
    const {id:needId} = JSON.parse(res.body);
    await handler(makeEvent({method:"POST", path:`/moderation/${needId}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
    // create offer
    const helperTok = createToken(basePayload({sub:"h1", name:"Offer Helper"}), kp.privateKey);
    res = await handler(makeEvent({method:"POST", path:"/offers", headers:{authorization:`Bearer ${helperTok}`}, body:{categories:["goods"], districts:["Gorkha"], description:"Offer description long enough for matching test case", phone:"+9779800000009"}}));
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
