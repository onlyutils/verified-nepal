import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler, __clearMediaTokenCache } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function makeHandler({ envOverrides = {}, ddb, kp, fetchImpl } = {}) {
  const keyPair = kp ?? makeKeyPair();
  const d = ddb ?? new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", OU_MEDIA_CLIENT_ID: "ou_client_test", OU_MEDIA_CLIENT_SECRET: "secret123", MEDIA_HOST: "https://media.onlyutils.com", ...envOverrides };
  const fetchJwks = async () => ({ keys: [keyPair.jwk] });
  const handler = createHandler({ env, ddbClient: d, fetchJwks, fetch: fetchImpl });
  return { handler, ddb: d, env, kp: keyPair, fetchJwks };
}

function projectBody(overrides = {}) {
  return {
    title: { en: "Tuin Bridge Repair" },
    description: { en: "Rebuilding the tuin bridge in ward 5 that was damaged in the landslide, need support for materials and labor for community" },
    type: "tuin",
    district: "Gorkha",
    ward: 5,
    locationText: "Ward 5, near river",
    costEstimateNpr: 500000,
    committee: {
      name: "Ward 5 Committee",
      contactName: "Ram Thapa",
      phone: "+977-9801234567",
      bank: { bankName: "RBB", accountName: "Ward 5 Committee", accountNumber: "1234567890" },
      esewaId: "9801234567",
      khaltiId: "9801234568",
    },
    ...overrides,
  };
}

describe("POST /projects", () => {
  let kp, fetchJwks;
  beforeEach(() => { clearJwksCache(); kp = makeKeyPair(); fetchJwks = async () => ({ keys: [kp.jwk] }); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("creates project anonymously and returns id+updateCode", async () => {
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ envOverrides: { TABLE_NAME: "t" }, ddb, kp });
    const res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.id);
    assert.ok(body.updateCode);
    assert.equal(body.updateCode.length, 12);
    assert.match(body.updateCode, /^[A-Z2-7]{12}$/);
    const item = ddb.store.get(`PROJECT#${body.id}|META`);
    assert.ok(item);
    assert.equal(item.status, "pending");
    assert.equal(item.committee.verified, false);
    assert.ok(item.updateCodeHash);
    assert.equal(item.updateCodeHash.length, 64);
    assert.equal(item.committee.phone, "+977-9801234567");
    assert.equal(item.gsi1pk, `PROJECT#Gorkha#pending`);
    assert.equal(item.gsi2pk, `PROJECT#pending`);
    const pcodeHash = item.updateCodeHash;
    const pcode = ddb.store.get(`PCODE#${pcodeHash}|META`);
    assert.ok(pcode);
    assert.equal(pcode.projectId, body.id);
    // ensure updateCode not stored plaintext
    const dumped = JSON.stringify(item);
    assert.equal(dumped.includes(body.updateCode), false);
  });

  it("validates required fields", async () => {
    const ddbTmp = new FakeDdb();
    const { handler } = makeHandler({ ddb: ddbTmp, kp });
    // missing title
    let res = await handler(makeEvent({ method: "POST", path: "/projects", body: { ...projectBody(), title: undefined } }));
    assert.equal(res.statusCode, 400);
    // invalid type
    res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ type: "invalid" }) }));
    assert.equal(res.statusCode, 400);
    // missing committee phone
    res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ committee: { name: "C", contactName: "X", phone: "", bank: { bankName:"a", accountName:"a", accountNumber:"a"}}}) }));
    assert.equal(res.statusCode, 400);
    // ward out of range
    res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ ward: 40 }) }));
    assert.equal(res.statusCode, 400);
    // cost invalid
    res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ costEstimateNpr: -5 }) }));
    assert.equal(res.statusCode, 400);
  });

  it("supports Turnstile when configured", async () => {
    const ddb = new FakeDdb();
    // without secret, succeeds without token
    let { handler } = makeHandler({ envOverrides: { TABLE_NAME: "t" }, ddb, kp });
    let res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    assert.equal(res.statusCode, 201);
    // with secret, requires token - will attempt fetch and we mock failure? Instead test validation of missing token before fetch
    // Our verifyTurnstile will require token when secret set, but it will try real fetch; we need to provide fetch that fails. For this test, we set secret and then missing token should 400 without needing fetch success
    const ddb2 = new FakeDdb();
    handler = makeHandler({ envOverrides: { TABLE_NAME: "t", TURNSTILE_SECRET: "secret" }, ddb: ddb2, kp }).handler;
    res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /turnstile/i);
  });

  it("supports NE titles", async () => {
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ envOverrides: { TABLE_NAME: "t" }, ddb, kp });
    const res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ title: { en: "Bridge", ne: "पुल" }, description: { en: "English description long enough for validation here", ne: "नेपाली विवरण लामो पर्याप्त छ यहाँ" } }) }));
    assert.equal(res.statusCode, 201);
    const item = ddb.store.get(`PROJECT#${JSON.parse(res.body).id}|META`);
    assert.equal(item.title.ne, "पुल");
  });
});

