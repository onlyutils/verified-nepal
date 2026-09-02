import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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
  if (email) item.email = email;
  fake.store.set(fake.key(item.PK, item.SK), JSON.parse(JSON.stringify(item)));
  // also write EMAIL pointer for those seeded users (except for vol to test invite without pointer)
  // For staff, the task says seed EMAIL#staff@example.com/META {sub:"staff-sub"} + USER staff-sub
  // We will let the test seed the pointer explicitly where needed, but also seed here for owner convenience
  // Do not auto-create pointer for every user here beyond PROFILE; the invite logic checks EMAIL pointer
  // For staff we will manually add pointer in tests that need it
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

describe("orgs Phase3", () => {
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

  async function setupOrgAndCenter(fake, kp, opts, ownerToken) {
    const orgRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody(), token: ownerToken }, opts);
    assert.equal(orgRes.status, 201);
    const orgId = orgRes.body.id;
    const cRes = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token: ownerToken }, opts);
    assert.equal(cRes.status, 201);
    const centerId = cRes.body.id;
    return { orgId, centerId };
  }

  it("1. invites: vol invited, staff member, duplicate 400, staff 403, last owner 400", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com", name: "Owner" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);

    // invite vol@example.com (no EMAIL pointer) -> invited
    let res = await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "vol@example.com" }, token: ownerToken }, opts);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "invited");
    // GET members lists invited
    let list = await call(routeOrgs, "GET", `/orgs/${orgId}/members`, { token: ownerToken }, opts);
    assert.equal(list.status, 200);
    const volInv = list.body.items.find((it) => it.email === "vol@example.com");
    assert.ok(volInv);
    assert.equal(volInv.status, "invited");
    assert.equal(volInv.role, "staff");
    // inviting again -> 400 already invited
    res = await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "vol@example.com" }, token: ownerToken }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already invited/);

    // seed staff pointer and user
    const staffSub = "staff-sub";
    seedUser(fake, staffSub, "helper", "staff@example.com");
    fake.store.set(fake.key("EMAIL#staff@example.com", "META"), { PK: "EMAIL#staff@example.com", SK: "META", type: "EMAIL", sub: staffSub, email: "staff@example.com", createdAt: new Date().toISOString() });

    res = await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "staff@example.com" }, token: ownerToken }, opts);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "invited");
    // no membership until the invitee accepts (consent)
    assert.equal(fake.store.get(`USER#${staffSub}|ORG#${orgId}`), undefined);
    const staffToken = createToken(basePayload({ sub: staffSub, email: "staff@example.com", name: "Staff" }), kp.privateKey);
    let acc = await call(routeOrgs, "POST", `/orgs/${orgId}/accept-invite`, { token: staffToken }, opts);
    assert.equal(acc.status, 200);
    const memUser = fake.store.get(`USER#${staffSub}|ORG#${orgId}`);
    assert.ok(memUser);
    assert.equal(memUser.role, "staff");
    const memOrg = fake.store.get(`ORG#${orgId}|MEMBER#${staffSub}`);
    assert.ok(memOrg);
    assert.equal(memOrg.role, "staff");

    res = await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "another@example.com" }, token: staffToken }, opts);
    assert.equal(res.status, 403);

    // owner removing themselves -> 400 last owner
    res = await call(routeOrgs, "DELETE", `/orgs/${orgId}/members/${ownerSub}`, { token: ownerToken }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /cannot remove the last owner/);
  });

  it("2. invite is listed on /orgs/mine and accepted explicitly", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);
    await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "vol@example.com" }, token: ownerToken }, opts);

    const volSub = "vol-sub";
    seedUser(fake, volSub, "helper", "vol@example.com");
    const volToken = createToken(basePayload({ sub: volSub, email: "vol@example.com" }), kp.privateKey);
    // mine lists the pending invite but does NOT auto-join
    let mine = await call(routeOrgs, "GET", "/orgs/mine", { token: volToken }, opts);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.find((it) => it.id === orgId), undefined);
    assert.ok((mine.body.invites || []).some((iv) => iv.orgId === orgId));
    assert.equal(fake.store.get(`USER#${volSub}|ORG#${orgId}`), undefined);
    // explicit accept -> becomes a member, invite cleared
    const acc = await call(routeOrgs, "POST", `/orgs/${orgId}/accept-invite`, { token: volToken }, opts);
    assert.equal(acc.status, 200);
    const mem = fake.store.get(`USER#${volSub}|ORG#${orgId}`);
    assert.ok(mem);
    assert.equal(fake.store.get(`ORG#${orgId}|INVITE#vol@example.com`), undefined);
    // now mine lists the org once, no lingering invite
    mine = await call(routeOrgs, "GET", "/orgs/mine", { token: volToken }, opts);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.filter((it) => it.id === orgId).length, 1);
    assert.equal((mine.body.invites || []).some((iv) => iv.orgId === orgId), false);
  });

  it("3. staff permissions: can create entries, cannot update org/create center/vouch", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId, centerId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);
    // invite staff directly via pointer
    const staffSub = "staff-sub";
    seedUser(fake, staffSub, "helper", "staff@example.com");
    fake.store.set(fake.key("EMAIL#staff@example.com", "META"), { PK: "EMAIL#staff@example.com", SK: "META", type: "EMAIL", sub: staffSub, email: "staff@example.com", createdAt: new Date().toISOString() });
    let res = await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "staff@example.com" }, token: ownerToken }, opts);
    assert.equal(res.status, 201);
    const staffToken = createToken(basePayload({ sub: staffSub, email: "staff@example.com" }), kp.privateKey);
    await call(routeOrgs, "POST", `/orgs/${orgId}/accept-invite`, { token: staffToken }, opts);
    // staff can POST entries intake -> 201
    res = await call(routeOrgs, "POST", `/centers/${centerId}/entries`, { body: { entryType: "intake", category: "rice", qty: 10 }, token: staffToken }, opts);
    assert.equal(res.status, 201);
    // staff POST /orgs/{id} -> 403
    res = await call(routeOrgs, "POST", `/orgs/${orgId}`, { body: { name: "New Name" }, token: staffToken }, opts);
    assert.equal(res.status, 403);
    // staff POST /orgs/{id}/centers -> 403
    res = await call(routeOrgs, "POST", `/orgs/${orgId}/centers`, { body: validCenterBody(), token: staffToken }, opts);
    assert.equal(res.status, 403);
    // need a verified org for vouch test: make org verified then try vouch as staff
    // Create a pending target org
    const otherOwner = "other-owner";
    seedUser(fake, otherOwner, "helper", "other@example.com");
    const otherToken = createToken(basePayload({ sub: otherOwner, email: "other@example.com" }), kp.privateKey);
    const pendingRes = await call(routeOrgs, "POST", "/orgs", { body: validOrgBody({ name: "Pending Org" }), token: otherToken }, opts);
    const pendingId = pendingRes.body.id;
    // staff tries to vouch
    res = await call(routeOrgs, "POST", `/orgs/${pendingId}/vouch`, { body: { voucherOrgId: orgId }, token: staffToken }, opts);
    assert.equal(res.status, 403);
  });

  it("4. DELETE members removes membership and invite", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId, centerId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);
    const staffSub = "staff-sub";
    seedUser(fake, staffSub, "helper", "staff@example.com");
    fake.store.set(fake.key("EMAIL#staff@example.com", "META"), { PK: "EMAIL#staff@example.com", SK: "META", type: "EMAIL", sub: staffSub, email: "staff@example.com", createdAt: new Date().toISOString() });
    await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "staff@example.com" }, token: ownerToken }, opts);
    const staffToken = createToken(basePayload({ sub: staffSub, email: "staff@example.com" }), kp.privateKey);
    await call(routeOrgs, "POST", `/orgs/${orgId}/accept-invite`, { token: staffToken }, opts);
    // also invite vol
    await call(routeOrgs, "POST", `/orgs/${orgId}/members`, { body: { email: "vol@example.com" }, token: ownerToken }, opts);
    // owner deletes staff-sub
    let res = await call(routeOrgs, "DELETE", `/orgs/${orgId}/members/${staffSub}`, { token: ownerToken }, opts);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    // staff POST entries afterwards ->403
    res = await call(routeOrgs, "POST", `/centers/${centerId}/entries`, { body: { entryType: "intake", category: "rice", qty: 5 }, token: staffToken }, opts);
    assert.equal(res.status, 403);
    // DELETE invite email -> ok
    res = await call(routeOrgs, "DELETE", `/orgs/${orgId}/members/vol@example.com`, { token: ownerToken }, opts);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    const inv = fake.store.get(`ORG#${orgId}|INVITE#vol@example.com`);
    assert.equal(inv, undefined);
    // unknown ->404
    res = await call(routeOrgs, "DELETE", `/orgs/${orgId}/members/unknown@example.com`, { token: ownerToken }, opts);
    assert.equal(res.status, 404);
  });

  it("5. POST /centers/{id}/donations and GET /donations/{ref}", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId, centerId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);

    // POST donation public (no TURNSTILE_SECRET)
    let res = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "rice", qty: 10 } }, opts);
    assert.equal(res.status, 201);
    assert.ok(res.body.ref);
    assert.equal(res.body.ref.length, 12);
    const ref = res.body.ref;

    // GET donation -> declared with center summary and no sub/email fields
    res = await call(routeOrgs, "GET", `/donations/${ref}`, {}, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.ref, ref);
    assert.equal(res.body.category, "rice");
    assert.equal(res.body.unit, "kg");
    assert.equal(res.body.qty, 10);
    assert.equal(res.body.status, "declared");
    assert.ok(res.body.center);
    assert.equal(res.body.center.id, centerId);
    assert.ok(res.body.center.name);
    assert.equal(res.body.center.district, "Rasuwa");
    assert.ok(res.body.declaredAt);
    assert.ok(!("createdBy" in res.body));
    assert.ok(!("email" in res.body));
    assert.ok(!("sub" in res.body));
    assert.ok(!("orgId" in res.body));
    // Ensure no createdBy field at top level
    assert.equal(res.body.createdBy, undefined);
    assert.equal(res.body.createdByName, undefined);

    // hidden center ->404
    await call(routeOrgs, "POST", `/centers/${centerId}`, { body: { status: "closed" }, token: ownerToken }, opts);
    res = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "rice", qty: 5 } }, opts);
    assert.equal(res.status, 404);
    // reopen for next test? set back to open
    const ctr = fake.store.get(`CENTER#${centerId}|META`);
    ctr.status = "open";
    ctr.visibility = "public";
    ctr.gsi2pk = "CENTER#public";
    fake.store.set(fake.key(ctr.PK, ctr.SK), ctr);

    // bad category ->400
    res = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "gold", qty: 10 } }, opts);
    assert.equal(res.status, 400);
  });

  it("6. donations list, confirm, sinceReceived, not_received, permissions", async () => {
    const kp = makeKeyPair();
    const fake = new FakeDdb();
    const ownerSub = "owner-1";
    seedUser(fake, ownerSub, "helper", "owner@example.com");
    const ownerToken = createToken(basePayload({ sub: ownerSub, email: "owner@example.com" }), kp.privateKey);
    const opts = buildOpts(fake, kp);
    const { orgId, centerId } = await setupOrgAndCenter(fake, kp, opts, ownerToken);

    // create donation
    let res = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "rice", qty: 10 } }, opts);
    const ref = res.body.ref;
    // member GET /centers/{id}/donations lists it (default declared)
    res = await call(routeOrgs, "GET", `/centers/${centerId}/donations`, { token: ownerToken }, opts);
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((it) => it.ref === ref));

    // confirm
    res = await call(routeOrgs, "POST", `/donations/${ref}/confirm`, { body: {}, token: ownerToken }, opts);
    assert.equal(res.status, 201);
    assert.ok(res.body.entryId);
    const entryId = res.body.entryId;
    // intake entry exists with donationRef and qty 10
    const ptr = fake.store.get(`ENTRY#${entryId}|META`);
    assert.ok(ptr);
    const goodsEntry = Array.from(fake.store.values()).find((v) => v.id === entryId);
    assert.ok(goodsEntry);
    assert.equal(goodsEntry.donationRef, ref);
    assert.equal(goodsEntry.qty, 10);
    assert.equal(goodsEntry.entryType, "intake");

    // GET donation -> received, receivedAt set, sinceReceived {distributed:0, transferred:0}
    res = await call(routeOrgs, "GET", `/donations/${ref}`, {}, opts);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "received");
    assert.ok(res.body.receivedAt);
    assert.deepEqual(res.body.sinceReceived, { distributed: 0, transferred: 0 });

    // after a distribution of 4 rice -> distributed 4
    await call(routeOrgs, "POST", `/centers/${centerId}/entries`, { body: { entryType: "distribution", category: "rice", qty: 4 }, token: ownerToken }, opts);
    res = await call(routeOrgs, "GET", `/donations/${ref}`, {}, opts);
    assert.equal(res.body.sinceReceived.distributed, 4);
    assert.equal(res.body.sinceReceived.transferred, 0);

    // after a transfer_out external of 3 rice -> transferred 3
    const tr = await call(routeOrgs, "POST", `/centers/${centerId}/entries`, { body: { entryType: "transfer_out", category: "rice", qty: 3, destinationType: "external", destinationLabel: "Outside" }, token: ownerToken }, opts);
    assert.equal(tr.status, 201);
    res = await call(routeOrgs, "GET", `/donations/${ref}`, {}, opts);
    assert.equal(res.body.sinceReceived.distributed, 4);
    assert.equal(res.body.sinceReceived.transferred, 3);

    // confirm again ->400
    res = await call(routeOrgs, "POST", `/donations/${ref}/confirm`, { body: {}, token: ownerToken }, opts);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already confirmed/);

    // second donation with not_received
    let res2 = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "rice", qty: 5 } }, opts);
    const ref2 = res2.body.ref;
    res2 = await call(routeOrgs, "POST", `/donations/${ref2}/confirm`, { body: { action: "not_received" }, token: ownerToken }, opts);
    assert.equal(res2.status, 200);
    assert.deepEqual(res2.body, { ok: true });
    let get2 = await call(routeOrgs, "GET", `/donations/${ref2}`, {}, opts);
    assert.equal(get2.status, 200);
    assert.equal(get2.body.status, "not_received");

    // confirm by non-member ->403
    const otherSub = "other-1";
    seedUser(fake, otherSub, "helper", "other@example.com");
    const otherToken = createToken(basePayload({ sub: otherSub, email: "other@example.com" }), kp.privateKey);
    let res3 = await call(routeOrgs, "POST", `/centers/${centerId}/donations`, { body: { category: "rice", qty: 2 } }, opts);
    const ref3 = res3.body.ref;
    res3 = await call(routeOrgs, "POST", `/donations/${ref3}/confirm`, { body: {}, token: otherToken }, opts);
    assert.equal(res3.status, 403);
  });
});
