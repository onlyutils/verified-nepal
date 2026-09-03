import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { CLIMATE_MESSAGE_IDS } from "../src/constants.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

const env = { TABLE_NAME: "climate-test" };

function bodyOf(res) {
  return JSON.parse(res.body);
}

describe("climate message and download routes", () => {
  beforeEach(() => clearJwksCache());

  it("valid message submission increments its message, total, day, and country counters", async () => {
    const ddb = new FakeDdb();
    const handler = createHandler({ env, ddbClient: ddb });
    const res = await handler(makeEvent({
      method: "POST",
      path: "/climate/messages",
      body: { iso3: "USA", messageId: "stop-heating-us" },
    }));

    assert.equal(res.statusCode, 201);
    assert.deepEqual(bodyOf(res), { ok: true, count: 1 });
    assert.equal(ddb.store.get("CLIMATE#MSG|USA#stop-heating-us").count, 1);
    assert.equal(ddb.store.get("CLIMATE#STATS|TOTAL").messages, 1);
    assert.equal(ddb.store.get(`CLIMATE#STATS|DAY#${new Date().toISOString().slice(0, 10)}`).messages, 1);
    assert.equal(ddb.store.get("CLIMATE#STATS|COUNTRY#USA").messages, 1);
  });

  it("rejects invalid message ids and Nepal as a destination", async () => {
    const handler = createHandler({ env, ddbClient: new FakeDdb() });
    let res = await handler(makeEvent({ method: "POST", path: "/climate/messages", body: { iso3: "USA", messageId: "not-a-message" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/climate/messages", body: { iso3: "NPL", messageId: CLIMATE_MESSAGE_IDS[0] } }));
    assert.equal(res.statusCode, 400);
  });

  it("requires a Turnstile token when Turnstile is required", async () => {
    const handler = createHandler({
      env: { ...env, TURNSTILE_SECRET: "test-secret", REQUIRE_TURNSTILE: "1" },
      ddbClient: new FakeDdb(),
    });
    const res = await handler(makeEvent({
      method: "POST",
      path: "/climate/messages",
      body: { iso3: "GBR", messageId: CLIMATE_MESSAGE_IDS[0] },
    }));
    assert.equal(res.statusCode, 400);
  });

  it("filters public message counts by country and sends a cache header", async () => {
    const ddb = new FakeDdb();
    const handler = createHandler({ env, ddbClient: ddb });
    for (const body of [
      { iso3: "USA", messageId: "stop-heating-us" },
      { iso3: "USA", messageId: "stop-heating-us" },
      { iso3: "GBR", messageId: "please-cool-down" },
    ]) {
      await handler(makeEvent({ method: "POST", path: "/climate/messages", body }));
    }

    const res = await handler(makeEvent({ method: "GET", path: "/climate/messages?country=USA" }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["cache-control"], "public, max-age=60");
    assert.deepEqual(bodyOf(res), {
      items: [{ iso3: "USA", messageId: "stop-heating-us", count: 2 }],
      total: 2,
    });
  });

  it("rejects an invalid download kind and records valid downloads", async () => {
    const ddb = new FakeDdb();
    const handler = createHandler({ env, ddbClient: ddb });
    let res = await handler(makeEvent({ method: "POST", path: "/climate/downloads", body: { kind: "invalid" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/climate/downloads", body: { kind: "ranking" } }));
    assert.equal(res.statusCode, 202);
    assert.deepEqual(bodyOf(res), { ok: true });
    assert.equal(ddb.store.get("CLIMATE#STATS|DL#ranking").count, 1);
    assert.equal(ddb.store.get("CLIMATE#STATS|TOTAL").downloads, 1);
  });
});

describe("GET /admin/climate", () => {
  let kp;
  let ddb;
  let handler;

  beforeEach(() => {
    clearJwksCache();
    kp = makeKeyPair();
    ddb = new FakeDdb();
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin" });
    ddb.store.set("USER#helper-1|PROFILE", { PK: "USER#helper-1", SK: "PROFILE", sub: "helper-1", role: "helper" });
    handler = createHandler({
      env: { ...env, AUTH_ISSUER: "https://auth.onlyutils.com" },
      ddbClient: ddb,
      fetchJwks: async () => ({ keys: [kp.jwk] }),
    });
  });

  it("requires an admin role and returns zero-filled 30-day stats", async () => {
    const adminToken = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    const helperToken = createToken(basePayload({ sub: "helper-1" }), kp.privateKey);
    let res = await handler(makeEvent({ method: "GET", path: "/admin/climate" }));
    assert.equal(res.statusCode, 401);
    res = await handler(makeEvent({ method: "GET", path: "/admin/climate", headers: { authorization: `Bearer ${helperToken}` } }));
    assert.equal(res.statusCode, 403);

    await handler(makeEvent({ method: "POST", path: "/climate/messages", body: { iso3: "USA", messageId: "stop-heating-us" } }));
    await handler(makeEvent({ method: "POST", path: "/climate/messages", body: { iso3: "GBR", messageId: "please-cool-down" } }));
    await handler(makeEvent({ method: "POST", path: "/climate/downloads", body: { kind: "map" } }));

    res = await handler(makeEvent({
      method: "GET",
      path: "/admin/climate",
      headers: { authorization: `Bearer ${adminToken}` },
    }));
    assert.equal(res.statusCode, 200);
    const stats = bodyOf(res);
    assert.deepEqual(stats.totals, { messages: 2, downloads: 1 });
    assert.equal(stats.days.length, 30);
    assert.equal(stats.days[0].messages, 0);
    assert.equal(stats.days[0].downloads, 0);
    assert.equal(stats.days[29].messages, 2);
    assert.equal(stats.days[29].downloads, 1);
    assert.equal(stats.downloadsByKind.length, 6);
    assert.equal(stats.downloadsByKind.find((item) => item.kind === "map").count, 1);
    assert.deepEqual(stats.topCountries, [{ iso3: "GBR", messages: 1 }, { iso3: "USA", messages: 1 }]);
    assert.equal(stats.topMessages.length, 34);
    assert.deepEqual(stats.topMessages[0], { messageId: "stop-heating-us", count: 1 });
    assert.deepEqual(stats.topMessages[1], { messageId: "please-cool-down", count: 1 });
  });
});