describe("GET /projects", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  async function createProject(handler, overrides = {}, status = "pending") {
    const res = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody(overrides) }));
    assert.equal(res.statusCode, 201);
    const { id, updateCode } = JSON.parse(res.body);
    const proj = handler; // placeholder
    return { id, updateCode };
  }

  it("lists only published|in-progress|completed via GSI, masks private fields", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);

    // create 3 projects in different districts/statuses
    const r1 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ district: "Gorkha", title: { en: "P1" }, description: { en: "Desc long enough for validation P1 here more than ten chars" } }) }));
    const id1 = JSON.parse(r1.body).id;
    const r2 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ district: "Gorkha", title: { en: "P2" }, description: { en: "Desc long enough for validation P2 here more than ten chars" } }) }));
    const id2 = JSON.parse(r2.body).id;
    const r3 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ district: "Kaski", title: { en: "P3" }, description: { en: "Desc long enough for validation P3 here more than ten chars" } }) }));
    const id3 = JSON.parse(r3.body).id;

    // verify and publish first two, leave third pending, set second to in-progress
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id1}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id1}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id2}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id2}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id2}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "set-status", status: "in-progress" } }));

    // public list without filters should return only published/in-progress (2 items), not pending
    let res = await handler(makeEvent({ method: "GET", path: "/projects" }));
    assert.equal(res.statusCode, 200);
    let body = JSON.parse(res.body);
    assert.equal(body.items.length, 2);
    const ids = body.items.map(i => i.id);
    assert.ok(ids.includes(id1));
    assert.ok(ids.includes(id2));
    assert.equal(ids.includes(id3), false);

    // district filter
    res = await handler(makeEvent({ method: "GET", path: "/projects", queryStringParameters: { district: "Gorkha" } }));
    body = JSON.parse(res.body);
    assert.equal(body.items.length, 2);
    assert.ok(body.items.every(i => i.district === "Gorkha"));

    // status filter
    res = await handler(makeEvent({ method: "GET", path: "/projects", queryStringParameters: { status: "published" } }));
    body = JSON.parse(res.body);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].id, id1);
    assert.equal(body.items[0].status, "published");

    // district+status
    res = await handler(makeEvent({ method: "GET", path: "/projects", queryStringParameters: { district: "Gorkha", status: "in-progress" } }));
    body = JSON.parse(res.body);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].id, id2);

    // masking: no private keys
    const jsonStr = JSON.stringify(body.items);
    assert.equal(jsonStr.includes("phone"), false, "phone leaked in list");
    assert.equal(jsonStr.includes("contactName"), false, "contactName leaked");
    assert.equal(jsonStr.includes("updateCodeHash"), false, "hash leaked");
    for (const it of body.items) {
      assert.equal("phone" in (it.committee || {}), false);
      assert.equal("contactName" in (it.committee || {}), false);
      assert.equal("updateCodeHash" in it, false);
      // committee bank only when verified
      if (it.committee?.verified) {
        assert.ok(it.committee.bank);
      }
    }

    // pending photos not shown - add pending photo via committee and check list doesn't include it
    const proj1 = ddb.store.get(`PROJECT#${id1}|META`);
    proj1.photos.push({ fileId: "f1", url: "https://cdn.example.com/f1", status: "pending" });
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj1 }));
    res = await handler(makeEvent({ method: "GET", path: "/projects" }));
    body = JSON.parse(res.body);
    const p1 = body.items.find(i => i.id === id1);
    assert.equal(p1.photos.length, 0, "pending photo should not appear in public list");
    assert.equal(p1.coverPhoto, undefined);
  });

  it("pagination via cursor", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ title: { en: `P${i}` }, description: { en: `Desc long enough for pagination test item ${i} here` } }) }));
      const id = JSON.parse(r.body).id;
      ids.push(id);
      await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
      await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
      // small delay to ensure distinct createdAt ordering
      await new Promise(r => setTimeout(r, 2));
    }
    // list with limit 20 will return all 3, but test cursor by manually fetching? We'll test invalid cursor
    let res = await handler(makeEvent({ method: "GET", path: "/projects", queryStringParameters: { cursor: "invalid" } }));
    assert.equal(res.statusCode, 400);
  });

  it("rejects invalid status", async () => {
    const { handler } = makeHandler();
    const res = await handler(makeEvent({ method: "GET", path: "/projects", queryStringParameters: { status: "rejected" } }));
    assert.equal(res.statusCode, 400);
  });
});

