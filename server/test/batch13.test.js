import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { needTimeline } from "../src/views/need-timeline.js";
import { toLedgerItem } from "../src/views/ledger.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  seedActiveIncident(ddb, { affectedDistricts: ["Gorkha"] });
  ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", role: "moderator", name: "Moderator", guidelinesAckAt: "now", districts: [] });
  ddb.store.set("ORG#o1|META", { PK: "ORG#o1", SK: "META", type: "ORG", id: "o1", name: "Helping Hands", status: "verified" });
  ddb.store.set("USER#org-member|ORG#o1", { PK: "USER#org-member", SK: "ORG#o1", type: "ORGMEMBER", orgId: "o1", role: "member" });
  const center = { PK: "CENTER#c1", SK: "META", type: "CENTER", id: "c1", name: "Gorkha Hub", orgId: "o1", orgName: "Helping Hands", orgStatus: "verified", district: "Gorkha", address: "Main road", contactPhone: "9800000000", accepts: ["rice"], status: "open", visibility: "public", createdAt: "2026-01-01T00:00:00.000Z" };
  ddb.store.set("CENTER#c1|META", center);
  ddb.store.set("ORG#o1|CENTER#c1", { PK: "ORG#o1", SK: "CENTER#c1", type: "ORGCENTER", centerId: "c1", orgId: "o1" });
  const token = (sub, name = sub) => `Bearer ${createToken(basePayload({ sub, name, email: `${sub}@example.com` }), kp.privateKey)}`;
  return { handler, ddb, token };
}

async function published(ctx) {
  const created = await ctx.handler(makeEvent({ method: "POST", path: "/needs", body: { onBehalf: false, beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5, phone: "+9779800000001" }, category: "goods", description: "Need food and blankets for a family after the flood", language: "en", incidentId: TEST_INCIDENT_ID } }));
  assert.equal(created.statusCode, 201, created.body);
  const id = JSON.parse(created.body).id;
  const publishedResponse = await ctx.handler(makeEvent({ method: "POST", path: `/moderation/${id}`, headers: { authorization: ctx.token("mod") }, body: { action: "publish" } }));
  assert.equal(publishedResponse.statusCode, 200, publishedResponse.body);
  return id;
}

const call = (ctx, method, path, sub, body) => ctx.handler(makeEvent({ method, path, headers: sub ? { authorization: ctx.token(sub) } : {}, body }));

describe("batch 13 group drop-center delivery", () => {
  it("links signed-in group donations, requires membership, and hands received goods over once", async () => {
    clearJwksCache();
    const ctx = setup();
    const needId = await published(ctx);
    const anonymous = await call(ctx, "POST", "/centers/c1/donations", undefined, { category: "rice", qty: 1 });
    assert.equal(anonymous.statusCode, 201, anonymous.body);
    const anonymousRef = JSON.parse(anonymous.body).ref;
    const anonymousDonation = ctx.ddb.store.get(`DONATION#${anonymousRef}|META`);
    assert.equal(anonymousDonation.needId, undefined);
    assert.equal(anonymousDonation.donorSub, undefined);
    const group = await call(ctx, "POST", `/needs/${needId}/group`, "founder");
    assert.equal(group.statusCode, 201, group.body);
    const beforeTake = ctx.ddb.store.get(`NEED#${needId}|META`).updatedAt;
    assert.equal((await call(ctx, "POST", `/needs/${needId}/group/join`, "member")).statusCode, 200);
    assert.equal((await call(ctx, "POST", `/needs/${needId}/group/take`, "member")).statusCode, 200);
    const afterTake = ctx.ddb.store.get(`NEED#${needId}|META`).updatedAt;
    assert.ok(afterTake > beforeTake);
    const denied = await call(ctx, "POST", "/centers/c1/donations", "stranger", { category: "rice", qty: 4, needId });
    assert.equal(denied.statusCode, 403);
    const linked = await call(ctx, "POST", "/centers/c1/donations", "member", { category: "rice", qty: 4, needId });
    assert.equal(linked.statusCode, 201, linked.body);
    const ref = JSON.parse(linked.body).ref;
    const donation = ctx.ddb.store.get(`DONATION#${ref}|META`);
    assert.equal(donation.donorSub, "member");
    assert.equal(donation.groupId, needId);
    assert.ok(ctx.ddb.store.get(`USER#founder|DONATION#${ref}`));
    assert.ok(ctx.ddb.store.get(`USER#member|DONATION#${ref}`));
    const before = await call(ctx, "POST", `/orgs/o1/needs/${needId}/deliver`, "org-member", {});
    assert.equal(before.statusCode, 409);
    assert.equal((await call(ctx, "POST", `/donations/${ref}/confirm`, "org-member", {})).statusCode, 201);
    assert.ok(ctx.ddb.store.get(`NEED#${needId}|META`).updatedAt > afterTake);
    const delivered = await call(ctx, "POST", `/orgs/o1/needs/${needId}/deliver`, "org-member", {});
    assert.equal(delivered.statusCode, 200, delivered.body);
    const need = ctx.ddb.store.get(`NEED#${needId}|META`);
    assert.equal(need.deliveredBy.via.centerName, "Gorkha Hub");
    const distribution = [...ctx.ddb.store.values()].find((item) => item.type === "GOODS" && item.entryType === "distribution");
    assert.equal(distribution.needId, needId);
    const ledger = await ctx.handler(makeEvent({ method: "GET", path: "/ledger", queryStringParameters: { district: "Gorkha" } }));
    assert.equal(JSON.parse(ledger.body).items[0].deliveredBy.label, "Helper group (2) via Gorkha Hub");
    assert.equal((await call(ctx, "POST", `/orgs/o1/needs/${needId}/deliver`, "org-member", {})).statusCode, 409);
  });

  it("orders timeline steps without exposing claim or contact fields", () => {
    const steps = needTimeline({ handledBy: { at: "2026-01-01T01:00:00.000Z" }, deliveredBy: { kind: "group", label: "Helper group (2)" }, redeemedAt: "2026-01-01T05:00:00.000Z", confirmedAt: "2026-01-01T06:00:00.000Z" }, { donation: { declaredAt: "2026-01-01T02:00:00.000Z", receivedAt: "2026-01-01T03:00:00.000Z" } });
    assert.deepEqual(steps.map((step) => step.key), ["taken", "declared", "received", "handed_over", "confirmed"]);
    const row = toLedgerItem({ maskedName: "Rita G.", category: "goods", district: "Gorkha", ward: 5, redeemedAt: "2026-01-01T05:00:00.000Z", deliveredBy: { kind: "group", label: "Helper group (2)", via: { centerName: "Gorkha Hub" } }, claimCode: "SECRET" });
    assert.equal(row.deliveredBy.label, "Helper group (2) via Gorkha Hub");
    assert.equal(row.claimCode, undefined);
  });
});
