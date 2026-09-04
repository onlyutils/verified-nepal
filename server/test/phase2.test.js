import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";

function makeHandler(opts = {}) {
  const kp = opts.kp ?? makeKeyPair();
  const ddb = opts.ddb ?? new FakeDdb();
  seedActiveIncident(ddb);
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t", ...opts.envOverrides };
  const fetchJwks = opts.fetchJwks ?? (async () => ({ keys: [kp.jwk] }));
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: opts.fetch });
  return { handler, ddb, kp, env, fetchJwks };
}
async function createNeed(handler, overrides={}) {
  const body = {
    onBehalf: false,
    beneficiary: { name: overrides.name || "Rita Gurung", district: overrides.district || "Gorkha", ward: overrides.ward ?? 5, householdSize: 4, phone: "+9779800000001" },
    registrant: { name: "Reg Name", phone: "+9779800000002" },
    category: overrides.category || "goods",
    description: overrides.description || "Need food and shelter for testing phase two long enough description",
    language: "en",
    incidentId: TEST_INCIDENT_ID,
    ...overrides.extra
  };
  if (overrides.beneficiary) body.beneficiary = { ...body.beneficiary, ...overrides.beneficiary };
  const res = await handler(makeEvent({ method:"POST", path:"/needs", body }));
  assert.equal(res.statusCode, 201, `createNeed failed ${res.body}`);
  return JSON.parse(res.body);
}
async function publishNeed(handler, modTok, id) {
  const res = await handler(makeEvent({ method:"POST", path:`/moderation/${id}`, headers:{authorization:`Bearer ${modTok}`}, body:{action:"publish"}}));
  assert.equal(res.statusCode, 200);
  return JSON.parse(res.body);
}
function claimAlphabetRegex() { return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/; }

describe("Phase2 claim mint", () => {
  beforeEach(()=> clearJwksCache());
  it("mints 8-char claimCode on publish, stores pointer, returns in moderation response, visible in /status, never in public /needs", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const {handler} = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const {id, refCode} = await createNeed(handler, { name:"Sita Sharma", district:"Gorkha", ward:3 });
    // before publish, status has no claimCode
    let res = await handler(makeEvent({method:"GET", path:`/status/${refCode}`}));
    let body = JSON.parse(res.body);
    assert.equal(body.claimCode, undefined);
    // public needs should not leak claimCode even after publish
    let pubBefore = await handler(makeEvent({method:"GET", path:`/needs?incidentId=${TEST_INCIDENT_ID}`}));
    assert.equal(JSON.parse(pubBefore.body).items.length, 0);
    const pubRes = await publishNeed(handler, modTok, id);
    assert.ok(pubRes.claimCode, "publish should return claimCode");
    assert.match(pubRes.claimCode, claimAlphabetRegex());
    // stored on need
    const need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.claimCode, pubRes.claimCode);
    assert.equal(need.claimCode.length, 8);
    // pointer
    const ptr = ddb.store.get(`CLAIM#${pubRes.claimCode}|META`);
    assert.ok(ptr);
    assert.equal(ptr.needId, id);
    // status now shows claimCode
    res = await handler(makeEvent({method:"GET", path:`/status/${refCode}`}));
    body = JSON.parse(res.body);
    assert.equal(body.claimCode, pubRes.claimCode);
    // public /needs never exposes claimCode or sensitive fields
    res = await handler(makeEvent({method:"GET", path:`/needs?incidentId=${TEST_INCIDENT_ID}`}));
    const items = JSON.parse(res.body).items;
    assert.equal(items.length, 1);
    const it = items[0];
    assert.equal(it.claimCode, undefined);
    assert.equal("householdSize" in it, false);
    assert.equal("phone" in it, false);
    assert.equal("registrant" in it, false);
    const raw = JSON.stringify(items);
    assert.equal(raw.includes("householdSize"), false);
    // pending queue before publish should not have claimCode (verified by above: pubBefore length 0)
    // after publish, pending queue should not contain the published item, but direct need has claimCode (already asserted)
    // verify that a pending need in queue has no claimCode
    const {id: pendingId} = await createNeed(handler, { name:"Pending NoClaim", district:"Gorkha", ward:1 });
    res = await handler(makeEvent({method:"GET", path:"/moderation/queue", headers:{authorization:`Bearer ${modTok}`}}));
    const queue = JSON.parse(res.body).items;
    const pendingQ = queue.find(x=>x.id===pendingId);
    assert.ok(pendingQ, "pending item should be in queue");
    assert.equal(pendingQ.claimCode, undefined, "pending should not have claimCode");
  });
  it("claim alphabet excludes 0/O/1/I", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const {handler} = makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    for(let i=0;i<5;i++){
      const {id} = await createNeed(handler, { ward: (i%33)+1, name:`Ben ${i} Kumar`});
      const pub = await publishNeed(handler, modTok, id);
      assert.match(pub.claimCode, claimAlphabetRegex());
      assert.equal(/[01OI0]/.test(pub.claimCode), false);
    }
  });
});