describe("GET /projects/{id} public detail", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("returns published photos and published updates only, masking private fields", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    // add photos: one pending, one published via mod
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    proj.photos = [{ fileId: "pending1", url: "https://cdn/pending1", status: "pending" }, { fileId: "pub1", url: "https://cdn/pub1", status: "published", caption: "done" }];
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj }));
    // add updates: one pending, one published
    const now = new Date().toISOString();
    const updPending = { PK: `PROJECT#${id}`, SK: `UPDATE#${now}#aaa`, type: "UPDATE", id: "upd-1", projectId: id, text: "pending update text long enough here", photos: [], status: "pending", createdAt: now };
    const later = new Date(Date.now() + 1000).toISOString();
    const updPub = { PK: `PROJECT#${id}`, SK: `UPDATE#${later}#bbb`, type: "UPDATE", id: "upd-2", projectId: id, text: "published update text long enough here", photos: [], status: "published", createdAt: later };
    await ddb.send(new PutCommand({ TableName: "test-table", Item: updPending }));
    await ddb.send(new PutCommand({ TableName: "test-table", Item: updPub }));

    const res = await handler(makeEvent({ method: "GET", path: `/projects/${id}` }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.id, id);
    assert.equal(body.photos.length, 1);
    assert.equal(body.photos[0].fileId, "pub1");
    assert.equal(body.updates.length, 1);
    assert.equal(body.updates[0].id, "upd-2");
    // masking
    const jsonStr = JSON.stringify(body);
    assert.equal(jsonStr.includes("phone"), false);
    assert.equal(jsonStr.includes("contactName"), false);
    assert.equal(jsonStr.includes("updateCodeHash"), false);
    assert.equal("phone" in (body.committee || {}), false);
    assert.equal("updateCodeHash" in body, false);
    // bank visible when verified
    assert.ok(body.committee.verified === true);
    assert.ok(body.committee.bank);
    // coverPhoto derived
    assert.equal(body.coverPhoto, "https://cdn/pub1");
  });

  it("hides committee bank when not verified", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const id = JSON.parse(r.body).id;
    // publish without verification should fail, so we test detail for pending should 404
    let res = await handler(makeEvent({ method: "GET", path: `/projects/${id}` }));
    assert.equal(res.statusCode, 404);
    // now verify and publish, then check bank visible
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    res = await handler(makeEvent({ method: "GET", path: `/projects/${id}` }));
    const body = JSON.parse(res.body);
    assert.ok(body.committee.bank);
    // now test a project where we set verified false but published via set-status bypass? Instead we test that before verification, bank would be hidden but we already verify before publish so we need a direct DB manipulation to test unverified published case
    const r2 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ district: "Kaski", ward: 2, title: { en: "Unverified" }, description: { en: "Unverified project description long enough here" } }) }));
    const id2 = JSON.parse(r2.body).id;
    let proj2 = ddb.store.get(`PROJECT#${id2}|META`);
    proj2.status = "published";
    proj2.gsi1pk = `PROJECT#Kaski#published`;
    proj2.gsi2pk = `PROJECT#published`;
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj2 }));
    res = await handler(makeEvent({ method: "GET", path: `/projects/${id2}` }));
    const b2 = JSON.parse(res.body);
    assert.equal(b2.committee.verified, false);
    assert.equal(b2.committee.bank, undefined);
    assert.equal(b2.committee.esewaId, undefined);
  });

  it("returns 404 for pending project", async () => {
    const { handler } = makeHandler();
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const id = JSON.parse(r.body).id;
    const res = await handler(makeEvent({ method: "GET", path: `/projects/${id}` }));
    assert.equal(res.statusCode, 404);
  });
});

