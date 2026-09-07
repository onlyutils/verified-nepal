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

  it("keeps legacy posters public and in the owner's dashboard without putting them in moderation", async () => {
    const { handler, ddb, token } = setup();
    const legacy = {
      PK: "MISSING#legacy", SK: "META", type: "MISSING", id: "legacy", name: "Legacy Person", status: "missing",
      district: "Rasuwa", place: "Betrawati", createdBy: "u1", createdAt: "2026-01-01T00:00:00.000Z",
    };
    ddb.store.set("MISSING#legacy|META", legacy);
    ddb.store.set("USER#u1|MISSING#legacy", { PK: "USER#u1", SK: "MISSING#legacy", type: "MINE", kind: "MISSING", id: "legacy", sub: "u1" });
    ddb.store.set("MISSING#pending|META", {
      ...legacy, PK: "MISSING#pending", SK: "META", id: "pending", publicationStatus: "pending", gsi2pk: "MISSING#pending",
    });
    ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", sub: "mod", role: "moderator", name: "Mod", guidelinesAckAt: "now", districts: [] });

    const publicList = JSON.parse((await handler(makeEvent({ method: "GET", path: "/missing" }))).body);
    assert.equal(publicList.items.find((item) => item.id === "legacy").publicationStatus, "published");
    assert.equal(publicList.counts.missing, 1);
    assert.equal((await handler(makeEvent({ method: "POST", path: "/missing/legacy/tips", body: { message: "Seen near the bridge" } }))).statusCode, 201);

    const dashboard = JSON.parse((await handler(makeEvent({ method: "GET", path: "/me/dashboard", headers: { authorization: `Bearer ${token("u1")}` } }))).body);
    assert.equal(dashboard.missing[0].publicationStatus, "published");

    const queue = JSON.parse((await handler(makeEvent({ method: "GET", path: "/moderation/missing", headers: { authorization: `Bearer ${token("mod")}` } }))).body);
    assert.deepEqual(queue.items.map((item) => item.id), ["pending"]);
  });

  it("new posters are pending, moderators publish them, and public output is masked", async () => {
    const { handler, ddb, token } = setup();
    const a = { authorization: `Bearer ${token("u1")}` };
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: a }));
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body: { ...body, name: "Ram", status: "found" }, headers: a }));
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p3", body: { ...body, name: "Hari" }, headers: { authorization: `Bearer ${token("u2")}` } }));
    const res = await handler(makeEvent({ method: "GET", path: "/missing" }));
    assert.equal(res.statusCode, 200);
    const out = JSON.parse(res.body);
    assert.deepEqual(out.counts, { missing: 0, found: 0, safe: 0 });
    assert.deepEqual(out.items, []);
    assert.equal(ddb.store.get("MISSING#p1|META").publicationStatus, "pending");
    ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", sub: "mod", role: "moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [] });
    const mod = { authorization: `Bearer ${token("mod")}` };
    const queue = await handler(makeEvent({ method: "GET", path: "/moderation/missing", headers: mod }));
    assert.equal(queue.statusCode, 200);
    assert.equal(JSON.parse(queue.body).items.length, 3);
    assert.equal(JSON.parse(queue.body).items[0].phones[0], "9841000000");
    for (const id of ["p1", "p2", "p3"]) {
      const published = await handler(makeEvent({ method: "POST", path: `/moderation/missing/${id}`, headers: mod, body: { action: "publish" } }));
      assert.equal(published.statusCode, 200);
    }
    const publicItems = JSON.parse((await handler(makeEvent({ method: "GET", path: "/missing" }))).body);
    assert.deepEqual(publicItems.counts, { missing: 2, found: 1, safe: 0 });
    assert.deepEqual(publicItems.items.map((m) => m.id).sort(), ["p1", "p2", "p3"]);
    assert.ok(publicItems.items.every((m) => m.createdBy === undefined && m.gsi2pk === undefined && m.phones === undefined && m.email === undefined));
    // Marking found moves the record between the two lists.
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body: { ...body, status: "found" }, headers: a }));
    assert.deepEqual(JSON.parse((await handler(makeEvent({ method: "GET", path: "/missing" }))).body).counts, {
      missing: 1,
      found: 2,
      safe: 0,
    });
    assert.ok(Array.from(ddb.store.values()).some((item) => item.type === "AUDIT" && item.targetType === "MISSING" && item.action === "status:found"));
  });

  it("requires a rejection reason and only content edits requeue a published poster", async () => {
    const { handler, ddb, token } = setup();
    const owner = { authorization: `Bearer ${token("u1")}` };
    const moderator = { authorization: `Bearer ${token("mod")}` };
    ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", sub: "mod", role: "moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [] });
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: owner }));
    let res = await handler(makeEvent({ method: "POST", path: "/moderation/missing/p1", headers: moderator, body: { action: "reject" } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/moderation/missing/p1", headers: moderator, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body: { ...body, name: body.name, district: body.district }, headers: owner }));
    const queue = await handler(makeEvent({ method: "GET", path: "/moderation/missing", headers: moderator }));
    assert.equal(JSON.parse(queue.body).items.find((item) => item.id === "p2").duplicateHint, true);
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body: { ...body, status: "found" }, headers: owner }));
    assert.equal(ddb.store.get("MISSING#p1|META").publicationStatus, "published");
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body: { ...body, status: "found", story: "A materially updated account" }, headers: owner }));
    assert.equal(ddb.store.get("MISSING#p1|META").publicationStatus, "pending");
    res = await handler(makeEvent({ method: "POST", path: "/moderation/missing/p1", headers: moderator, body: { action: "reject", reason: "Duplicate report" } }));
    assert.equal(res.statusCode, 200);
    assert.equal(ddb.store.get("MISSING#p1|META").rejectReason, "Duplicate report");
    assert.ok(Array.from(ddb.store.values()).some((item) => item.type === "AUDIT" && item.targetType === "MISSING" && item.action === "reject"));
  });

  it("stores tips, rate limits them, and exposes them only to the owner", async () => {
    const { handler, ddb, token } = setup();
    const owner = { authorization: `Bearer ${token("u1")}` };
    const moderator = { authorization: `Bearer ${token("mod")}` };
    ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", sub: "mod", role: "moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [] });
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: owner }));
    await handler(makeEvent({ method: "POST", path: "/moderation/missing/p1", headers: moderator, body: { action: "publish" } }));
    const tipEvent = () => makeEvent({ method: "POST", path: "/missing/p1/tips", headers: { "x-forwarded-for": "198.51.100.10" }, body: { message: "I saw this person near the bus park", contact: "reporter@example.com" } });
    for (let i = 0; i < 5; i++) assert.equal((await handler(tipEvent())).statusCode, 201);
    assert.equal((await handler(tipEvent())).statusCode, 429);
    const tips = await handler(makeEvent({ method: "GET", path: "/me/missing/p1/tips", headers: owner }));
    assert.equal(tips.statusCode, 200);
    assert.equal(JSON.parse(tips.body).count, 5);
    assert.equal(JSON.stringify(JSON.parse(tips.body)).includes("rateKey"), false);
    assert.equal((await handler(makeEvent({ method: "GET", path: "/me/missing/p1/tips", headers: { authorization: `Bearer ${token("u2")}` } }))).statusCode, 403);
  });

  it("scopes the moderator queue and actions by district", async () => {
    const { handler, ddb, token } = setup();
    const owner = { authorization: `Bearer ${token("u1")}` };
    const moderator = { authorization: `Bearer ${token("mod")}` };
    ddb.store.set("USER#mod|PROFILE", { PK: "USER#mod", SK: "PROFILE", sub: "mod", role: "moderator", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: ["Rasuwa"] });
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p1", body, headers: owner }));
    await handler(makeEvent({ method: "PUT", path: "/me/missing/p2", body: { ...body, district: "Kaski", name: "Kaski Person" }, headers: owner }));
    const queue = await handler(makeEvent({ method: "GET", path: "/moderation/missing", headers: moderator }));
    assert.deepEqual(JSON.parse(queue.body).items.map((item) => item.id), ["p1"]);
    assert.equal((await handler(makeEvent({ method: "POST", path: "/moderation/missing/p2", headers: moderator, body: { action: "publish" } }))).statusCode, 403);
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