describe("POST /claims/:code/redeem", () => {
  beforeEach(()=>clearJwksCache());
  it("redeems, writes ledger dual copy and audit, handles 409 and 404 and role gates", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const {handler} = makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const helperTok = createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    const {id} = await createNeed(handler, { name:"Hari Bahadur", district:"Gorkha", ward:7, category:"medical" });
    const {claimCode} = await publishNeed(handler, modTok, id);
    // 401 no auth
    let res = await handler(makeEvent({method:"POST", path:`/claims/${claimCode}/redeem`, body:{}}));
    assert.equal(res.statusCode, 401);
    // 403 helper
    res = await handler(makeEvent({method:"POST", path:`/claims/${claimCode}/redeem`, headers:{authorization:`Bearer ${helperTok}`}, body:{}}));
    assert.equal(res.statusCode, 403);
    // 404 unknown
    res = await handler(makeEvent({method:"POST", path:"/claims/UNKNOWN1/redeem", headers:{authorization:`Bearer ${modTok}`}, body:{}}));
    assert.equal(res.statusCode, 404);
    // success
    res = await handler(makeEvent({method:"POST", path:`/claims/${claimCode}/redeem`, headers:{authorization:`Bearer ${modTok}`}, body:{note:"delivered"}}));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "redeemed");
    assert.equal(body.needId, id);
    assert.ok(body.redeemedAt);
    const redeemedAt = body.redeemedAt;
    // need fulfilled GSI
    const need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.status, "fulfilled");
    assert.equal(need.gsi1pk, `NEED#${TEST_INCIDENT_ID}#Gorkha#fulfilled`);
    assert.equal(need.gsi2pk, `NEED#fulfilled`);
    assert.equal(need.redeemedAt, redeemedAt);
    // ledger dual copy
    const l1 = ddb.store.get(`LEDGER#Gorkha#7|${redeemedAt}#${id}`);
    assert.ok(l1);
    assert.equal(l1.maskedName, "Hari B.");
    assert.equal(l1.category, "medical");
    assert.equal(l1.district, "Gorkha");
    assert.equal(l1.ward, 7);
    const l2 = ddb.store.get(`LEDGER#Gorkha|${redeemedAt}#${id}`);
    assert.ok(l2);
    assert.deepEqual(l2.maskedName, l1.maskedName);
    // audit
    const audits = Array.from(ddb.store.values()).filter(v=>v.PK && v.PK.startsWith("AUDIT#") && v.action==="redeem");
    assert.ok(audits.length >=1);
    // 409 double redemption
    res = await handler(makeEvent({method:"POST", path:`/claims/${claimCode}/redeem`, headers:{authorization:`Bearer ${modTok}`}, body:{}}));
    assert.equal(res.statusCode, 409);
    const b2 = JSON.parse(res.body);
    assert.equal(b2.error, "already_redeemed");
    assert.equal(b2.redeemedAt, redeemedAt);
    // ensure no second ledger write changed count
    const ledgerCount = Array.from(ddb.store.values()).filter(v=>v.PK && v.PK.startsWith("LEDGER#")).length;
    assert.equal(ledgerCount, 2);
  });
});

