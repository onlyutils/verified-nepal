import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler, __clearMediaTokenCache } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup(fetchImpl) {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t", OU_MEDIA_CLIENT_ID: "mc", OU_MEDIA_CLIENT_SECRET: "ms" };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }), fetch: fetchImpl });
  const token = (sub) => createToken(basePayload({ sub }), kp.privateKey);
  return { handler, ddb, token };
}

const body = {
  name: "Sita Tamang", nickname: "", age: "34", gender: "woman", district: "Rasuwa", place: "Betrawati",
  lastSeenAt: "2026-08-26T14:30", clothing: "", story: "Last seen near the bridge", phones: ["9841000000"],
  status: "missing", language: "en", template: "paper", size: "feed",
  photo: { fileId: "f1", url: "https://media.example/f1.jpg" },
};

describe("saved missing-person posters", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("GET /missing is public, lists every poster and counts missing vs found", async () => {
    const { handler, token } = setup();
    const a = { authorization: `Bearer ${token("u1")}` };
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: a }));
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body: { ...body, name: "Ram", status: "found" }, headers: a }));
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p3", body: { ...body, name: "Hari" }, headers: { authorization: `Bearer ${token("u2")}` } }));
    const res = await handler(makeEvent({ method: "GET", path: "/missing" }));
    assert.equal(res.statusCode, 200);
    const out = JSON.parse(res.body);
    assert.deepEqual(out.counts, { missing: 2, found: 1 });
    assert.deepEqual(out.items.map((m) => m.id).sort(), ["p1", "p2", "p3"]);
    assert.ok(out.items.every((m) => m.createdBy === undefined && m.gsi2pk === undefined && m.phones.length === 1));
    // Marking found moves the record between the two lists.
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body: { ...body, status: "found" }, headers: a }));
    assert.deepEqual(JSON.parse((await handler(makeEvent({ method: "GET", path: "/missing" }))).body).counts, { missing: 1, found: 2 });
  });

  it("PUT creates, updates, and refuses another owner", async () => {
    const { handler, ddb, token } = setup();
    const a = { authorization: `Bearer ${token("u1")}` };
    let res = await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: a }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).id, "p1");
    const item = ddb.store.get("MISSING#p1|META");
    assert.equal(item.createdBy, "u1");
    assert.equal(item.name, "Sita Tamang");
    assert.ok(ddb.store.get("USER#u1|MISSING#p1"));
    res = await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body: { ...body, status: "found" }, headers: a }));
    assert.equal(res.statusCode, 200);
    assert.equal(ddb.store.get("MISSING#p1|META").status, "found");
    res = await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: { authorization: `Bearer ${token("u2")}` } }));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body: { ...body, phones: [] }, headers: a }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body }));
    assert.equal(res.statusCode, 401);
  });

  it("dashboard lists the poster, DELETE removes it and the pointer", async () => {
    const { handler, ddb, token } = setup();
    const a = { authorization: `Bearer ${token("u1")}` };
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: a }));
    let res = await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: a }));
    const dash = JSON.parse(res.body);
    assert.equal(dash.missing.length, 1);
    assert.equal(dash.missing[0].id, "p1");
    assert.equal(dash.missing[0].createdBy, undefined);
    res = await handler(makeEvent({ method: "DELETE", path: "/me/missing/p1", headers: { authorization: `Bearer ${token("u2")}` } }));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({ method: "DELETE", path: "/me/missing/p1", headers: a }));
    assert.equal(res.statusCode, 204);
    assert.equal(ddb.store.has("MISSING#p1|META"), false);
    assert.equal(ddb.store.has("USER#u1|MISSING#p1"), false);
    res = await handler(makeEvent({ method: "DELETE", path: "/me/missing/p1", headers: a }));
    assert.equal(res.statusCode, 404);
  });

  it("presign requires auth, validates, and proxies the media service", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push(String(url));
      if (String(url).includes("/token")) return { ok: true, status: 200, json: async () => ({ access_token: "mt", expires_in: 3600 }) };
      return { ok: true, status: 200, json: async () => ({ uploadUrl: "https://up.example/x", fileId: "f9", publicUrl: "https://media.example/f9.jpg" }) };
    };
    const { handler, token } = setup(fetchImpl);
    const a = { authorization: `Bearer ${token("u1")}` };
    let res = await handler(makeEvent({ method: "POST", path: "/me/missing/presign", body: { filename: "a.jpg", contentType: "image/jpeg", size: 1000 } }));
    assert.equal(res.statusCode, 401);
    res = await handler(makeEvent({ method: "POST", path: "/me/missing/presign", body: { filename: "a.gif", contentType: "image/gif", size: 1000 }, headers: a }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/me/missing/presign", body: { filename: "a.jpg", contentType: "image/jpeg", size: 1000 }, headers: a }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).fileId, "f9");
    assert.ok(calls.length >= 1);
  });
});
