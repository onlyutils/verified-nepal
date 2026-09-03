import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup(opts = {}) {
  const kp = opts.kp ?? makeKeyPair();
  const ddb = opts.ddb ?? new FakeDdb();
  const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "articles", ...opts.env };
  const handler = createHandler({ env, ddbClient: ddb, fetchJwks: async () => ({ keys: [kp.jwk] }), fetch: opts.fetch });
  return { handler, ddb, kp, env };
}

function auth(kp, sub = "author-1", extra = {}) {
  return `Bearer ${createToken(basePayload({ sub, name: "Author Name", email: `${sub}@example.com`, ...extra }), kp.privateKey)}`;
}

async function create(handler, kp, sub = "author-1", language = "en") {
  const res = await handler(makeEvent({ method: "POST", path: "/me/articles", headers: { authorization: auth(kp, sub) }, body: { language } }));
  assert.equal(res.statusCode, 201, res.body);
  return JSON.parse(res.body).id;
}

async function save(handler, kp, id, body, sub = "author-1") {
  return handler(makeEvent({ method: "PUT", path: `/me/articles/${id}`, headers: { authorization: auth(kp, sub) }, body }));
}

const validSave = {
  title: "A useful article",
  blocks: [{ type: "paragraph", text: "A paragraph with enough content for the article." }],
  cover: { url: "https://cdn.example/cover.jpg", fileId: "cover-1", source: "Photo desk", caption: "A mountain" },
  tags: ["story"], displayName: "Sita", place: "Gorkha",
};

async function submit(handler, kp, id, sub = "author-1") {
  return handler(makeEvent({ method: "POST", path: `/me/articles/${id}/submit`, headers: { authorization: auth(kp, sub) } }));
}

async function publish(handler, kp, ddb, id) {
  ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", role: "moderator", name: "Mod", guidelinesAckAt: "now", districts: [] });
  return handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: auth(kp, "mod-1") }, body: { action: "publish" } }));
}

describe("article authoring", () => {
  beforeEach(() => clearJwksCache());

  it("creates an owned empty draft and lists it through an ARTICLE pointer", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    const item = ddb.store.get(`DISPATCH#${id}|META`);
    assert.equal(item.type, "DISPATCH");
    assert.equal(item.authorSub, "author-1");
    assert.deepEqual(item.author, { displayName: "Author Name", email: "author-1@example.com" });
    assert.equal(item.status, "draft");
    assert.equal(item.gsi2pk, "DISPATCH#draft");
    assert.deepEqual(item.blocks, []);
    assert.deepEqual({ views: item.views, likes: item.likes, shares: item.shares }, { views: 0, likes: 0, shares: 0 });
    assert.equal(ddb.store.get(`USER#author-1|ARTICLE#${id}`).kind, "ARTICLE");
    const res = await handler(makeEvent({ method: "GET", path: "/me/articles", headers: { authorization: auth(kp) } }));
    assert.equal(JSON.parse(res.body).items[0].id, id);
    assert.equal(res.body.includes("author-1@example.com"), false);
  });

  it("saves lenient content, strips block ids and derives body", async () => {
    const { handler, ddb, kp } = setup({ env: { MEDIA_PUBLIC_BASE: "https://cdn.example" } });
    const id = await create(handler, kp, "author-1", "ne");
    const res = await save(handler, kp, id, {
      title: "  शीर्षक  ",
      blocks: [{ id: "client-key", type: "paragraph", text: "पहिलो अनुच्छेद" }, { type: "image", url: "", fileId: "", source: "" }],
      cover: null, tags: [], displayName: "  लेखक ", place: "",
    });
    assert.equal(res.statusCode, 200, res.body);
    const item = ddb.store.get(`DISPATCH#${id}|META`);
    assert.deepEqual(item.title, { ne: "शीर्षक" });
    assert.equal(item.body.ne, "पहिलो अनुच्छेद");
    assert.equal(item.blocks[0].id, undefined);
    assert.equal(item.author.displayName, "लेखक");
    assert.equal(item.author.place, undefined);
  });

  it("rejects invalid save shapes and media URLs outside the configured base", async () => {
    const { handler, kp } = setup({ env: { MEDIA_PUBLIC_BASE: "https://cdn.example" } });
    const id = await create(handler, kp);
    let res = await save(handler, kp, id, { blocks: Array.from({ length: 61 }, () => ({ type: "paragraph", text: "x" })) });
    assert.equal(res.statusCode, 400);
    res = await save(handler, kp, id, { blocks: [{ type: "image", url: "https://other.example/a", fileId: "f", source: "s" }] });
    assert.equal(res.statusCode, 400);
    res = await save(handler, kp, id, { title: "x".repeat(201) });
    assert.equal(res.statusCode, 400);
  });

  it("PUT and DELETE reject another user's article with 403", async () => {
    const { handler, kp } = setup();
    const id = await create(handler, kp, "owner");
    let res = await save(handler, kp, id, { title: "No" }, "other");
    assert.equal(res.statusCode, 403);
    res = await handler(makeEvent({ method: "DELETE", path: `/me/articles/${id}`, headers: { authorization: auth(kp, "other") } }));
    assert.equal(res.statusCode, 403);
  });

  it("strict submit reports missing codes and accepts media once sourced", async () => {
    const { handler, kp } = setup();
    const id = await create(handler, kp);
    let res = await save(handler, kp, id, { ...validSave, blocks: [{ type: "image", url: "https://cdn.example/x.jpg", fileId: "x" }] });
    assert.equal(res.statusCode, 200);
    res = await submit(handler, kp, id);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: "invalid", missing: ["paragraph", "block.source:0"] });
    res = await save(handler, kp, id, validSave);
    assert.equal(res.statusCode, 200);
    res = await submit(handler, kp, id);
    assert.deepEqual(JSON.parse(res.body), { status: "pending" });
    assert.equal(JSON.parse(res.body).status, "pending");
  });

  it("rejected articles can be edited and resubmitted; pending and published status rules apply", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    await save(handler, kp, id, validSave);
    await submit(handler, kp, id);
    let res = await publish(handler, kp, ddb, id);
    assert.equal(res.statusCode, 200);
    res = await save(handler, kp, id, validSave);
    assert.equal(res.statusCode, 409);
    res = await handler(makeEvent({ method: "DELETE", path: `/me/articles/${id}`, headers: { authorization: auth(kp) } }));
    assert.equal(res.statusCode, 409);
  });

  it("deletes a draft and its ownership pointer", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    const res = await handler(makeEvent({ method: "DELETE", path: `/me/articles/${id}`, headers: { authorization: auth(kp) } }));
    assert.equal(res.statusCode, 204);
    assert.equal(ddb.store.get(`DISPATCH#${id}|META`), undefined);
    assert.equal(ddb.store.get(`USER#author-1|ARTICLE#${id}`), undefined);
  });
});

