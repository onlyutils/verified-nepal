import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";
import { listMunicipalities } from "../src/lib/adminUnits.js";

const gorkhaMunicipalityId = listMunicipalities("Gorkha")[0].id;

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  seedActiveIncident(ddb, { affectedDistricts: ["Gorkha"] });
  ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", role: "moderator", name: "Moderator", guidelinesAckAt: "now", districts: [] });
  ddb.store.set("ORG#org|META", { PK: "ORG#org", SK: "META", type: "ORG", id: "org", name: "Helping Hands", status: "verified" });
  ddb.store.set("USER#org-member|ORG#org", { PK: "USER#org-member", SK: "ORG#org", type: "ORGMEMBER", orgId: "org", role: "member" });
  const token = (sub, name = sub) => `Bearer ${createToken(basePayload({ sub, name, email: `${sub}@example.com` }), kp.privateKey)}`;
  return { handler, ddb, token, kp };
}

const body = (overrides = {}) => ({
  onBehalf: false,
  beneficiary: { name: "Rita Gurung", district: "Gorkha", municipalityId: gorkhaMunicipalityId, ward: 5, phone: "+9779800000001" },
  category: "goods",
  description: "Need food and blankets for a family after the flood",
  language: "en",
  incidentId: TEST_INCIDENT_ID,
  ...overrides,
});

async function published({ handler, token }, overrides = {}) {
  const created = await handler(makeEvent({ method: "POST", path: "/needs", body: body(overrides) }));
  assert.equal(created.statusCode, 201, created.body);
  const { id } = JSON.parse(created.body);
  const publishedNeed = await handler(makeEvent({ method: "POST", path: `/moderation/${id}`, headers: { authorization: token("mod", "Moderator Person") }, body: { action: "publish" } }));
  assert.equal(publishedNeed.statusCode, 200, publishedNeed.body);
  return { id, claimCode: JSON.parse(publishedNeed.body).claimCode };
}

const call = (handler, method, path, authorization, bodyValue) => handler(makeEvent({ method, path, headers: { authorization }, body: bodyValue }));

