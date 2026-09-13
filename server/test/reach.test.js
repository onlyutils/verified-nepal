import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

const env = { TABLE_NAME: "reach-test" };

function bodyOf(res) {
  return JSON.parse(res.body);
}

function todayKey(suffix) {
  return `REACH#STATS|DAY#${new Date().toISOString().slice(0, 10)}${suffix}`;
}

describe("POST /reach", () => {
  beforeEach(() => clearJwksCache());

  it("records aggregate, page, language, path, session, and referrer counters", async () => {
    const ddb = new FakeDdb();
    const handler = createHandler({ env, ddbClient: ddb });
    let res = await handler(makeEvent({
      method: "POST",
      path: "/reach",
      body: { page: "dropCenterDetail", path: "/drop-centers/abc", lang: "ne", ref: "facebook.com", newSession: true },
    }));
    assert.equal(res.statusCode, 204);
    res = await handler(makeEvent({
      method: "POST",
      path: "/reach",
      body: { page: "floodImpact", path: "/flood-impact?loc=kathmandu", lang: "en", newSession: false },
    }));
    assert.equal(res.statusCode, 204);
    res = await handler(makeEvent({
      method: "POST",
      path: "/reach",
      body: { page: "dashboard", path: "/", lang: "en", ref: "news.example", newSession: false },
    }));
    assert.equal(res.statusCode, 204);

    assert.deepEqual(ddb.store.get("REACH#STATS|TOTAL"), { PK: "REACH#STATS", SK: "TOTAL", views: 3, sessions: 1 });
    assert.deepEqual(ddb.store.get(todayKey("")), { PK: "REACH#STATS", SK: `DAY#${new Date().toISOString().slice(0, 10)}`, views: 3, sessions: 1 });
    assert.equal(ddb.store.get(todayKey("#PAGE#dropCenterDetail")).views, 1);
    assert.equal(ddb.store.get("REACH#STATS|PAGE#dropCenterDetail").views, 1);
    assert.equal(ddb.store.get("REACH#STATS|LANG#en").views, 2);
    assert.equal(ddb.store.get("REACH#STATS|LANG#ne").views, 1);
    assert.equal(ddb.store.get("REACH#STATS|PATH#dropCenterDetail#/drop-centers/abc").views, 1);
    assert.equal(ddb.store.get("REACH#STATS|PATH#floodImpact#/flood-impact?loc=kathmandu").views, 1);
    assert.equal(ddb.store.has("REACH#STATS|PATH#dashboard#/"), false);
    assert.equal(ddb.store.get("REACH#STATS|REF#facebook.com").views, 1);
    assert.equal(ddb.store.get("REACH#STATS|REF#news.example").views, 1);
    assert.equal(ddb.store.get("REACH#STATS|TOTAL").sessions, 1);
  });

  it("rejects invalid pages and paths", async () => {
    const handler = createHandler({ env, ddbClient: new FakeDdb() });
    let res = await handler(makeEvent({ method: "POST", path: "/reach", body: { page: "drop-center", path: "/drop-centers/abc" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/reach", body: { page: "dashboard", path: "dashboard" } }));
    assert.equal(res.statusCode, 400);
  });
});

describe("GET /admin/reach", () => {
  let kp;
  let ddb;
  let handler;

  beforeEach(() => {
    clearJwksCache();
    kp = makeKeyPair();
    ddb = new FakeDdb();
    ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin" });
    ddb.store.set("USER#moderator-1|PROFILE", { PK: "USER#moderator-1", SK: "PROFILE", sub: "moderator-1", role: "moderator" });
    handler = createHandler({
      env: { ...env, AUTH_ISSUER: "https://auth.onlyutils.com" },
      ddbClient: ddb,
      fetchJwks: async () => ({ keys: [kp.jwk] }),
    });
  });

  it("requires an admin role and returns reach aggregates", async () => {
    const adminToken = createToken(basePayload({ sub: "admin-1" }), kp.privateKey);
    const moderatorToken = createToken(basePayload({ sub: "moderator-1" }), kp.privateKey);
    let res = await handler(makeEvent({ method: "GET", path: "/admin/reach", headers: { authorization: `Bearer ${moderatorToken}` } }));
    assert.equal(res.statusCode, 403);

    const post = (body) => handler(makeEvent({ method: "POST", path: "/reach", body }));
    await post({ page: "dashboard", path: "/", lang: "en", newSession: true });
    await post({ page: "dropCenterDetail", path: "/drop-centers/abc", lang: "ne", ref: "facebook.com", newSession: true });
    await post({ page: "dropCenterDetail", path: "/drop-centers/abc", lang: "en", newSession: false });
    await post({ page: "floodImpact", path: "/flood-impact?loc=kathmandu", lang: "en", ref: "news.example", newSession: false });

    res = await handler(makeEvent({ method: "GET", path: "/admin/reach", headers: { authorization: `Bearer ${adminToken}` } }));
    assert.equal(res.statusCode, 200);
    const stats = bodyOf(res);
    assert.deepEqual(stats.totals, { views: 4, sessions: 2 });
    assert.deepEqual(stats.today, { views: 4, sessions: 2 });
    assert.deepEqual(stats.last30, { views: 4, sessions: 2 });
    assert.equal(stats.days.length, 30);
    assert.equal(stats.days[0].views, 0);
    assert.equal(stats.days[29].pages.dropCenterDetail, 2);
    assert.deepEqual(stats.pages, [
      { page: "dropCenterDetail", views: 2, last30: 2 },
      { page: "dashboard", views: 1, last30: 1 },
      { page: "floodImpact", views: 1, last30: 1 },
    ]);
    assert.deepEqual(stats.paths, [
      { page: "dropCenterDetail", path: "/drop-centers/abc", views: 2 },
      { page: "floodImpact", path: "/flood-impact?loc=kathmandu", views: 1 },
    ]);
    assert.deepEqual(stats.referrers, [
      { host: "facebook.com", views: 1 },
      { host: "news.example", views: 1 },
    ]);
    assert.deepEqual(stats.languages, { en: 3, ne: 1 });
  });
});
