import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "stories" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  return { handler, ddb, kp };
}
const auth = (kp, sub) => `Bearer ${createToken(basePayload({ sub, name: "Sita", email: `${sub}@example.com` }), kp.privateKey)}`;
const story = { caption: "We got blankets the same night. Thank you.", media: { type: "photo", fileId: "f1", url: "https://cdn.example/f1.jpg" } };
const post = (h, kp, sub, body = story) => h(makeEvent({ method: "POST", path: "/me/stories", headers: { authorization: auth(kp, sub) }, body }));

function seedFulfilledNeed(ddb, sub) {
  ddb.store.set("NEED#n1|META", { PK: "NEED#n1", SK: "META", type: "NEED", id: "n1", status: "fulfilled", category: "goods", beneficiary: { district: "Gorkha", ward: 1 } });
  ddb.store.set(`USER#${sub}|NEED#n1`, { PK: `USER#${sub}`, SK: "NEED#n1", type: "MINE", kind: "NEED", id: "n1", sub, createdAt: "2026-01-01T00:00:00.000Z" });
}
function seedMod(ddb) {
  ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", role: "moderator", name: "Mod", guidelinesAckAt: "now", districts: [] });
}

describe("stories", () => {
  beforeEach(() => clearJwksCache());

  it("rejects a story from someone who has neither received nor given help", async () => {
    const { handler, kp } = setup();
    const res = await post(handler, kp, "nobody");
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "story_not_eligible");
    const dash = await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: { authorization: auth(kp, "nobody") } }));
    assert.equal(JSON.parse(dash.body).storyRole, null);
  });

  it("validates caption and media", async () => {
    const { handler, ddb, kp } = setup();
    seedFulfilledNeed(ddb, "sita");
    assert.equal((await post(handler, kp, "sita", { ...story, caption: "" })).statusCode, 400);
    assert.equal((await post(handler, kp, "sita", { ...story, media: { type: "gif", fileId: "f", url: "https://x/y" } })).statusCode, 400);
    assert.equal((await post(handler, kp, "sita", { ...story, media: { type: "photo", fileId: "f", url: "not a url" } })).statusCode, 400);
  });

  it("needy → pending → moderator publishes → public strip shows it with the role; owner can delete", async () => {
    const { handler, ddb, kp } = setup();
    seedFulfilledNeed(ddb, "sita");
    seedMod(ddb);
    const dash = await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: { authorization: auth(kp, "sita") } }));
    assert.equal(JSON.parse(dash.body).storyRole, "needy");
    const created = await post(handler, kp, "sita");
    assert.equal(created.statusCode, 201, created.body);
    const { id } = JSON.parse(created.body);
    assert.equal(ddb.store.get(`USER#sita|STORY#${id}`).kind, "STORY");

    let pub = await handler(makeEvent({ method: "GET", path: "/stories" }));
    assert.deepEqual(JSON.parse(pub.body).items, []);
    const mine = await handler(makeEvent({ method: "GET", path: "/me/stories", headers: { authorization: auth(kp, "sita") } }));
    assert.equal(JSON.parse(mine.body).items[0].status, "pending");

    const queue = await handler(makeEvent({ method: "GET", path: "/moderation/stories", headers: { authorization: auth(kp, "mod-1") } }));
    const queued = JSON.parse(queue.body).items[0];
    assert.equal(queued.id, id);
    assert.equal(queued.author.email, "sita@example.com");
    assert.equal((await handler(makeEvent({ method: "GET", path: "/moderation/stories", headers: { authorization: auth(kp, "sita") } }))).statusCode, 403);

    const mod = await handler(makeEvent({ method: "POST", path: `/moderation/stories/${id}`, headers: { authorization: auth(kp, "mod-1") }, body: { action: "publish" } }));
    assert.equal(mod.statusCode, 200, mod.body);
    pub = await handler(makeEvent({ method: "GET", path: "/stories" }));
    const item = JSON.parse(pub.body).items[0];
    assert.equal(item.role, "needy");
    assert.equal(item.caption, story.caption);
    assert.equal(item.author.email, undefined);
    assert.equal(item.authorSub, undefined);

    assert.equal((await handler(makeEvent({ method: "DELETE", path: `/me/stories/${id}`, headers: { authorization: auth(kp, "other") } }))).statusCode, 403);
    assert.equal((await handler(makeEvent({ method: "DELETE", path: `/me/stories/${id}`, headers: { authorization: auth(kp, "sita") } }))).statusCode, 204);
    assert.equal(ddb.store.has(`STORY#${id}|META`), false);
  });

  it("reject keeps the reason for the author; helper and org roles resolve", async () => {
    const { handler, ddb, kp } = setup();
    seedMod(ddb);
    ddb.store.set("NEED#g1|META", { PK: "NEED#g1", SK: "META", type: "NEED", id: "g1", status: "published", group: { name: "Ward 3" }, groupItems: { i1: { claimedBy: "ram", status: "done" } } });
    ddb.store.set("USER#ram|GROUP#g1", { PK: "USER#ram", SK: "GROUP#g1", type: "MINE", kind: "GROUP", id: "g1", sub: "ram", createdAt: "2026-01-01T00:00:00.000Z" });
    const { id } = JSON.parse((await post(handler, kp, "ram")).body);
    assert.equal(ddb.store.get(`STORY#${id}|META`).role, "helper");
    const mod = await handler(makeEvent({ method: "POST", path: `/moderation/stories/${id}`, headers: { authorization: auth(kp, "mod-1") }, body: { action: "reject", reason: "Face of a child visible" } }));
    assert.equal(mod.statusCode, 200);
    const mine = await handler(makeEvent({ method: "GET", path: "/me/stories", headers: { authorization: auth(kp, "ram") } }));
    assert.equal(JSON.parse(mine.body).items[0].rejectReason, "Face of a child visible");

    ddb.store.set("USER#org-owner|ORG#o1", { PK: "USER#org-owner", SK: "ORG#o1", type: "ORGMEMBER", orgId: "o1", role: "owner" });
    ddb.store.set("ORG#o1|CENTER#c1", { PK: "ORG#o1", SK: "CENTER#c1", centerId: "c1" });
    ddb.store.set("GOODS#c1|2026-01-01T00:00:00.000Z#e1", { PK: "GOODS#c1", SK: "2026-01-01T00:00:00.000Z#e1", type: "GOODS", id: "e1", centerId: "c1", entryType: "distribution" });
    const org = JSON.parse((await post(handler, kp, "org-owner")).body);
    assert.equal(ddb.store.get(`STORY#${org.id}|META`).role, "org");
  });
});