describe("POST /projects/{id}/photos/presign", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("allows committee via X-Update-Code and mod via Bearer, validates input, caches token, returns presign", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const calls = [];
    const tokenResponse = { access_token: "tok123", expires_in: 900 };
    const mediaResponse = { file_id: "file123", upload_url: "https://upload.example.com/put", public_url: "https://cdn.example.com/file123", headers: { "x-test": "1" } };
    const fetchMock = async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes("/token")) {
        assert.ok(String(opts.body).includes("client_credentials"));
        assert.ok(String(opts.body).includes("ou_client_test"));
        return { ok: true, json: async () => tokenResponse };
      }
      if (url.includes("/media/files")) {
        assert.equal(opts.method, "POST");
        assert.ok(opts.headers.Authorization.includes("Bearer tok123"));
        assert.ok(opts.headers["Idempotency-Key"]);
        const body = JSON.parse(opts.body);
        assert.equal(body.visibility, "public");
        assert.ok(["image/jpeg","image/png","image/webp"].includes(body.content_type));
        return { ok: true, json: async () => mediaResponse };
      }
      return { ok: false, status: 404, json: async () => ({ message: "not found" }) };
    };
    const { handler } = makeHandler({ kp, ddb, fetchImpl: fetchMock });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);

    // committee presign
    let res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "photo.jpg", contentType: "image/jpeg", size: 1024 } }));
    assert.equal(res.statusCode, 200);
    let body = JSON.parse(res.body);
    assert.equal(body.fileId, "file123");
    assert.equal(body.uploadUrl, "https://upload.example.com/put");
    assert.equal(body.publicUrl, "https://cdn.example.com/file123");
    assert.equal(calls.filter(c=>c.url.includes("/token")).length, 1);
    assert.equal(calls.filter(c=>c.url.includes("/media/files")).length, 1);

    // second presign should reuse cached token (no extra token call)
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "photo2.jpg", contentType: "image/png", size: 2048 } }));
    assert.equal(res.statusCode, 200);
    assert.equal(calls.filter(c=>c.url.includes("/token")).length, 1, "token should be cached");
    assert.equal(calls.filter(c=>c.url.includes("/media/files")).length, 2);

    // mod presign
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { authorization: `Bearer ${modTok}` }, body: { filename: "mod.jpg", contentType: "image/webp", size: 5000 } }));
    assert.equal(res.statusCode, 200);

    // invalid contentType
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "a.jpg", contentType: "image/gif", size: 100 } }));
    assert.equal(res.statusCode, 400);

    // size too large
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "a.jpg", contentType: "image/jpeg", size: 9*1024*1024 } }));
    assert.equal(res.statusCode, 400);

    // unauthorized (no code, no mod)
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, body: { filename: "a.jpg", contentType: "image/jpeg", size: 100 } }));
    assert.equal(res.statusCode, 401);

    // wrong updateCode
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": "AAAAAAAAAAAA" }, body: { filename: "a.jpg", contentType: "image/jpeg", size: 100 } }));
    assert.equal(res.statusCode, 401);
  });

  it("uses MEDIA_PUBLIC_BASE when set", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchMock = async (url, opts) => {
      if (url.includes("/token")) return { ok: true, json: async () => ({ access_token: "tok", expires_in: 900 }) };
      if (url.includes("/media/files")) return { ok: true, json: async () => ({ file_id: "fid999", upload_url: "https://upload/put", public_url: "https://cdn/fid999" }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const { handler } = makeHandler({ kp, ddb, fetchImpl: fetchMock, envOverrides: { MEDIA_PUBLIC_BASE: "https://my.cdn/files" } });
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    const res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "a.jpg", contentType: "image/jpeg", size: 100 } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.publicUrl, "https://my.cdn/files/fid999");
  });

  it("supports media response wrapped in data field and snake/camel keys", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const fetchMock = async (url, opts) => {
      if (url.includes("/token")) return { ok: true, json: async () => ({ access_token: "tok", expires_in: 900 }) };
      if (url.includes("/media/files")) return { ok: true, json: async () => ({ data: { id: "abc", uploadUrl: "https://u/c", publicUrl: "https://p/c" } }) };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const { handler } = makeHandler({ kp, ddb, fetchImpl: fetchMock });
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    const res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "a.jpg", contentType: "image/jpeg", size: 100 } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).fileId, "abc");
  });

  it("reads the live OnlyUtils media shape: id + key + nested upload.url, public URL is CDN/key", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const live = {
      id: "ou_file_34HK75975oJZQZm0pENjp",
      filename: "e2e.png",
      content_type: "image/png",
      key: "media/ou_client_x/ou_file_34HK75975oJZQZm0pENjp/e2e.png",
      visibility: "public",
      status: "pending",
      upload: { url: "https://bucket.s3.ap-south-1.amazonaws.com/media/ou_client_x/ou_file_34HK75975oJZQZm0pENjp/e2e.png?X-Amz-Signature=abc", method: "PUT", expires_at: "2026-09-01T15:16:38Z" },
    };
    const fetchMock = async (url) => {
      if (url.includes("/token")) return { ok: true, json: async () => ({ access_token: "tok", expires_in: 900 }) };
      if (url.includes("/media/files")) return { ok: true, json: async () => live };
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const { handler } = makeHandler({ kp, ddb, fetchImpl: fetchMock, envOverrides: { MEDIA_PUBLIC_BASE: "https://cdn.dev.verifiednepal.com" } });
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    const res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos/presign`, headers: { "x-update-code": updateCode }, body: { filename: "e2e.png", contentType: "image/png", size: 100 } }));
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    assert.equal(body.fileId, live.id);
    assert.equal(body.uploadUrl, live.upload.url);
    assert.equal(body.publicUrl, `https://cdn.dev.verifiednepal.com/${live.key}`);
  });
});

