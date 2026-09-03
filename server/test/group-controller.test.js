import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }) });
  const token = (sub, overrides) => createToken(basePayload({ sub, ...overrides }), kp.privateKey);
  return { handler, ddb, token };
}

const needBody = {
  onBehalf: false,
  beneficiary: { name: "Rita Gurung", district: "Rasuwa", ward: 5, phone: "+9779800000001" },
  category: "shelter",
  description: "Lost the house in the flood, needs shelter and food",
  language: "en",
};

// Flips a NEED straight to "published" for tests, bypassing the moderation flow.
// Must also rewrite the GSI keys the same way moderatePendingItem does (models/moderation.js) —
// GET /needs queries GSI2 by gsi2pk, not by the raw status field, so a status-only mutation
// would make the published NEED invisible to that query and any test asserting on its list shape.
function publishNeed(ddb, id) {
  const key = `NEED#${id}|META`;
  const need = ddb.store.get(key);
  const district = need.beneficiary?.district || need.district || "";
  need.status = "published";
  need.gsi1pk = `NEED#${district}#published`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = "NEED#published";
  need.gsi2sk = need.createdAt;
  ddb.store.set(key, need);
}

async function createPublishedNeed(handler, ddb) {
  const res = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody }));
  const { id } = JSON.parse(res.body);
  publishNeed(ddb, id);
  return id;
}

describe("group controller", () => {
  beforeEach(() => clearJwksCache());

  it("rejects forming a group on a pending NEED, then succeeds once published", async () => {
    const { handler, ddb, token } = setup();
    const res1 = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody }));
    const { id } = JSON.parse(res1.body);
    const auth = { authorization: `Bearer ${token("u1", { name: "Founder Person" })}` };
    let res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: auth }));
    assert.equal(res.statusCode, 400);
    publishNeed(ddb, id);
    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: auth }));
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.match(body.name, /^Help group — Rita G\., Rasuwa$/);
    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: auth }));
    assert.equal(res.statusCode, 409);
  });

  it("full flow: add item, claim, non-member cannot add items, done, and the public view reflects state", async () => {
    const { handler, ddb, token } = setup();
    const id = await createPublishedNeed(handler, ddb);
    const founder = { authorization: `Bearer ${token("u1", { name: "Founder Person" })}` };
    const helper = { authorization: `Bearer ${token("u2", { name: "Helper Person" })}` };
    const stranger = { authorization: `Bearer ${token("u3", { name: "Stranger Person" })}` };

    await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: founder }));

    let res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items`, headers: stranger, body: { description: "Should fail, not a member" } }));
    assert.equal(res.statusCode, 403);

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items`, headers: founder, body: { description: "Shelter tarp" } }));
    assert.equal(res.statusCode, 201);
    const { itemId } = JSON.parse(res.body);

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/claim`, headers: helper }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).claimedByName, "Helper P.");

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/claim`, headers: stranger }));
    assert.equal(res.statusCode, 409);

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/done`, headers: stranger }));
    assert.equal(res.statusCode, 409);

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/done`, headers: helper }));
    assert.equal(res.statusCode, 200);
    assert.ok(JSON.parse(res.body).doneAt);

    res = await handler(makeEvent({ method: "GET", path: "/needs" }));
    const listed = JSON.parse(res.body).items.find((it) => it.id === id);
    assert.equal(listed.group.name, "Help group — Rita G., Rasuwa");
    assert.equal(listed.group.memberCount, 2);
    assert.equal(listed.group.items.length, 1);
    assert.equal(listed.group.items[0].status, "done");
    assert.equal(listed.group.items[0].claimedByName, "Helper P.");
  });

  it("join adds a member without claiming anything, and release re-opens an item", async () => {
    const { handler, ddb, token } = setup();
    const id = await createPublishedNeed(handler, ddb);
    const founder = { authorization: `Bearer ${token("u1", { name: "Founder Person" })}` };
    const observer = { authorization: `Bearer ${token("u2", { name: "Observer Person" })}` };

    await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: founder }));
    let res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/join`, headers: observer }));
    assert.equal(res.statusCode, 200);

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items`, headers: founder, body: { description: "Medical kit" } }));
    const { itemId } = JSON.parse(res.body);
    await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/claim`, headers: observer }));

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/release`, headers: founder }));
    assert.equal(res.statusCode, 409, "founder never claimed it");

    res = await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${itemId}/release`, headers: observer }));
    assert.equal(res.statusCode, 200);

    const listed = JSON.parse((await handler(makeEvent({ method: "GET", path: "/needs" }))).body).items.find((it) => it.id === id);
    assert.equal(listed.group.items[0].status, "open");
    assert.equal(listed.group.memberCount, 2);
  });
});