describe("individual and group need takes", () => {
  beforeEach(() => clearJwksCache());

  it("takes, limits, releases, protects contact, and audits a helper take", async () => {
    const ctx = setup();
    const first = await published(ctx);
    const second = await published(ctx, { beneficiary: { ...body().beneficiary, name: "Second Helper" } });
    const third = await published(ctx, { beneficiary: { ...body().beneficiary, name: "Third Helper" } });
    const fourth = await published(ctx, { beneficiary: { ...body().beneficiary, name: "Fourth Helper" } });
    const helper = ctx.token("helper", "Helper Person");
    for (const need of [first, second, third]) assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/take`, helper)).statusCode, 200);
    assert.equal((await call(ctx.handler, "POST", `/needs/${fourth.id}/take`, helper)).statusCode, 409);
    assert.ok(ctx.ddb.store.get(`USER#helper|HANDLING#${first.id}`));

    delete ctx.ddb.store.get(`NEED#${first.id}|META`).contactViewedBy;
    const contact = await call(ctx.handler, "GET", `/me/needs/${first.id}/contact`, helper);
    assert.equal(contact.statusCode, 200);
    assert.equal(JSON.parse(contact.body).beneficiary.phone, "+9779800000001");
    assert.equal((await call(ctx.handler, "GET", `/me/needs/${first.id}/contact`, ctx.token("other", "Other Person"))).statusCode, 403);
    await call(ctx.handler, "GET", `/me/needs/${first.id}/contact`, helper);
    assert.equal(Array.from(ctx.ddb.store.values()).filter((item) => item.action === "need.contact_view").length, 1);
    assert.equal((await call(ctx.handler, "POST", `/needs/${first.id}/release`, ctx.token("other"))).statusCode, 409);
    assert.equal((await call(ctx.handler, "POST", `/needs/${first.id}/release`, helper)).statusCode, 200);
    assert.equal(ctx.ddb.store.get(`NEED#${first.id}|META`).status, "published");
    assert.equal(ctx.ddb.store.has(`USER#helper|HANDLING#${first.id}`), false);
    assert.equal(Array.from(ctx.ddb.store.values()).some((item) => item.action === "need.take" && item.actorName === "Helper P."), true);
  });

  it("blocks self-service takes for assignOnly needs and preserves org/helper exclusivity", async () => {
    const ctx = setup();
    const sensitive = await published(ctx, { assignOnly: true });
    const helper = ctx.token("helper", "Helper Person");
    assert.equal((await call(ctx.handler, "POST", `/needs/${sensitive.id}/take`, helper)).statusCode, 403);
    await call(ctx.handler, "POST", `/needs/${sensitive.id}/edit`, ctx.token("mod"), { edits: { assignOnly: false } });
    assert.equal((await call(ctx.handler, "POST", `/needs/${sensitive.id}/take`, helper)).statusCode, 200);
    assert.equal((await call(ctx.handler, "POST", `/orgs/org/needs/${sensitive.id}/claim`, ctx.token("org-member"))).statusCode, 409);
  });

  it("treats absent legacy assignOnly and handledBy fields as false and empty", async () => {
    const ctx = setup();
    const need = await published(ctx);
    const stored = ctx.ddb.store.get(`NEED#${need.id}|META`);
    delete stored.assignOnly;
    delete stored.handledBy;
    const helper = ctx.token("legacy-helper", "Legacy Helper");
    assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/take`, helper)).statusCode, 200);
    assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/deliver`, helper, {})).statusCode, 200);
    assert.equal(ctx.ddb.store.has(`USER#legacy-helper|HANDLING#${need.id}`), false);
  });

  it("lets a group member take and deliver for the group, updates the label, confirms redemption, and grants story eligibility", async () => {
    const ctx = setup();
    const need = await published(ctx);
    const founder = ctx.token("founder", "Founder Person");
    const member = ctx.token("member", "Member Person");
    assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/group`, founder)).statusCode, 201);
    assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/group/join`, member)).statusCode, 200);
    const taken = await call(ctx.handler, "POST", `/needs/${need.id}/group/take`, member);
    assert.equal(taken.statusCode, 200, taken.body);
    assert.equal(JSON.parse(taken.body).handler, "Helper group (2)");
    assert.equal((await call(ctx.handler, "GET", `/me/needs/${need.id}/contact`, founder)).statusCode, 200);
    assert.equal((await call(ctx.handler, "POST", `/needs/${need.id}/group/deliver`, member, { note: "Delivered together" })).statusCode, 200);
    const stored = ctx.ddb.store.get(`NEED#${need.id}|META`);
    assert.equal(stored.deliveredBy.kind, "group");
    assert.equal(stored.status, "fulfilled");
    assert.equal(Array.from(ctx.ddb.store.values()).some((item) => item.action === "need.deliver"), true);
    const redeemed = await call(ctx.handler, "POST", `/claims/${stored.claimCode}/redeem`, ctx.token("mod"), {});
    assert.equal(redeemed.statusCode, 200, redeemed.body);
    assert.equal(JSON.parse(redeemed.body).status, "confirmed");
    assert.ok(ctx.ddb.store.get(`LEDGER#Gorkha#5|${stored.redeemedAt}#${need.id}`).confirmedAt);
    const story = await call(ctx.handler, "POST", "/me/stories", member, { caption: "We delivered the supplies.", media: { type: "photo", fileId: "f1", url: "https://cdn.example/f1.jpg" } });
    assert.equal(story.statusCode, 201, story.body);
  });

  it("records beneficiary confirmation when the claim is redeemed before group delivery", async () => {
    const ctx = setup();
    const need = await published(ctx);
    const founder = ctx.token("founder", "Founder Person");
    await call(ctx.handler, "POST", `/needs/${need.id}/group`, founder);
    await call(ctx.handler, "POST", `/needs/${need.id}/group/take`, founder);
    const claimRedeemed = await call(ctx.handler, "POST", `/claims/${ctx.ddb.store.get(`NEED#${need.id}|META`).claimCode}/redeem`, ctx.token("mod"), {});
    assert.equal(claimRedeemed.statusCode, 200, claimRedeemed.body);
    const delivered = await call(ctx.handler, "POST", `/needs/${need.id}/group/deliver`, founder);
    assert.equal(delivered.statusCode, 200, delivered.body);
    const stored = ctx.ddb.store.get(`NEED#${need.id}|META`);
    assert.equal(ctx.ddb.store.get(`LEDGER#Gorkha#5|${stored.redeemedAt}#${need.id}`).confirmedAt, JSON.parse(claimRedeemed.body).redeemedAt);
  });
});