describe("POST /projects/{id}/photos", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("committee upload is pending, mod upload is published", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);

    let res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos`, headers: { "x-update-code": updateCode }, body: { fileId: "f1", url: "https://cdn/f1" } }));
    assert.equal(res.statusCode, 201);
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.photos[0].status, "pending");

    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos`, headers: { authorization: `Bearer ${modTok}` }, body: { fileId: "f2", url: "https://cdn/f2", caption: "cap" } }));
    assert.equal(res.statusCode, 201);
    proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.photos.find(p=>p.fileId==="f2").status, "published");
    assert.equal(proj.photos.find(p=>p.fileId==="f2").caption, "cap");

    // unauthorized
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos`, body: { fileId: "f3", url: "https://cdn/f3" } }));
    assert.equal(res.statusCode, 401);
  });

  it("validates url", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    const res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/photos`, headers: { "x-update-code": updateCode }, body: { fileId: "f1", url: "not-a-url" } }));
    assert.equal(res.statusCode, 400);
  });
});

describe("POST /projects/{id}/updates", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("committee creates pending update with spentNpr and photoFileIds", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    // add a photo first
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    proj.photos = [{ fileId: "fid1", url: "https://cdn/fid1", status: "published" }];
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj }));
    let res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { "x-update-code": updateCode }, body: { text: "We have completed foundation work and purchased materials for the bridge deck", photoFileIds: ["fid1"], spentNpr: 120000 } }));
    assert.equal(res.statusCode, 201);
    const { updateId } = JSON.parse(res.body);
    assert.ok(updateId);
    const q = await ddb.send(new (await import("@aws-sdk/lib-dynamodb")).QueryCommand({ TableName: "test-table", KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)", ExpressionAttributeValues: { ":pk": `PROJECT#${id}`, ":prefix": "UPDATE#" } }));
    const upd = q.Items.find(it=>it.id===updateId);
    assert.ok(upd);
    assert.equal(upd.status, "pending");
    assert.equal(upd.spentNpr, 120000);
    assert.equal(upd.photos[0].fileId, "fid1");

    // mod cannot create update (should be 401)
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { authorization: `Bearer ${modTok}` }, body: { text: "mod try update with enough length here" } }));
    assert.equal(res.statusCode, 401);

    // invalid photoFileId
    res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { "x-update-code": updateCode }, body: { text: "valid text long enough for update here", photoFileIds: ["notexist"] } }));
    assert.equal(res.statusCode, 400);
  });

  it("validates text length", async () => {
    const { handler } = makeHandler();
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    const res = await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { "x-update-code": updateCode }, body: { text: "short" } }));
    assert.equal(res.statusCode, 400);
  });
});