describe("POST /claims/sync", () => {
  beforeEach(()=>clearJwksCache());
  it("bulk sync idempotency, unknown handling, max 200, role gates", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const {handler} = makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const helperTok = createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const ids = [];
    const codes = [];
    for(let i=0;i<3;i++){
      const {id} = await createNeed(handler, { ward:i+1, name:`Sync Ben ${i} Thapa`, district:"Gorkha", category:"goods"});
      const {claimCode} = await publishNeed(handler, modTok, id);
      ids.push(id); codes.push(claimCode);
    }
    // role gate helper
    let res = await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${helperTok}`}, body:{redemptions:[{code: codes[0], redeemedAt: new Date().toISOString()}]}}));
    assert.equal(res.statusCode, 403);
    // sync first two with supplied redeemedAt
    const iso1 = new Date("2026-08-20T10:00:00.000Z").toISOString();
    const iso2 = new Date("2026-08-21T11:00:00.000Z").toISOString();
    res = await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions:[{code: codes[0], redeemedAt: iso1, note:"n1"}, {code: codes[1], redeemedAt: iso2}, {code:"FAKECODE", redeemedAt: iso1}]}}));
    assert.equal(res.statusCode, 200);
    const results = JSON.parse(res.body).results;
    assert.equal(results.length, 3);
    assert.equal(results[0].code, codes[0]); assert.equal(results[0].status, "redeemed"); assert.equal(results[0].needId, ids[0]);
    assert.equal(results[1].status, "redeemed");
    assert.equal(results[2].status, "unknown");
    // ledger uses supplied redeemedAt
    const l = ddb.store.get(`LEDGER#Gorkha#1|${iso1}#${ids[0]}`);
    assert.ok(l);
    assert.equal(l.redeemedAt, iso1);
    // idempotent repeat
    res = await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions:[{code: codes[0], redeemedAt: iso1}, {code: codes[1], redeemedAt: iso2}]}}));
    const r2 = JSON.parse(res.body).results;
    assert.equal(r2[0].status, "already_redeemed"); assert.equal(r2[0].needId, ids[0]);
    assert.equal(r2[1].status, "already_redeemed");
    // duplicate code in same batch
    res = await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions:[{code: codes[2], redeemedAt: iso1}, {code: codes[2], redeemedAt: iso2}]}}));
    const r3 = JSON.parse(res.body).results;
    assert.equal(r3[0].status, "redeemed");
    assert.equal(r3[1].status, "already_redeemed");
    // max 200
    const big = Array.from({length:201}, ()=>({code: codes[0], redeemedAt: iso1}));
    res = await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions: big}}));
    assert.equal(res.statusCode, 400);
  });
});

describe("GET /claims/print", () => {
  beforeEach(()=>clearJwksCache());
  it("requires mod, filters published|matched in ward sorted by maskedName, no leak", async () => {
    const kp=makeKeyPair();
    const ddb=new FakeDdb();
    const {handler}=makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const modTok=createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const helperTok=createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    // create 3 needs in same ward, different names, publish two and match one, plus one fulfilled should not appear
    const {id:idA} = await createNeed(handler, {name:"Zebra Yadav", district:"Gorkha", ward:9});
    const {id:idB} = await createNeed(handler, {name:"Apple Gurung", district:"Gorkha", ward:9});
    const {id:idC} = await createNeed(handler, {name:"Mango Thapa", district:"Gorkha", ward:9});
    const {id:idD} = await createNeed(handler, {name:"Other Ward", district:"Gorkha", ward:5});
    for(const id of [idA,idB,idC,idD]) await publishNeed(handler, modTok, id);
    // set one to matched
    let res = await handler(makeEvent({method:"POST", path:`/needs/${idC}/status`, headers:{authorization:`Bearer ${modTok}`}, body:{status:"matched"}}));
    assert.equal(res.statusCode, 200);
    // fulfill one (via redeem) - should not appear in print
    const codeA = ddb.store.get(`NEED#${idA}|META`).claimCode;
    await handler(makeEvent({method:"POST", path:`/claims/${codeA}/redeem`, headers:{authorization:`Bearer ${modTok}`}, body:{}}));
    // 401/403
    res = await handler(makeEvent({method:"GET", path:"/claims/print", queryStringParameters:{district:"Gorkha", ward:"9"}}));
    assert.equal(res.statusCode, 401);
    res = await handler(makeEvent({method:"GET", path:"/claims/print", headers:{authorization:`Bearer ${helperTok}`}, queryStringParameters:{district:"Gorkha", ward:"9"}}));
    assert.equal(res.statusCode, 403);
    // missing params
    res = await handler(makeEvent({method:"GET", path:"/claims/print", headers:{authorization:`Bearer ${modTok}`}, queryStringParameters:{district:"Gorkha"}}));
    assert.equal(res.statusCode, 400);
    // success
    res = await handler(makeEvent({method:"GET", path:"/claims/print", headers:{authorization:`Bearer ${modTok}`}, queryStringParameters:{district:"Gorkha", ward:"9"}}));
    assert.equal(res.statusCode, 200);
    const items = JSON.parse(res.body).items;
    // should contain idB (published) and idC (matched), not idA fulfilled, not idD different ward
    assert.equal(items.length, 2);
    // sorted by maskedName: Apple G. before Mango T.
    assert.equal(items[0].maskedName, "Apple G.");
    assert.equal(items[1].maskedName, "Mango T.");
    for(const it of items){
      assert.ok(it.claimCode);
      assert.ok(it.maskedName);
      assert.ok(it.category);
      assert.equal(it.ward, 9);
      assert.ok(["published","matched"].includes(it.status));
      assert.equal("phone" in it, false);
      assert.equal("householdSize" in it, false);
      assert.equal("registrant" in it, false);
    }
    const raw = JSON.stringify(items);
    assert.equal(raw.includes("phone"), false);
    assert.equal(raw.includes("householdSize"), false);
  });
});

