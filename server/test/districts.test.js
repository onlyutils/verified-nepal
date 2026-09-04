import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function makeHandler(opts = {}) {
  const kp = opts.kp ?? makeKeyPair();
  const ddb = opts.ddb ?? new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ...opts.envOverrides };
  const fetchJwks = opts.fetchJwks ?? (async () => ({ keys: [kp.jwk] }));
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: opts.fetch });
  return { handler, ddb, kp, env };
}

describe("POST /me/districts", () => {
  beforeEach(() => { clearJwksCache(); });

  it("lets a moderator set their own districts", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    ddb.store.set("USER#mod1|PROFILE", { PK: "USER#mod1", SK: "PROFILE", sub: "mod1", role: "moderator", email: "mod@x.com", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const { handler } = makeHandler({ kp, ddb });
    const tok = createToken(basePayload({ sub: "mod1" }), kp.privateKey);
    const res = await handler(makeEvent({ method: "POST", path: "/me/districts", headers: { authorization: `Bearer ${tok}` }, body: { districts: ["Rasuwa", "Nuwakot"] } }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).districts, ["Rasuwa", "Nuwakot"]);
    assert.deepEqual(ddb.store.get("USER#mod1|PROFILE").districts, ["Rasuwa", "Nuwakot"]);
  });

  it("rejects a non-moderator", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    ddb.store.set("USER#helper1|PROFILE", { PK: "USER#helper1", SK: "PROFILE", sub: "helper1", role: "helper", email: "h@x.com", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#helper", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const { handler } = makeHandler({ kp, ddb });
    const tok = createToken(basePayload({ sub: "helper1" }), kp.privateKey);
    const res = await handler(makeEvent({ method: "POST", path: "/me/districts", headers: { authorization: `Bearer ${tok}` }, body: { districts: ["Rasuwa"] } }));
    assert.equal(res.statusCode, 403);
  });

  it("rejects an invalid body", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    ddb.store.set("USER#mod2|PROFILE", { PK: "USER#mod2", SK: "PROFILE", sub: "mod2", role: "moderator", email: "m2@x.com", districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z" });
    const { handler } = makeHandler({ kp, ddb });
    const tok = createToken(basePayload({ sub: "mod2" }), kp.privateKey);
    let res = await handler(makeEvent({ method: "POST", path: "/me/districts", headers: { authorization: `Bearer ${tok}` }, body: { districts: "Rasuwa" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/me/districts", headers: { authorization: `Bearer ${tok}` }, body: { districts: Array.from({ length: 11 }, (_, i) => `D${i}`) } }));
    assert.equal(res.statusCode, 400);
  });
});