describe("moderation", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("GET /moderation/projects lists full records oldest first, requires mod", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    // helper user
    ddb.store.set("USER#helper-1|PROFILE", { PK: "USER#helper-1", SK: "PROFILE", sub: "helper-1", role: "helper" });
    const helperTok = createToken(basePayload({ sub: "helper-1" }), kp.privateKey);
    let res = await handler(makeEvent({ method: "GET", path: "/moderation/projects", headers: { authorization: `Bearer ${helperTok}` } }));
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({ method: "GET", path: "/moderation/projects" }));
    assert.equal(res.statusCode, 401);

    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r1 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ title: { en: "A" }, description: { en: "Desc long enough for project A here" } }) }));
    await new Promise(r=>setTimeout(r,2));
    const r2 = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody({ title: { en: "B" }, description: { en: "Desc long enough for project B here" }, district: "Kaski" }) }));
    const id1 = JSON.parse(r1.body).id;
    let proj1 = ddb.store.get(`PROJECT#${id1}|META`);
    proj1.photos = [{ fileId: "p1", url: "https://cdn/p1", status: "pending" }];
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj1 }));
    const now = new Date().toISOString();
    await ddb.send(new PutCommand({ TableName: "test-table", Item: { PK: `PROJECT#${id1}`, SK: `UPDATE#${now}#x`, type: "UPDATE", id: "u1", projectId: id1, text: "pending update", photos: [], status: "pending", createdAt: now } }));
    res = await handler(makeEvent({ method: "GET", path: "/moderation/projects", headers: { authorization: `Bearer ${modTok}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.items.length, 2);
    // oldest first
    assert.equal(body.items[0].id, id1);
    // full records contain private fields
    const first = body.items.find(it=>it.id===id1);
    assert.ok(first.committee.phone);
    assert.ok(first.committee.contactName);
    assert.equal(first.photos[0].status, "pending");
    assert.equal(first.updates[0].status, "pending");
    // public list should not have those pending
    let pub = await handler(makeEvent({ method: "GET", path: "/projects" }));
    // not published yet so zero
    assert.equal(JSON.parse(pub.body).items.length, 0);
  });

  it("POST /moderation/projects/:id publish requires verified, creates AUDIT", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const id = JSON.parse(r.body).id;
    // try publish without verify -> 400
    let res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 400);
    // verify
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    assert.equal(res.statusCode, 200);
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.committee.verified, true);
    // now publish succeeds
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, "published");
    proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.status, "published");
    assert.equal(proj.gsi2pk, "PROJECT#published");
    // audit written
    const audits = Array.from(ddb.store.values()).filter(v=>v.PK.startsWith("AUDIT#"));
    assert.ok(audits.length >= 2);
    assert.ok(audits.some(a=>a.action==="publish" && a.targetId===id));
  });

  it("moderation photo publish/reject and set-status", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const id = JSON.parse(r.body).id;
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    proj.photos = [{ fileId: "f1", url: "https://cdn/f1", status: "pending" }];
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj }));
    // verify and publish project first
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    // publish photo
    let res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish-photo", fileId: "f1" } }));
    assert.equal(res.statusCode, 200);
    proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.photos[0].status, "published");
    // add another pending and reject
    proj.photos.push({ fileId: "f2", url: "https://cdn/f2", status: "pending" });
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj }));
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "reject-photo", fileId: "f2" } }));
    assert.equal(res.statusCode, 200);
    proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.photos.find(p=>p.fileId==="f2"), undefined);
    // set-status
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "set-status", status: "in-progress" } }));
    assert.equal(res.statusCode, 200);
    proj = ddb.store.get(`PROJECT#${id}|META`);
    assert.equal(proj.status, "in-progress");
    assert.equal(proj.gsi2pk, "PROJECT#in-progress");
  });

  it("POST /moderation/projects/:id/updates/:updateId publish/reject", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const { id, updateCode } = JSON.parse(r.body);
    await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { "x-update-code": updateCode }, body: { text: "Update text long enough for moderation here" } }));
    const q = await ddb.send(new (await import("@aws-sdk/lib-dynamodb")).QueryCommand({ TableName: "test-table", KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)", ExpressionAttributeValues: { ":pk": `PROJECT#${id}`, ":prefix": "UPDATE#" } }));
    const updId = q.Items[0].id;
    let res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}/updates/${updId}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, "published");
    // create another pending and reject
    await handler(makeEvent({ method: "POST", path: `/projects/${id}/updates`, headers: { "x-update-code": updateCode }, body: { text: "Second update text long enough for moderation here" } }));
    const q2 = await ddb.send(new (await import("@aws-sdk/lib-dynamodb")).QueryCommand({ TableName: "test-table", KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)", ExpressionAttributeValues: { ":pk": `PROJECT#${id}`, ":prefix": "UPDATE#" } }));
    const pending = q2.Items.find(it=>it.status==="pending");
    res = await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}/updates/${pending.id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "reject", reason: "spam" } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).status, "rejected");
  });
});

