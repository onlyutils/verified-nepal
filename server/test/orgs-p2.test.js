import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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

describe("orgs Phase2", () => {
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
    const queryStringParameters = query || undefined;
    let rawPath = path;
    if (query && Object.keys(query).length) {
      const qs = new URLSearchParams(query).toString();
      rawPath = `${path}?${qs}`;
    }
    const event = makeEvent({ method, path: rawPath, headers, body, queryStringParameters });
    const res = await routeFn(method, path, event, opts);
    if (!res) return { status: 404, body: { error: "Not Found" }, raw: res };
    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch (_) { parsed = res.body; }
    return { status: res.statusCode, body: parsed, raw: res };
  }

  async function setupOrgWithTwoCentersAndStock(fake, kp, opts, ownerToken) {
    // create org
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token: ownerToken }, opts);
    assert.equal(orgRes.status, 201);
    const orgId = orgRes.body.id;
    // center A
    const aRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody({ name: "Center A" }), token: ownerToken }, opts);
    assert.equal(aRes.status, 201);
    const aId = aRes.body.id;
    // center B
    const bRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody({ name: "Center B" }), token: ownerToken }, opts);
    assert.equal(bRes.status, 201);
    const bId = bRes.body.id;
    // seed stock with intake 100 rice at A
    const intake = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "intake", category: "rice", qty: 100 }, token: ownerToken }, opts);
    assert.equal(intake.status, 201);
    return { orgId, aId, bId };
  }

  it("1. transfer_out to center B creates entry, inbound, transfer meta, stock checks and validations", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "owner-1";
    seedUser(fake, sub, "helper", "owner@example.com");
    const token = createToken(basePayload({ sub, email: "owner@example.com", name: "Owner" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId, bId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, token);

    // successful transfer 50 rice from A to B
    const tr = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 50, destinationType: "center", destinationCenterId: bId }, token }, opts);
    assert.equal(tr.status, 201);
    assert.ok(tr.body.id);
    assert.ok(tr.body.transferId);
    const transferId = tr.body.transferId;
    const entryId = tr.body.id;

    // A's entry delta -qty, transferStatus in_transit
    // fetch entry via GOODS partition? We can check store directly via ENTRY pointer
    const ptr = fake.store.get(`ENTRY#${entryId}|META`);
    assert.ok(ptr);
    const goodsKey = `GOODS#${aId}|${ptr.SKref}`;
    // Find GOODS entry by scanning store for PK GOODS#A and matching id
    const goodsItem = Array.from(fake.store.values()).find((v) => v.id === entryId && v.PK === `GOODS#${aId}`);
    assert.ok(goodsItem);
    assert.equal(goodsItem.delta, -50);
    assert.equal(goodsItem.transferStatus, "in_transit");
    assert.equal(goodsItem.transferId, transferId);
    assert.equal(goodsItem.destinationCenterId, bId);

    // INBOUND pointer exists at CENTER#B
    const inbound = fake.store.get(`CENTER#${bId}|INBOUND#${transferId}`);
    assert.ok(inbound);
    assert.equal(inbound.fromCenterId, aId);
    assert.equal(inbound.qty, 50);

    // TRANSFER META exists
    const meta = fake.store.get(`TRANSFER#${transferId}|META`);
    assert.ok(meta);
    assert.equal(meta.fromCenterId, aId);
    assert.equal(meta.toCenterId, bId);
    assert.equal(meta.qty, 50);

    // A stock decreased (100 intake -50 =50)
    const stockRes = await call(routeOrgs, "GET", `/centers/${aId}/stock`, {}, opts);
    assert.equal(stockRes.status, 200);
    const riceStock = stockRes.body.items.find((s) => s.category === "rice");
    assert.ok(riceStock);
    assert.equal(riceStock.qty, 50);

    // B stock unchanged (no rice)
    const stockB = await call(routeOrgs, "GET", `/centers/${bId}/stock`, {}, opts);
    assert.equal(stockB.status, 200);
    const riceB = stockB.body.items.find((s) => s.category === "rice");
    assert.equal(riceB, undefined);

    // destination = A itself → 400
    let res = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 5, destinationType: "center", destinationCenterId: aId }, token }, opts);
    assert.equal(res.status, 400);

    // destination closed/hidden → 400
    // create a closed center C
    const cRes = await call(routeOrgs, "POST", `/orgs/${(await call(routeOrgs, "GET", "/orgs/mine", { token }, opts)).body.items[0].id}/centers`, { body: validCenterBody({ name: "Closed Center" }), token }, opts);
    const cId = cRes.body.id;
    // close it
    const upd = await call(routeOrgs, "POST", `/centers/${cId}`, { body: { status: "closed" }, token }, opts);
    assert.equal(upd.status, 200);
    res = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 5, destinationType: "center", destinationCenterId: cId }, token }, opts);
    assert.equal(res.status, 400);

    // external without destinationLabel → 400
    res = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 5, destinationType: "external" }, token }, opts);
    assert.equal(res.status, 400);

    // insufficient stock → 400
    res = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 200, destinationType: "external", destinationLabel: "Outside" }, token }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /insufficient stock/);
  });

  it("2. GET inbound lists for member, 403 for different org member", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const owner = "owner-1";
    const other = "other-1";
    seedUser(fake, owner, "helper", "owner@example.com");
    seedUser(fake, other, "helper", "other@example.com");
    const tokenOwner = createToken(basePayload({ sub: owner, email: "owner@example.com" }), kp.privateKey);
    const tokenOther = createToken(basePayload({ sub: other, email: "other@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId, bId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, tokenOwner);
    const tr = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 20, destinationType: "center", destinationCenterId: bId }, token: tokenOwner }, opts);
    assert.equal(tr.status, 201);
    // create other org for other user
    const otherOrg = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Other Org" }), token: tokenOther }, opts);
    assert.equal(otherOrg.status, 201);

    const inboundOwner = await call(routeOrgs, "GET", `/centers/${bId}/inbound`, { token: tokenOwner }, opts);
    assert.equal(inboundOwner.status, 200);
    assert.ok(Array.isArray(inboundOwner.body.items));
    assert.equal(inboundOwner.body.items.length, 1);
    assert.equal(inboundOwner.body.items[0].transferId, tr.body.transferId);

    const inboundOther = await call(routeOrgs, "GET", `/centers/${bId}/inbound`, { token: tokenOther }, opts);
    assert.equal(inboundOther.status, 403);
  });

  it("3. receive with qtyReceived, discrepancy, inbound deleted, already received, non-member 403", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const owner = "owner-1";
    const other = "other-1";
    seedUser(fake, owner, "helper", "owner@example.com");
    seedUser(fake, other, "helper", "other@example.com");
    const tokenOwner = createToken(basePayload({ sub: owner, email: "owner@example.com", name: "Owner" }), kp.privateKey);
    const tokenOther = createToken(basePayload({ sub: other, email: "other@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId, bId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, tokenOwner);
    // transfer 50
    const tr = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 50, destinationType: "center", destinationCenterId: bId }, token: tokenOwner }, opts);
    const transferId = tr.body.transferId;
    const srcEntryId = tr.body.id;
    // other creates its own org to be non-member (already seeded)
    await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Other Org" }), token: tokenOther }, opts);

    // receive by B's org member with 45
    const recv = await call(routeOrgs, "POST", `/transfers/${transferId}/receive`, { body: { qtyReceived: 45 }, token: tokenOwner }, opts);
    assert.equal(recv.status, 201);
    assert.ok(recv.body.id);
    const recvId = recv.body.id;
    // B has transfer_in qty 45 delta 45 sourceLabel = A's name
    const destEntry = Array.from(fake.store.values()).find((v) => v.id === recvId);
    assert.ok(destEntry);
    assert.equal(destEntry.entryType, "transfer_in");
    assert.equal(destEntry.qty, 45);
    assert.equal(destEntry.delta, 45);
    assert.equal(destEntry.sourceLabel, "Center A");
    assert.equal(destEntry.transferStatus, "received");
    assert.equal(destEntry.discrepancy, 5);
    // A's entry transferStatus received, qtyReceived 45, discrepancy 5
    const srcEntry = Array.from(fake.store.values()).find((v) => v.id === srcEntryId);
    assert.ok(srcEntry);
    assert.equal(srcEntry.transferStatus, "received");
    assert.equal(srcEntry.qtyReceived, 45);
    assert.equal(srcEntry.discrepancy, 5);
    // INBOUND deleted
    const inbound = fake.store.get(`CENTER#${bId}|INBOUND#${transferId}`);
    assert.equal(inbound, undefined);
    // second receive → 400 already received
    const second = await call(routeOrgs, "POST", `/transfers/${transferId}/receive`, { body: { qtyReceived: 45 }, token: tokenOwner }, opts);
    assert.equal(second.status, 400);
    assert.match(second.body.error, /already received/);
    // receive by non-member → 403 : create new transfer for this test
    const tr2 = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 10, destinationType: "center", destinationCenterId: bId }, token: tokenOwner }, opts);
    assert.equal(tr2.status, 201);
    const recvOther = await call(routeOrgs, "POST", `/transfers/${tr2.body.transferId}/receive`, { body: { qtyReceived: 10 }, token: tokenOther }, opts);
    assert.equal(recvOther.status, 403);
  });

  it("4. external transfer has status sent and no INBOUND", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "owner-1";
    seedUser(fake, sub, "helper", "owner@example.com");
    const token = createToken(basePayload({ sub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, token);
    const ext = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 10, destinationType: "external", destinationLabel: "Village camp" }, token }, opts);
    assert.equal(ext.status, 201);
    assert.ok(ext.body.transferId);
    const item = Array.from(fake.store.values()).find((v) => v.id === ext.body.id);
    assert.equal(item.transferStatus, "sent");
    assert.equal(item.destinationLabel, "Village camp");
    // no inbound anywhere
    const anyInbound = Array.from(fake.store.values()).filter((v) => v.type === "INBOUND");
    assert.equal(anyInbound.length, 0);
    // no transfer inbound pointer stored? meta should have status sent
    const meta = fake.store.get(`TRANSFER#${ext.body.transferId}|META`);
    assert.ok(meta);
    assert.equal(meta.status, "sent");
  });

  it("5. correction of intake, already corrected, cannot correct completed transfer, missing note", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const sub = "owner-1";
    seedUser(fake, sub, "helper", "owner@example.com");
    const token = createToken(basePayload({ sub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId, bId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, token);
    // intake entry id is the seeded intake (100 rice). Find it
    const entriesBefore = await call(routeOrgs, "GET", `/centers/${aId}/entries`, { token }, opts);
    const intake = entriesBefore.body.items.find((e) => e.entryType === "intake");
    assert.ok(intake);
    // correction
    const corr = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "correction", correctsEntryId: intake.id, note: "miscounted, actually 90" }, token }, opts);
    assert.equal(corr.status, 201);
    assert.ok(corr.body.id);
    const corrId = corr.body.id;
    const corrItem = Array.from(fake.store.values()).find((v) => v.id === corrId);
    assert.ok(corrItem);
    assert.equal(corrItem.entryType, "correction");
    assert.equal(corrItem.delta, -intake.delta);
    assert.equal(corrItem.correctsEntryId, intake.id);
    // original has correctedByEntryId
    const origAfter = Array.from(fake.store.values()).find((v) => v.id === intake.id);
    assert.equal(origAfter.correctedByEntryId, corrId);
    // stock reflects: 100 intake + correction -100 =0? Actually delta of intake 100, correction -100 => 0. But we still have later transfers? We haven't transferred. So stock should be 0
    const stockAfter = await call(routeOrgs, "GET", `/centers/${aId}/stock`, {}, opts);
    // intake 100 corrected => 0, plus maybe no other entries
    const riceAfter = stockAfter.body.items.find((s) => s.category === "rice");
    assert.equal(riceAfter, undefined);
    // correcting again → 400 already corrected
    const corrAgain = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "correction", correctsEntryId: intake.id, note: "again" }, token }, opts);
    assert.equal(corrAgain.status, 400);
    assert.match(corrAgain.body.error, /already corrected/);
    // correcting a received transfer_out → 400
    // need to create transfer and receive first, then try correct the transfer_out
    // Re-seed stock for transfer: create new intake 50
    const intake2 = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "intake", category: "rice", qty: 50 }, token }, opts);
    assert.equal(intake2.status, 201);
    const tr = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 20, destinationType: "center", destinationCenterId: bId }, token }, opts);
    assert.equal(tr.status, 201);
    const recv = await call(routeOrgs, "POST", `/transfers/${tr.body.transferId}/receive`, { body: { qtyReceived: 20 }, token }, opts);
    assert.equal(recv.status, 201);
    const corrTransfer = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "correction", correctsEntryId: tr.body.id, note: "try correct transfer" }, token }, opts);
    assert.equal(corrTransfer.status, 400);
    assert.match(corrTransfer.body.error, /cannot correct a completed transfer/);
    // missing note → 400
    const missingNote = await call(routeOrgs, "POST", `/centers/${aId}/entries`, { body: { entryType: "correction", correctsEntryId: intake2.body.id }, token }, opts);
    assert.equal(missingNote.status, 400);
  });

  it("6. flag center closed, flagCount, moderation list, invalid reason, hidden 404", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const owner = "owner-1";
    const mod = "mod-1";
    seedUser(fake, owner, "helper", "owner@example.com");
    seedUser(fake, mod, "moderator", "mod@example.com");
    const tokenOwner = createToken(basePayload({ sub: owner, email: "owner@example.com" }), kp.privateKey);
    const tokenMod = createToken(basePayload({ sub: mod, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { aId } = await setupOrgWithTwoCentersAndStock(fake, kp, opts, tokenOwner);
    // flag reason closed
    const flag = await call(routeOrgs, "POST", `/centers/${aId}/flag`, { body: { reason: "closed" } }, opts);
    assert.equal(flag.status, 201);
    assert.deepEqual(flag.body, { ok: true });
    // center flagCount 1
    const centerItem = fake.store.get(`CENTER#${aId}|META`);
    assert.equal(centerItem.flagCount, 1);
    // GET /moderation/center-flags as moderator lists A
    const flags = await call(routeOrgs, "GET", "/moderation/center-flags", { token: tokenMod }, opts);
    assert.equal(flags.status, 200);
    const found = flags.body.items.find((it) => it.centerId === aId);
    assert.ok(found);
    assert.equal(found.flagCount, 1);
    assert.ok(found.reasons.some((r) => r.reason === "closed"));
    // invalid reason → 400
    const bad = await call(routeOrgs, "POST", `/centers/${aId}/flag`, { body: { reason: "invalid" } }, opts);
    assert.equal(bad.status, 400);
    // flag on hidden center → 404 : close center and try flag
    await call(routeOrgs, "POST", `/centers/${aId}`, { body: { status: "closed" }, token: tokenOwner }, opts);
    const hiddenFlag = await call(routeOrgs, "POST", `/centers/${aId}/flag`, { body: { reason: "closed" } }, opts);
    assert.equal(hiddenFlag.status, 404);
  });

  it("7. vouch flows and tier vouched verification", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerV = "owner-v";
    const ownerP = "owner-p";
    const ownerQ = "owner-q";
    const mod = "mod-1";
    seedUser(fake, ownerV, "helper", "v@example.com");
    seedUser(fake, ownerP, "helper", "p@example.com");
    seedUser(fake, ownerQ, "helper", "q@example.com");
    seedUser(fake, mod, "moderator", "mod@example.com");
    const tokenV = createToken(basePayload({ sub: ownerV, email: "v@example.com" }), kp.privateKey);
    const tokenP = createToken(basePayload({ sub: ownerP, email: "p@example.com" }), kp.privateKey);
    const tokenQ = createToken(basePayload({ sub: ownerQ, email: "q@example.com" }), kp.privateKey);
    const tokenMod = createToken(basePayload({ sub: mod, email: "mod@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    // org V pending
    const orgVRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Org V" }), token: tokenV }, opts);
    const orgVId = orgVRes.body.id;
    // verify V via moderator
    const verV = await call(routeOrgs, "POST", `/moderation/orgs/${orgVId}`, { body: { action: "verify", tier: "known", note: "verified org V notes here" }, token: tokenMod }, opts);
    assert.equal(verV.status, 200);
    // org P pending
    const orgPRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Org P" }), token: tokenP }, opts);
    const orgPId = orgPRes.body.id;
    // owner of V vouches for pending org P → {ok:true}
    const vouch1 = await call(routeOrgs, "POST", `/orgs/${orgPId}/vouch`, { body: { voucherOrgId: orgVId }, token: tokenV }, opts);
    assert.equal(vouch1.status, 200);
    assert.deepEqual(vouch1.body, { ok: true });
    const pAfter = fake.store.get(`ORG#${orgPId}|META`);
    assert.equal(pAfter.vouches.length, 1);
    assert.equal(pAfter.vouches[0].orgId, orgVId);
    // second vouch by V → 400 already vouched
    const vouchAgain = await call(routeOrgs, "POST", `/orgs/${orgPId}/vouch`, { body: { voucherOrgId: orgVId }, token: tokenV }, opts);
    assert.equal(vouchAgain.status, 400);
    assert.match(vouchAgain.body.error, /already vouched/);
    // owner of a pending org vouching → 403 (use ownerQ pending org to vouch)
    const orgQRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Org Q" }), token: tokenQ }, opts);
    const orgQId = orgQRes.body.id;
    // ownerP (pending) tries to vouch for Q using its pending org P
    const vouchPending = await call(routeOrgs, "POST", `/orgs/${orgQId}/vouch`, { body: { voucherOrgId: orgPId }, token: tokenP }, opts);
    assert.equal(vouchPending.status, 403);
    // vouch for a verified target → 400 (try vouch for V which is verified)
    const vouchVerified = await call(routeOrgs, "POST", `/orgs/${orgVId}/vouch`, { body: { voucherOrgId: orgVId }, token: tokenV }, opts);
    assert.equal(vouchVerified.status, 400);
    // moderator verify P with tier vouched → verified
    const verP = await call(routeOrgs, "POST", `/moderation/orgs/${orgPId}`, { body: { action: "verify", tier: "vouched", note: "vouched note here" }, token: tokenMod }, opts);
    assert.equal(verP.status, 200);
    assert.equal(fake.store.get(`ORG#${orgPId}|META`).status, "verified");
    // verify another pending org with tier vouched and no vouches → 400 no vouches recorded
    const orgRRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Org R" }), token: tokenQ }, opts);
    const orgRId = orgRRes.body.id;
    const verR = await call(routeOrgs, "POST", `/moderation/orgs/${orgRId}`, { body: { action: "verify", tier: "vouched", note: "no vouch note" }, token: tokenMod }, opts);
    assert.equal(verR.status, 400);
    assert.match(verR.body.error, /no vouches recorded/);
  });
});