describe("GET /ledger", () => {
  beforeEach(()=>clearJwksCache());
  it("public json and csv, district+ward and district-only via single query, newest first, escaping, masking", async () => {
    const kp=makeKeyPair();
    const ddb=new FakeDdb();
    const {handler}=makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok=createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    // create needs with names that test masking / csv
    const {id:id1} = await createNeed(handler, {name:"Ram, Bahadur", district:"Gorkha", ward:4, category:"goods"});
    const {id:id2} = await createNeed(handler, {name:"Sita Kumari", district:"Gorkha", ward:4, category:"shelter"});
    const {id:id3} = await createNeed(handler, {name:"Hari Thapa", district:"Gorkha", ward:5, category:"goods"});
    const c1 = (await publishNeed(handler, modTok, id1)).claimCode;
    const c2 = (await publishNeed(handler, modTok, id2)).claimCode;
    const c3 = (await publishNeed(handler, modTok, id3)).claimCode;
    const iso1 = new Date("2026-08-10T09:00:00.000Z").toISOString();
    const iso2 = new Date("2026-08-11T10:00:00.000Z").toISOString();
    const iso3 = new Date("2026-08-12T11:00:00.000Z").toISOString();
    // redeem via sync with supplied times to control order
    await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions:[{code:c1, redeemedAt: iso1}, {code:c2, redeemedAt: iso2}, {code:c3, redeemedAt: iso3}]}}));
    // ward specific json newest first
    let res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha", ward:"4"}}));
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /json/);
    assert.equal(res.headers["cache-control"], "public, max-age=60");
    let body = JSON.parse(res.body);
    assert.equal(body.items.length, 2);
    // newest first: iso2 before iso1
    assert.equal(body.items[0].redeemedAt, iso2);
    assert.equal(body.items[1].redeemedAt, iso1);
    // check maskedName: Ram, Bahadur -> Ram, B. (masked retains comma)
    const ramItem = body.items.find(it=>it.redeemedAt===iso1);
    assert.equal(ramItem.maskedName, "Ram, B.");
    assert.equal(ramItem.category, "goods");
    // district-only should return all 3 via second copy single query
    res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha"}}));
    body = JSON.parse(res.body);
    assert.equal(body.items.length, 3);
    assert.equal(body.items[0].redeemedAt, iso3);
    // csv header and escaping
    res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha", ward:"4", format:"csv"}}));
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /csv/);
    const csv = res.body;
    const lines = csv.split("\n");
    assert.equal(lines[0], "maskedName,category,district,ward,redeemedAt");
    // second line should be for newest in ward 4 (Sita K.)
    assert.ok(lines[1].includes("Sita K."));
    // line with comma should be quoted
    const ramLine = lines.find(l=>l.includes("Ram,"));
    assert.ok(ramLine, "csv should contain Ram line");
    // csv escaped: field with comma must be quoted
    assert.ok(ramLine.startsWith('"Ram, B."'), `ram line not escaped: ${ramLine}`);
    // no sensitive keys in ledger json
    const jsonStr = JSON.stringify(body.items);
    assert.equal(jsonStr.includes("phone"), false);
    assert.equal(jsonStr.includes("householdSize"), false);
    assert.equal(jsonStr.includes("registrant"), false);
    assert.equal(jsonStr.includes("household"), false);
    for(const it of body.items){
      assert.equal("phone" in it, false);
      assert.equal("householdSize" in it, false);
      assert.deepEqual(Object.keys(it).sort(), ["category","district","maskedName","redeemedAt","ward"]);
    }
    // district required
    res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{}}));
    assert.equal(res.statusCode, 400);
    // escaping test with quote
    // test quote escaping via district containing quotes (maskedName quote already tested via comma)
    // create a need whose maskedName will contain a quote in first name
    const {id:id4} = await createNeed(handler, {name:'Te"st Singh', district:"Gorkha", ward:4});
    const c4 = (await publishNeed(handler, modTok, id4)).claimCode;
    const iso4 = new Date("2026-08-13T12:00:00.000Z").toISOString();
    await handler(makeEvent({method:"POST", path:"/claims/sync", headers:{authorization:`Bearer ${modTok}`}, body:{redemptions:[{code:c4, redeemedAt: iso4}]}}));
    res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha", ward:"4", format:"csv"}}));
    const csv2 = res.body;
    // maskedName Te"st S. should be escaped with doubled quotes
    assert.ok(csv2.includes('Te""st'), `quote escaping failed in ${csv2}`);
  });
});

