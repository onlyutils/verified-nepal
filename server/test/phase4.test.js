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
  return { handler: createHandler({ env, ddbClient: ddb, fetchJwks, fetch: opts.fetch }), ddb, kp, env };
}

function token(kp, sub, name = "Article Author", email = `${sub}@example.com`) {
  return createToken(basePayload({ sub, name, email }), kp.privateKey);
}

function profile(sub, role = "helper", name = "Article Author") {
  return { PK: `USER#${sub}`, SK: "PROFILE", sub, role, name, districts: [], createdAt: "2026-01-01T00:00:00.000Z", gsi2pk: `USER#${role}`, gsi2sk: "2026-01-01T00:00:00.000Z" };
}

async function createSubmittedArticle(handler, kp, sub = "author-1", overrides = {}) {
  const tok = token(kp, sub);
  let res = await handler(makeEvent({ method: "POST", path: "/me/articles", headers: { authorization: `Bearer ${tok}` }, body: { language: "en" } }));
  assert.equal(res.statusCode, 201, res.body);
  const { id } = JSON.parse(res.body);
  const save = {
    title: overrides.title ?? "A published article",
    blocks: overrides.blocks ?? [{ type: "paragraph", text: "A paragraph that is long enough to be a valid article." }],
    cover: overrides.cover ?? { url: "https://cdn.example/cover.jpg", fileId: "cover-1", source: "Author" },
    tags: overrides.tags ?? ["story"],
    displayName: "Author Name",
    place: "Kathmandu",
  };
  res = await handler(makeEvent({ method: "PUT", path: `/me/articles/${id}`, headers: { authorization: `Bearer ${tok}` }, body: save }));
  assert.equal(res.statusCode, 200, res.body);
  res = await handler(makeEvent({ method: "POST", path: `/me/articles/${id}/submit`, headers: { authorization: `Bearer ${tok}` } }));
  assert.equal(res.statusCode, 200, res.body);
  return { id, tok };
}

async function moderate(handler, kp, id, action, reason) {
  const tok = token(kp, "mod-1", "Ram Thapa", "mod@example.com");
  return handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action, ...(reason ? { reason } : {}) } }));
}

describe("Phase4 dispatches", () => {
  beforeEach(() => clearJwksCache());

  it("removes anonymous article creation", async () => {
    const { handler } = makeHandler();
    const res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: {} }));
    assert.equal(res.statusCode, 404);
  });

  it("public list hides pending articles and never exposes author email", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    const { id } = await createSubmittedArticle(handler, kp);
    let res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
    assert.deepEqual(JSON.parse(res.body).items, []);
    ddb.store.set("USER#mod-1|PROFILE", { ...profile("mod-1", "moderator", "Ram Thapa"), guidelinesAckAt: "now" });
    res = await moderate(handler, kp, id, "publish");
    assert.equal(res.statusCode, 200);
    res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
    const item = JSON.parse(res.body).items[0];
    assert.equal(item.id, id);
    assert.deepEqual(item.cover, { url: "https://cdn.example/cover.jpg" });
    assert.deepEqual({ views: item.views, likes: item.likes, shares: item.shares }, { views: 0, likes: 0, shares: 0 });
    assert.equal(item.author.email, undefined);
    assert.equal(res.body.includes("author-1@example.com"), false);
  });

  it("public detail returns blocks, cover and counters only after publish", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    const { id } = await createSubmittedArticle(handler, kp);
    let res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
    assert.equal(res.statusCode, 404);
    ddb.store.set("USER#mod-1|PROFILE", { ...profile("mod-1", "moderator", "Ram Thapa"), guidelinesAckAt: "now" });
    await moderate(handler, kp, id, "publish");
    res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.author.email, undefined);
    assert.equal(body.blocks[0].type, "paragraph");
    assert.equal(body.cover.source, "Author");
    assert.equal(body.views, 0);
  });

  it("moderation publish and reject preserve audit behavior and store rejectReason", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { ...profile("mod-1", "moderator", "Ram Thapa"), guidelinesAckAt: "2026-01-01T00:00:00.000Z" });
    const first = await createSubmittedArticle(handler, kp, "author-1", { title: "Publish me" });
    const second = await createSubmittedArticle(handler, kp, "author-2", { title: "Reject me" });
    let res = await moderate(handler, kp, first.id, "publish");
    assert.equal(res.statusCode, 200);
    res = await moderate(handler, kp, second.id, "reject", "needs more sources");
    assert.equal(res.statusCode, 200);
    const rejected = ddb.store.get(`DISPATCH#${second.id}|META`);
    assert.equal(rejected.rejectReason, "needs more sources");
    assert.equal(rejected.rejectionReason, undefined);
    const audit = Array.from(ddb.store.values()).find((item) => item.targetId === second.id && item.action === "reject");
    assert.equal(audit.reason, "needs more sources");
  });

  it("moderation role and guideline gates remain enforced", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    const { id } = await createSubmittedArticle(handler, kp);
    ddb.store.set("USER#helper-1|PROFILE", profile("helper-1"));
    let res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${token(kp, "helper-1")}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 403);
    ddb.store.set("USER#mod-1|PROFILE", profile("mod-1", "moderator", "Mod"));
    res = await moderate(handler, kp, id, "publish");
    assert.equal(res.statusCode, 403);
  });

  it("keeps cursor pagination shape for published articles", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { ...profile("mod-1", "moderator", "Mod"), guidelinesAckAt: "now" });
    for (let i = 0; i < 22; i++) {
      const article = await createSubmittedArticle(handler, kp, `author-${i}`, { title: `Title ${i}`, tags: [i % 2 ? "mountains" : "climate"] });
      const res = await moderate(handler, kp, article.id, "publish");
      assert.equal(res.statusCode, 200);
    }
    let res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
    const first = JSON.parse(res.body);
    assert.equal(first.items.length, 20);
    assert.ok(first.cursor);
    res = await handler(makeEvent({ method: "GET", path: `/dispatches?cursor=${encodeURIComponent(first.cursor)}` }));
    assert.equal(JSON.parse(res.body).items.length, 2);
  });
});

describe("GET /audit privacy", () => {
  beforeEach(() => clearJwksCache());

  it("a publish audit records moderator display name rather than email", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { ...profile("mod-1", "moderator", "Sita Karki"), guidelinesAckAt: "2026-01-01T00:00:00.000Z" });
    const { id } = await createSubmittedArticle(handler, kp, "author-1", { title: "Audit article" });
    const res = await moderate(handler, kp, id, "publish");
    assert.equal(res.statusCode, 200);
    const audit = Array.from(ddb.store.values()).find((item) => item.targetId === id && item.action === "publish");
    assert.equal(audit.actorName, "Sita Karki");
    assert.equal(audit.actorName.includes("@"), false);
  });
});
