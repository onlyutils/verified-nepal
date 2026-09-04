import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent, seedActiveIncident, TEST_INCIDENT_ID } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  seedActiveIncident(ddb);
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
  incidentId: TEST_INCIDENT_ID,
};

describe("dashboard groups", () => {
  beforeEach(() => clearJwksCache());

  it("lists a claimed item under the caller's own group entry, without leaking other members", async () => {
    const { handler, ddb, token } = setup();
    const res1 = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody }));
    const { id } = JSON.parse(res1.body);
    // Flip straight to "published", bypassing moderation. Must also rewrite the GSI keys
    // the way moderatePendingItem does (models/moderation.js) — a status-only mutation would
    // leave the item internally inconsistent (status says published, gsi2pk still says pending).
    const need = ddb.store.get(`NEED#${id}|META`);
    need.status = "published";
    need.gsi1pk = `NEED#${need.incidentId}#${need.beneficiary.district}#published`;
    need.gsi1sk = need.createdAt;
    need.gsi2pk = "NEED#published";
    need.gsi2sk = need.createdAt;

    const founder = { authorization: `Bearer ${token("u1", { name: "Founder Person" })}` };
    const helper = { authorization: `Bearer ${token("u2", { name: "Helper Person" })}` };
    await handler(makeEvent({ method: "POST", path: `/needs/${id}/group`, headers: founder }));
    const item = JSON.parse((await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items`, headers: founder, body: { description: "Shelter tarp" } }))).body);
    await handler(makeEvent({ method: "POST", path: `/needs/${id}/group/items/${item.itemId}/claim`, headers: helper }));

    const dash = JSON.parse((await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: helper }))).body);
    assert.equal(dash.groups.length, 1);
    assert.equal(dash.groups[0].id, id);
    assert.equal(dash.groups[0].district, "Rasuwa");
    assert.equal(dash.groups[0].myItems.length, 1);
    assert.equal(dash.groups[0].myItems[0].description, "Shelter tarp");
    assert.equal(dash.groups[0].myItems[0].status, "claimed");

    const founderDash = JSON.parse((await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: founder }))).body);
    assert.equal(founderDash.groups[0].myItems.length, 0, "founder joined but claimed nothing");
  });
});