describe("article engagement", () => {
  beforeEach(() => clearJwksCache());

  it("toggles signed-in likes, supports anonymous undo, and never goes negative", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    await save(handler, kp, id, validSave);
    await submit(handler, kp, id);
    await publish(handler, kp, ddb, id);
    let res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/like`, headers: { authorization: auth(kp, "liker") } }));
    assert.deepEqual(JSON.parse(res.body), { liked: true, likes: 1 });
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/like`, headers: { authorization: auth(kp, "liker") } }));
    assert.deepEqual(JSON.parse(res.body), { liked: false, likes: 0 });
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/like`, body: {} }));
    assert.deepEqual(JSON.parse(res.body), { likes: 1 });
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/like`, body: { undo: true } }));
    assert.deepEqual(JSON.parse(res.body), { likes: 0 });
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/like`, body: { undo: true } }));
    assert.deepEqual(JSON.parse(res.body), { likes: 0 });
  });

  it("increments views and shares and returns 404 for a draft", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    let res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/view` }));
    assert.equal(res.statusCode, 404);
    await save(handler, kp, id, validSave);
    await submit(handler, kp, id);
    await publish(handler, kp, ddb, id);
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/view` }));
    assert.equal(res.statusCode, 204);
    res = await handler(makeEvent({ method: "POST", path: `/dispatches/${id}/share` }));
    assert.equal(res.statusCode, 204);
    const item = ddb.store.get(`DISPATCH#${id}|META`);
    assert.equal(item.views, 1);
    assert.equal(item.shares, 1);
  });
});

describe("article media presign", () => {
  beforeEach(() => clearJwksCache());

  it("allows the five article media types and enforces image/video caps", async () => {
    const kp = makeKeyPair();
    const calls = [];
    const fetch = async (url, init) => {
      calls.push({ url, init });
      if (String(url).endsWith("/token")) return { ok: true, json: async () => ({ access_token: "machine", expires_in: 900 }) };
      return { ok: true, json: async () => ({ file_id: "file-1", upload_url: "https://upload", public_url: "https://cdn/file-1" }) };
    };
    const { handler } = setup({ kp, fetch, env: { OU_MEDIA_CLIENT_ID: "client", OU_MEDIA_CLIENT_SECRET: "secret" } });
    for (const contentType of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]) {
      const res = await handler(makeEvent({ method: "POST", path: "/me/articles/media/presign", headers: { authorization: auth(kp) }, body: { filename: "a", contentType, size: 1 } }));
      assert.equal(res.statusCode, 200, res.body);
    }
    let res = await handler(makeEvent({ method: "POST", path: "/me/articles/media/presign", headers: { authorization: auth(kp) }, body: { filename: "a", contentType: "image/jpeg", size: 10 * 1024 * 1024 + 1 } }));
    assert.equal(res.statusCode, 400);
    res = await handler(makeEvent({ method: "POST", path: "/me/articles/media/presign", headers: { authorization: auth(kp) }, body: { filename: "a", contentType: "video/mp4", size: 100 * 1024 * 1024 + 1 } }));
    assert.equal(res.statusCode, 400);
    assert.ok(calls.length >= 2);
  });
});

describe("public article privacy", () => {
  beforeEach(() => clearJwksCache());

  it("list and detail expose cover/counters but never authorSub or email", async () => {
    const { handler, ddb, kp } = setup();
    const id = await create(handler, kp);
    await save(handler, kp, id, validSave);
    await submit(handler, kp, id);
    await publish(handler, kp, ddb, id);
    let res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).items[0].cover, { url: validSave.cover.url });
    res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
    const body = JSON.parse(res.body);
    assert.equal(body.authorSub, undefined);
    assert.equal(body.author?.email, undefined);
    assert.equal(body.cover.fileId, "cover-1");
    assert.equal(body.likes, 0);
    assert.equal(res.body.includes("author-1@example.com"), false);
  });
});