describe("flags", () => {
  beforeEach(()=>clearJwksCache());
  it("anonymous flag creation, validation, flagCount increment, turnstile, and moderation listing", async () => {
    const kp=makeKeyPair();
    const ddb=new FakeDdb();
    const {handler} = makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok=createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const {id} = await createNeed(handler, { district:"Gorkha", ward:2 });
    // invalid reason
    let res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"bad"}}));
    assert.equal(res.statusCode, 400);
    // details too long
    res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"other", details:"x".repeat(501)}}));
    assert.equal(res.statusCode, 400);
    // success
    res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"already_received", details:"already got help"}}));
    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), {ok:true});
    let need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.flagCount, 1);
    // second flag
    res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"not_real"}}));
    assert.equal(res.statusCode, 201);
    need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.flagCount, 2);
    // moderation flags requires mod
    res = await handler(makeEvent({method:"GET", path:"/moderation/flags"}));
    assert.equal(res.statusCode, 401);
    ddb.store.set("USER#helper-1|PROFILE", {PK:"USER#helper-1", SK:"PROFILE", sub:"helper-1", role:"helper"});
    const helperTok=createToken(basePayload({sub:"helper-1"}), kp.privateKey);
    res = await handler(makeEvent({method:"GET", path:"/moderation/flags", headers:{authorization:`Bearer ${helperTok}`}}));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({method:"GET", path:"/moderation/flags", headers:{authorization:`Bearer ${modTok}`}}));
    assert.equal(res.statusCode, 200);
    let flagsBody = JSON.parse(res.body);
    assert.equal(flagsBody.items.length, 1);
    assert.equal(flagsBody.items[0].needId, id);
    assert.equal(flagsBody.items[0].flagCount, 2);
    assert.equal(flagsBody.items[0].flags.length, 2);
    // most-flagged first ordering
    const {id:id2} = await createNeed(handler, { district:"Gorkha", ward:3, name:"Second Flagged" });
    await handler(makeEvent({method:"POST", path:`/needs/${id2}/flag`, body:{reason:"other"}}));
    res = await handler(makeEvent({method:"GET", path:"/moderation/flags", headers:{authorization:`Bearer ${modTok}`}}));
    flagsBody = JSON.parse(res.body);
    assert.equal(flagsBody.items[0].needId, id, "most flagged first");
    assert.equal(flagsBody.items[1].needId, id2);
    // public endpoints never expose flags
    res = await handler(makeEvent({method:"GET", path:`/needs?incidentId=${TEST_INCIDENT_ID}`}));
    // publish both to make them visible publicly
    await publishNeed(handler, modTok, id);
    await publishNeed(handler, modTok, id2);
    res = await handler(makeEvent({method:"GET", path:`/needs?incidentId=${TEST_INCIDENT_ID}`}));
    const pubItems = JSON.parse(res.body).items;
    for(const it of pubItems){
      assert.equal("flagCount" in it, false);
      assert.equal("flags" in it, false);
    }
    // 404 for unknown need
    res = await handler(makeEvent({method:"POST", path:"/needs/UNKNOWN/flag", body:{reason:"other"}}));
    assert.equal(res.statusCode, 404);
  });
  it("turnstile enforced when secret set", async () => {
    const kp=makeKeyPair();
    const ddb=new FakeDdb();
    const fetchMock = async (url, init) => {
      // turnstile verify mock: only token "valid-token" succeeds
      const body = init.body.toString();
      const params = new URLSearchParams(body);
      const token = params.get("response");
      return { ok:true, json: async()=>({ success: token==="valid-token" }) };
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    // create need without secret first
    let handlerWrap = makeHandler({kp, ddb, envOverrides:{}});
    let handler = handlerWrap.handler;
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const {id} = await createNeed(handler, { name:"Turnstile Test", district:"Gorkha", ward:1 });
    // now switch to secret-enforced handler
    const withSecret = makeHandler({kp, ddb, envOverrides:{TURNSTILE_SECRET:"secret"}});
    handler = withSecret.handler;
    let res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"other"}}));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"other", turnstileToken:"invalid"}}));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({method:"POST", path:`/needs/${id}/flag`, body:{reason:"other", turnstileToken:"valid-token"}}));
    assert.equal(res.statusCode, 201);
    globalThis.fetch = origFetch;
  });
});

