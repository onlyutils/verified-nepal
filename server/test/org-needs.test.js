import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", role: "moderator", name: "Mod", guidelinesAckAt: "now", districts: [] });
  ddb.store.set("ORG#o1|META", { PK: "ORG#o1", SK: "META", type: "ORG", id: "o1", name: "Helping Hands", status: "verified", districts: ["Gorkha"] });
  ddb.store.set("USER#member|ORG#o1", { PK: "USER#member", SK: "ORG#o1", type: "ORGMEMBER", orgId: "o1", role: "member" });
  ddb.store.set("ORG#o2|META", { PK: "ORG#o2", SK: "META", type: "ORG", id: "o2", name: "Pending Org", status: "pending", districts: ["Gorkha"] });
  ddb.store.set("USER#pend|ORG#o2", { PK: "USER#pend", SK: "ORG#o2", type: "ORGMEMBER", orgId: "o2", role: "owner" });
  return { handler, ddb, kp };
}
const tok = (kp, sub) => `Bearer ${createToken(basePayload({ sub, name: "Person", email: `${sub}@example.com` }), kp.privateKey)}`;
const post = (h, kp, sub, path, body) => h(makeEvent({ method: "POST", path, headers: { authorization: tok(kp, sub) }, body }));

async function publishedNeed(handler, kp) {
  const res = await handler(makeEvent({ method: "POST", path: "/needs", body: {
    onBehalf: false, category: "goods", language: "en", description: "Need food and blankets for a family of four after the flood",
    beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5, householdSize: 4, phone: "+9779800000001" },
  } }));
  assert.equal(res.statusCode, 201, res.body);
  const { id } = JSON.parse(res.body);
  assert.equal((await post(handler, kp, "mod-1", `/moderation/${id}`, { action: "publish" })).statusCode, 200);
  return id;
}

describe("organizations handling needs", () => {
  beforeEach(() => clearJwksCache());

  it("only members of a verified org can take a published need", async () => {
    const { handler, kp } = setup();
    const id = await publishedNeed(handler, kp);
    assert.equal((await post(handler, kp, "stranger", `/orgs/o1/needs/${id}/claim`)).statusCode, 403);
    const pending = await post(handler, kp, "pend", `/orgs/o2/needs/${id}/claim`);
    assert.equal(pending.statusCode, 403);
    assert.equal(JSON.parse(pending.body).error, "org_not_verified");
    assert.equal((await post(handler, kp, "member", `/orgs/o1/needs/nope/claim`)).statusCode, 404);
  });

  it("claim → matched with contact and public 'handled by'; release puts it back; second claim conflicts", async () => {
    const { handler, ddb, kp } = setup();
    const id = await publishedNeed(handler, kp);
    const claim = await post(handler, kp, "member", `/orgs/o1/needs/${id}/claim`);
    assert.equal(claim.statusCode, 200, claim.body);
    const c = JSON.parse(claim.body);
    assert.equal(c.beneficiary.phone, "+9779800000001");
    assert.equal(c.status, "matched");
    assert.equal(ddb.store.get(`ORG#o1|NEED#${id}`).status, "matched");
    assert.equal((await post(handler, kp, "member", `/orgs/o1/needs/${id}/claim`)).statusCode, 409);

    const pub = await handler(makeEvent({ method: "GET", path: "/needs", queryStringParameters: { district: "Gorkha" } }));
    const item = JSON.parse(pub.body).items.find((n) => n.id === id);
    assert.equal(item.status, "matched");
    assert.equal(item.handledBy, "Helping Hands");
    assert.equal(item.beneficiary, undefined);
    const status = await handler(makeEvent({ method: "GET", path: `/status/${ddb.store.get(`NEED#${id}|META`).refCode}` }));
    assert.equal(JSON.parse(status.body).handledBy, "Helping Hands");

    const mine = await handler(makeEvent({ method: "GET", path: "/orgs/o1/needs", headers: { authorization: tok(kp, "member") } }));
    assert.equal(JSON.parse(mine.body).items[0].beneficiary.name, "Rita Gurung");
    assert.equal((await handler(makeEvent({ method: "GET", path: "/orgs/o1/needs", headers: { authorization: tok(kp, "stranger") } }))).statusCode, 403);

    assert.equal((await post(handler, kp, "member", `/orgs/o1/needs/${id}/release`)).statusCode, 200);
    assert.equal(ddb.store.get(`NEED#${id}|META`).status, "published");
    assert.equal(ddb.store.get(`NEED#${id}|META`).handledBy, undefined);
    assert.equal(ddb.store.has(`ORG#o1|NEED#${id}`), false);
    assert.equal((await post(handler, kp, "member", `/orgs/o1/needs/${id}/release`)).statusCode, 409);
  });

  it("deliver → fulfilled with ledger rows naming the org, audit, contact hidden afterwards, and the org may tell a story", async () => {
    const { handler, ddb, kp } = setup();
    const id = await publishedNeed(handler, kp);
    assert.equal((await post(handler, kp, "member", `/orgs/o1/needs/${id}/deliver`)).statusCode, 409);
    await post(handler, kp, "member", `/orgs/o1/needs/${id}/claim`);
    const del = await post(handler, kp, "member", `/orgs/o1/needs/${id}/deliver`, { note: "Delivered at the school" });
    assert.equal(del.statusCode, 200, del.body);
    const need = ddb.store.get(`NEED#${id}|META`);
    assert.equal(need.status, "fulfilled");
    assert.equal(need.gsi2pk, "NEED#fulfilled");
    const ledger = await handler(makeEvent({ method: "GET", path: "/ledger", queryStringParameters: { district: "Gorkha", ward: "5" } }));
    const row = JSON.parse(ledger.body).items[0];
    assert.equal(row.orgName, "Helping Hands");
    assert.equal(row.maskedName.includes("Gurung"), false);
    const csv = await handler(makeEvent({ method: "GET", path: "/ledger", queryStringParameters: { district: "Gorkha", format: "csv" } }));
    assert.match(csv.body, /Helping Hands/);
    assert.ok([...ddb.store.values()].some((it) => it.type === "AUDIT" && it.action === "redeem" && it.reason === "org:Helping Hands"));

    const mine = await handler(makeEvent({ method: "GET", path: "/orgs/o1/needs", headers: { authorization: tok(kp, "member") } }));
    const done = JSON.parse(mine.body).items[0];
    assert.equal(done.status, "fulfilled");
    assert.equal(done.beneficiary.phone, null);
    assert.notEqual(done.beneficiary.name, "Rita Gurung");

    // moderator redeem of the same code reports already redeemed rather than double-counting
    const redeem = await post(handler, kp, "mod-1", `/claims/${need.claimCode}/redeem`, {});
    assert.equal(redeem.statusCode, 409);

    const dash = await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: { authorization: tok(kp, "member") } }));
    assert.equal(JSON.parse(dash.body).storyRole, "org");
  });
});