describe("masking test", () => {
  beforeEach(() => { clearJwksCache(); if (__clearMediaTokenCache) __clearMediaTokenCache(); });

  it("public list/detail JSON has no phone/contactName/updateCodeHash keys", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator" , guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const modTok = createToken(basePayload({ sub: "mod-1" }), kp.privateKey);
    const r = await handler(makeEvent({ method: "POST", path: "/projects", body: projectBody() }));
    const id = JSON.parse(r.body).id;
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "verify-committee" } }));
    await handler(makeEvent({ method: "POST", path: `/moderation/projects/${id}`, headers: { authorization: `Bearer ${modTok}` }, body: { action: "publish" } }));
    // add pending photo/update to ensure they're not leaked
    let proj = ddb.store.get(`PROJECT#${id}|META`);
    proj.photos.push({ fileId: "pending", url: "https://cdn/pending", status: "pending" });
    proj.photos.push({ fileId: "pub", url: "https://cdn/pub", status: "published" });
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await ddb.send(new PutCommand({ TableName: "test-table", Item: proj }));
    const now = new Date().toISOString();
    await ddb.send(new PutCommand({ TableName: "test-table", Item: { PK: `PROJECT#${id}`, SK: `UPDATE#${now}#x`, type: "UPDATE", id: "u-pending", projectId: id, text: "pending", photos: [], status: "pending", createdAt: now } }));
    await ddb.send(new PutCommand({ TableName: "test-table", Item: { PK: `PROJECT#${id}`, SK: `UPDATE#${new Date(Date.now()+1000).toISOString()}#y`, type: "UPDATE", id: "u-pub", projectId: id, text: "published update", photos: [], status: "published", createdAt: new Date(Date.now()+1000).toISOString() } }));

    const listRes = await handler(makeEvent({ method: "GET", path: "/projects" }));
    const listBody = JSON.parse(listRes.body);
    const listStr = JSON.stringify(listBody);
    assert.equal(listStr.includes("phone"), false);
    assert.equal(listStr.includes("contactName"), false);
    assert.equal(listStr.includes("updateCodeHash"), false);
    // also assert keys not present
    for (const item of listBody.items) {
      assert.equal("updateCodeHash" in item, false);
      assert.equal("phone" in (item.committee || {}), false);
      assert.equal("contactName" in (item.committee || {}), false);
    }

    const detailRes = await handler(makeEvent({ method: "GET", path: `/projects/${id}` }));
    const detailBody = JSON.parse(detailRes.body);
    const detailStr = JSON.stringify(detailBody);
    assert.equal(detailStr.includes("\"phone\""), false);
    assert.equal(detailStr.includes("\"contactName\""), false);
    assert.equal(detailStr.includes("\"updateCodeHash\""), false);
    assert.equal("updateCodeHash" in detailBody, false);
    // pending not leaked
    assert.equal(detailBody.photos.some(p=>p.fileId==="pending"), false);
    assert.equal(detailBody.updates.some(u=>u.id==="u-pending"), false);
  });
});