describe("safety masking across public outputs", () => {
  beforeEach(()=>clearJwksCache());
  it("ledger json/csv and print never leak sensitive fields", async () => {
    const kp=makeKeyPair();
    const ddb=new FakeDdb();
    const {handler}=makeHandler({kp, ddb});
    ddb.store.set("USER#mod-1|PROFILE", {PK:"USER#mod-1", SK:"PROFILE", sub:"mod-1", role:"moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok=createToken(basePayload({sub:"mod-1"}), kp.privateKey);
    const {id} = await createNeed(handler, { name:"Secret Person", district:"Gorkha", ward:6, category:"goods", beneficiary:{ phone:"+9779800000011", householdSize:5 }});
    // need already has householdSize etc stored
    const {claimCode} = await publishNeed(handler, modTok, id);
    await handler(makeEvent({method:"POST", path:`/claims/${claimCode}/redeem`, headers:{authorization:`Bearer ${modTok}`}, body:{}}));
    // ledger
    let res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha", ward:"6"}}));
    let body = JSON.parse(res.body);
    const ledgerStr = JSON.stringify(body.items);
    assert.equal(ledgerStr.includes("householdSize"), false);
    assert.equal(ledgerStr.includes("9800000011"), false);
    assert.equal(ledgerStr.includes("Secret Person"), false); // full name not leaked, only masked
    assert.equal(ledgerStr.includes("registrant"), false);
    for(const it of body.items){
      assert.equal("householdSize" in it, false);
      assert.equal("phone" in it, false);
      assert.equal("registrant" in it, false);
      assert.equal("description" in it, false);
    }
    res = await handler(makeEvent({method:"GET", path:"/ledger", queryStringParameters:{district:"Gorkha", ward:"6", format:"csv"}}));
    assert.equal(res.body.includes("householdSize"), false);
    assert.equal(res.body.includes("9800000011"), false);
    // print
    const {id:id2} = await createNeed(handler, { name:"Another Secret", district:"Gorkha", ward:8, category:"medical", beneficiary:{ phone:"+9779800000099", householdSize:3 }});
    await publishNeed(handler, modTok, id2);
    res = await handler(makeEvent({method:"GET", path:"/claims/print", headers:{authorization:`Bearer ${modTok}`}, queryStringParameters:{district:"Gorkha", ward:"8"}}));
    const printItems = JSON.parse(res.body).items;
    const printStr = JSON.stringify(printItems);
    assert.equal(printStr.includes("householdSize"), false);
    assert.equal(printStr.includes("9800000099"), false);
    assert.equal(printStr.includes("registrant"), false);
    for(const it of printItems){
      assert.deepEqual(Object.keys(it).sort(), ["category","claimCode","maskedName","status","ward"]);
    }
  });
});
