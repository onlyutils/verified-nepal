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
  return { handler, ddb, kp, env, fetchJwks };
}

function dispatchBody(overrides = {}) {
  const base = {
    title: { en: "Climate story from mountains" },
    body: { en: "This is a valid dispatch body that is long enough to pass validation, at least ten characters and describing community resilience." },
    author: { displayName: "Anita Sharma", place: "Gorkha", email: "anita@example.com" },
    tags: ["climate"],
    language: "en",
  };
  if (overrides.title !== undefined) base.title = overrides.title;
  if (overrides.body !== undefined) base.body = overrides.body;
  if (overrides.author !== undefined) base.author = overrides.author;
  if (overrides.tags !== undefined) base.tags = overrides.tags;
  if (overrides.language !== undefined) base.language = overrides.language;
  if (overrides.turnstileToken !== undefined) base.turnstileToken = overrides.turnstileToken;
  // allow extra overrides merging
  for (const k of Object.keys(overrides)) {
    if (!(k in base)) base[k] = overrides[k];
  }
  return base;
}

async function createDispatch(handler, overrides = {}) {
  const res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody(overrides) }));
  return res;
}

async function modToken(kp, sub, name = "Ram Thapa") {
  return createToken(basePayload({ sub, name, email: "mod@example.com" }), kp.privateKey);
}

describe("Phase4 dispatches", () => {
  beforeEach(() => clearJwksCache());

  describe("POST /dispatches validation", () => {
    it("rejects tags >3, duplicate tags, invalid tag, empty tags", async () => {
      const { handler } = makeHandler();
      // tags >3
      let res = await createDispatch(handler, { tags: ["climate", "mountains", "floods", "community"] });
      assert.equal(res.statusCode, 400);
      let body = JSON.parse(res.body);
      assert.match(body.error, /tags must be <=3/);

      // duplicate tags
      res = await createDispatch(handler, { tags: ["climate", "climate"] });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).error, /unique/);

      // invalid tag
      res = await createDispatch(handler, { tags: ["invalidtag"] });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).error, /tag must be one of/);

      // empty tags
      res = await createDispatch(handler, { tags: [] });
      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.body).error, /non-empty/);

      // missing tags type
      res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: { ...dispatchBody(), tags: "climate" } }));
      assert.equal(res.statusCode, 400);
    });

    it("validates language, title, body, author", async () => {
      const { handler } = makeHandler();
      let res = await createDispatch(handler, { language: "fr" });
      assert.equal(res.statusCode, 400);
      res = await createDispatch(handler, { title: "" });
      assert.equal(res.statusCode, 400);
      res = await createDispatch(handler, { body: "short" });
      assert.equal(res.statusCode, 400);
      res = await createDispatch(handler, { author: { displayName: "", email: "a@b.com" } });
      assert.equal(res.statusCode, 400);
      res = await createDispatch(handler, { author: { displayName: "Name", email: "not-an-email" } });
      assert.equal(res.statusCode, 400);
      res = await createDispatch(handler, { author: { displayName: "Name" } });
      assert.equal(res.statusCode, 400);
    });

    it("accepts valid dispatch and stores pending with gsi2pk pending", async () => {
      const { handler, ddb } = makeHandler();
      const res = await createDispatch(handler, { tags: ["climate", "mountains"] });
      assert.equal(res.statusCode, 201, res.body);
      const { id } = JSON.parse(res.body);
      assert.ok(id);
      const item = ddb.store.get(`DISPATCH#${id}|META`);
      assert.ok(item);
      assert.equal(item.status, "pending");
      assert.equal(item.gsi2pk, "DISPATCH#pending");
      assert.deepEqual(item.tags, ["climate", "mountains"]);
      // ensure email stored but not exposed publicly yet
      assert.equal(item.author.email, "anita@example.com");
    });

    it("rejects tags >3 via string title/body shorthand", async () => {
      const { handler } = makeHandler();
      const payload = dispatchBody({ tags: ["climate", "mountains", "floods", "story"] });
      // use string shorthand for title/body to test __single handling
      payload.title = "A short title";
      payload.body = "A valid body long enough to pass validation ten chars minimum for dispatch.";
      const res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: payload }));
      assert.equal(res.statusCode, 400);
    });
  });

  describe("GET /dispatches public list", () => {
    it("hides pending and never includes author.email", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      // create pending
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody({ tags: ["community"] }) }));
      assert.equal(res.statusCode, 201);
      const { id: pendingId } = JSON.parse(res.body);
      // public list should be empty
      res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
      assert.equal(res.statusCode, 200);
      let body = JSON.parse(res.body);
      assert.equal(body.items.length, 0);
      assert.equal(body.cursor, undefined);

      // publish pending via moderator
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${pendingId}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 200);

      // now public list should have 1 item without email
      res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
      assert.equal(res.statusCode, 200);
      body = JSON.parse(res.body);
      assert.equal(body.items.length, 1);
      const item = body.items[0];
      assert.equal(item.id, pendingId);
      assert.ok(item.title);
      assert.ok(item.excerpt);
      assert.ok(item.author);
      assert.equal(item.author.displayName, "Anita Sharma");
      assert.equal(item.author.email, undefined);
      // ensure raw JSON never contains author.email
      const raw = res.body;
      assert.equal(raw.includes("anita@example.com"), false);
      assert.equal(raw.includes('"email"'), false);
    });

    it("supports tag filter and cursor pagination shape", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      // create 22 dispatches, publish all
      const ids = [];
      for (let i = 0; i < 22; i++) {
        const tag = i % 2 === 0 ? ["climate"] : ["mountains"];
        const res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody({ tags: tag, title: { en: `Title ${i}` }, body: { en: `Body content number ${i} long enough to pass validation for pagination test.` } }) }));
        assert.equal(res.statusCode, 201);
        const { id } = JSON.parse(res.body);
        ids.push(id);
        const pub = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
        assert.equal(pub.statusCode, 200);
      }
      // first page
      let res = await handler(makeEvent({ method: "GET", path: "/dispatches" }));
      assert.equal(res.statusCode, 200);
      let body = JSON.parse(res.body);
      assert.equal(body.items.length, 20);
      assert.ok(body.cursor, "cursor should be present when >20 items");
      assert.equal(typeof body.cursor, "string");
      // second page
      const cursor = body.cursor;
      res = await handler(makeEvent({ method: "GET", path: `/dispatches?cursor=${encodeURIComponent(cursor)}` }));
      assert.equal(res.statusCode, 200);
      body = JSON.parse(res.body);
      assert.equal(body.items.length, 2);
      // shape: each item has id, title, excerpt, tags, author
      for (const it of body.items) {
        assert.ok(it.id);
        assert.ok(it.title);
        assert.ok(Array.isArray(it.tags));
        assert.ok(it.author);
        assert.equal(typeof it.author.displayName, "string");
      }
      // tag filter hides non-matching
      res = await handler(makeEvent({ method: "GET", path: "/dispatches?tag=climate" }));
      assert.equal(res.statusCode, 200);
      body = JSON.parse(res.body);
      assert.ok(body.items.length > 0);
      for (const it of body.items) assert.ok(it.tags.includes("climate"));
    });
  });

  describe("GET /dispatches/:id", () => {
    it("returns 404 for pending, 200 for published with public shape", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
      assert.equal(res.statusCode, 201);
      const { id } = JSON.parse(res.body);
      // pending -> 404
      res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
      assert.equal(res.statusCode, 404);
      // publish
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 200);
      // now 200
      res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.id, id);
      assert.ok(body.title);
      assert.ok(body.body);
      assert.equal(body.author.displayName, "Anita Sharma");
      assert.equal(body.author.email, undefined);
      assert.equal(body.status, "published");
      // never includes email
      assert.equal(res.body.includes("anita@example.com"), false);
    });

    it("returns 404 for non-existent and for rejected", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      let res = await handler(makeEvent({ method: "GET", path: "/dispatches/nonexistent-id" }));
      assert.equal(res.statusCode, 404);
      // create and reject
      res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
      const { id } = JSON.parse(res.body);
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "reject", reason: "spam content" } }));
      assert.equal(res.statusCode, 200);
      res = await handler(makeEvent({ method: "GET", path: `/dispatches/${id}` }));
      assert.equal(res.statusCode, 404);
    });
  });

  describe("moderation dispatches", () => {
    it("publish and reject with reason + AUDIT write", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      // create two dispatches
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody({ title: { en: "Publish me" } }) }));
      const { id: pubId } = JSON.parse(res.body);
      res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody({ title: { en: "Reject me" } }) }));
      const { id: rejId } = JSON.parse(res.body);

      // publish
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${pubId}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), { status: "published" });
      let stored = ddb.store.get(`DISPATCH#${pubId}|META`);
      assert.equal(stored.status, "published");
      assert.ok(stored.publishedAt);
      assert.equal(stored.gsi2pk, "DISPATCH#published");
      let audits = Array.from(ddb.store.values()).filter(v => v.PK && v.PK.startsWith("AUDIT#") && v.targetId === pubId);
      assert.ok(audits.length >= 1);
      let audit = audits.find(a => a.action === "publish");
      assert.ok(audit);
      assert.equal(audit.targetType, "DISPATCH");
      assert.equal(audit.actorName, "Ram Thapa");
      assert.equal(audit.actorSub, "mod-1");
      assert.ok(audit.targetLabel.length > 0);

      // reject with reason
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${rejId}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "reject", reason: "needs more sources" } }));
      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), { status: "rejected" });
      stored = ddb.store.get(`DISPATCH#${rejId}|META`);
      assert.equal(stored.status, "rejected");
      assert.equal(stored.rejectionReason, "needs more sources");
      assert.equal(stored.gsi2pk, "DISPATCH#rejected");
      audits = Array.from(ddb.store.values()).filter(v => v.PK && v.PK.startsWith("AUDIT#") && v.targetId === rejId);
      audit = audits.find(a => a.action === "reject");
      assert.ok(audit);
      assert.equal(audit.reason, "needs more sources");
      assert.equal(audit.targetType, "DISPATCH");
      assert.equal(audit.actorName, "Ram Thapa");
    });

    it("reject stores reason and audit reason, handles empty reason", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const tok = await modToken(kp, "mod-1", "Ram Thapa");
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
      const { id } = JSON.parse(res.body);
      // reject without reason (allowed per implementation)
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "reject" } }));
      assert.equal(res.statusCode, 200);
      const stored = ddb.store.get(`DISPATCH#${id}|META`);
      assert.equal(stored.status, "rejected");
      // audit without reason is okay
      const audits = Array.from(ddb.store.values()).filter(v => v.PK && v.PK.startsWith("AUDIT#") && v.targetId === id);
      assert.ok(audits.length >= 1);
    });
  });

  describe("role gate 403", () => {
    it("helper cannot moderate, unauthenticated cannot moderate", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      // create dispatch
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
      const { id } = JSON.parse(res.body);
      // store helper user
      ddb.store.set("USER#helper-1|PROFILE", { PK: "USER#helper-1", SK: "PROFILE", sub: "helper-1", role: "helper", name: "Helper User", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#helper", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const helperTok = createToken(basePayload({ sub: "helper-1", name: "Helper User", email: "helper@example.com" }), kp.privateKey);
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${helperTok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 403);

      // unauthenticated
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, body: { action: "publish" } }));
      assert.equal(res.statusCode, 401);

      // moderator without guidelinesAck should get 403
      ddb.store.set("USER#mod-noack|PROFILE", { PK: "USER#mod-noack", SK: "PROFILE", sub: "mod-noack", role: "moderator", name: "NoAck Mod", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      const noAckTok = createToken(basePayload({ sub: "mod-noack", name: "NoAck Mod", email: "noack@example.com" }), kp.privateKey);
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${noAckTok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 403);
      assert.match(JSON.parse(res.body).error, /guidelines_not_acknowledged/);

      // also GET moderation dispatches requires mod
      res = await handler(makeEvent({ method: "GET", path: "/moderation/dispatches", headers: { authorization: `Bearer ${helperTok}` } }));
      assert.equal(res.statusCode, 403);
    });

    it("admin can moderate without guidelinesAck", async () => {
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const { handler } = makeHandler({ kp, ddb });
      ddb.store.set("USER#admin-1|PROFILE", { PK: "USER#admin-1", SK: "PROFILE", sub: "admin-1", role: "admin", name: "Admin User", districts: [], gsi2pk: "USER#admin", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
      const { id } = JSON.parse(res.body);
      const adminTok = createToken(basePayload({ sub: "admin-1", name: "Admin User", email: "admin@example.com" }), kp.privateKey);
      res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${adminTok}` }, body: { action: "publish" } }));
      assert.equal(res.statusCode, 200);
    });
  });

  describe("cursor pagination shape", () => {
    it("returns { items, cursor? } and cursor is base64url PK/SK", async () => {
      const { handler } = makeHandler();
      const kp = makeKeyPair();
      const ddb = new FakeDdb();
      const h2 = makeHandler({ kp, ddb }).handler;
      ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Ram Thapa", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
      // Use h2 for actual dispatches
      const res = await h2(makeEvent({ method: "GET", path: "/dispatches" }));
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.items));
      // when empty, no cursor
      if (body.items.length === 0) assert.equal(body.cursor, undefined);
      // cursor if present should be valid base64url JSON with PK/SK
      if (body.cursor) {
        const decoded = JSON.parse(Buffer.from(body.cursor, "base64url").toString("utf8"));
        assert.ok(decoded.PK);
        assert.ok(decoded.SK);
      }
    });

    it("invalid cursor returns 400", async () => {
      const { handler } = makeHandler();
      const res = await handler(makeEvent({ method: "GET", path: "/dispatches?cursor=invalid" }));
      assert.equal(res.statusCode, 400);
    });
  });
});

describe("GET /audit privacy", () => {
  beforeEach(() => clearJwksCache());

  it("legacy email actor is masked in /audit output and empty targetLabel -> —", async () => {
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ ddb });
    const month = new Date().toISOString().slice(0, 7);
    const ts = new Date().toISOString();
    // legacy item stored with raw email
    ddb.store.set(`AUDIT#${month}|${ts}#legacy#abc`, {
      PK: `AUDIT#${month}`,
      SK: `${ts}#legacy#abc`,
      type: "AUDIT",
      actorName: "olduser@gmail.com",
      action: "publish",
      targetType: "DISPATCH",
      targetId: "some-id",
      targetLabel: "",
      ts,
      createdAt: ts,
    });
    // empty actorName
    const ts2 = new Date(Date.now() + 1000).toISOString();
    ddb.store.set(`AUDIT#${month}|${ts2}#empty#def`, {
      PK: `AUDIT#${month}`,
      SK: `${ts2}#empty#def`,
      type: "AUDIT",
      actorName: "",
      action: "publish",
      targetType: "DISPATCH",
      targetId: "id2",
      targetLabel: "Valid Label",
      ts: ts2,
      createdAt: ts2,
    });
    // item with actorEmail legacy field
    const ts3 = new Date(Date.now() + 2000).toISOString();
    ddb.store.set(`AUDIT#${month}|${ts3}#email#ghi`, {
      PK: `AUDIT#${month}`,
      SK: `${ts3}#email#ghi`,
      type: "AUDIT",
      actorEmail: "another@yahoo.com",
      action: "publish",
      targetType: "DISPATCH",
      targetId: "id3",
      targetLabel: "",
      ts: ts3,
      createdAt: ts3,
    });

    const res = await handler(makeEvent({ method: "GET", path: `/audit?month=${month}` }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.items.length, 3);
    const legacy = body.items.find(i => i.actorName === "o***@gmail.com");
    assert.ok(legacy);
    assert.equal(legacy.targetLabel, "—");

    const emptyActor = body.items.find(i => i.actorName === "Moderator" && i.targetLabel === "Valid Label");
    assert.ok(emptyActor);

    const emailField = body.items.find(i => i.actorName === "a***@yahoo.com");
    assert.ok(emailField);
    assert.equal(emailField.targetLabel, "—");
  });

  it("a new publish action records the display name (USER name) not email", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Sita Karki", email: "sita.karki@example.com", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    // create dispatch
    let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody({ title: { en: "Test Dispatch Publish Audit" } }) }));
    assert.equal(res.statusCode, 201);
    const { id } = JSON.parse(res.body);
    const tok = createToken(basePayload({ sub: "mod-1", name: "Sita Karki", email: "sita.karki@example.com" }), kp.privateKey);
    res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);

    // check stored AUDIT directly
    const audits = Array.from(ddb.store.values()).filter(v => v.PK && v.PK.startsWith("AUDIT#") && v.targetId === id);
    assert.ok(audits.length >= 1);
    const audit = audits[0];
    assert.equal(audit.actorName, "Sita Karki");
    assert.equal(audit.actorName.includes("@"), false);

    // check via public GET /audit
    const month = new Date().toISOString().slice(0, 7);
    res = await handler(makeEvent({ method: "GET", path: `/audit?month=${month}` }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const pub = body.items.find(i => i.targetLabel === "Test Dispatch Publish Audit" && i.actorName === "Sita Karki");
    assert.ok(pub);
  });

  it("the public /audit JSON never contains an '@' unless masked with '***'", async () => {
    const kp = makeKeyPair();
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ kp, ddb });
    ddb.store.set("USER#mod-1|PROFILE", { PK: "USER#mod-1", SK: "PROFILE", sub: "mod-1", role: "moderator", name: "Moderator Name", email: "mod@example.com", guidelinesAckAt: "2026-01-01T00:00:00.000Z", districts: [], gsi2pk: "USER#moderator", gsi2sk: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
    const month = new Date().toISOString().slice(0, 7);
    // insert legacy email audit that should be masked
    const tsLegacy = new Date(Date.now() - 1000).toISOString();
    ddb.store.set(`AUDIT#${month}|${tsLegacy}#leg#123`, {
      PK: `AUDIT#${month}`,
      SK: `${tsLegacy}#leg#123`,
      type: "AUDIT",
      actorName: "legacy@example.com",
      action: "publish",
      targetType: "DISPATCH",
      targetId: "legacy-id",
      targetLabel: "Test",
      ts: tsLegacy,
      createdAt: tsLegacy,
    });
    // create and publish a dispatch to generate a clean audit
    let res = await handler(makeEvent({ method: "POST", path: "/dispatches", body: dispatchBody() }));
    const { id } = JSON.parse(res.body);
    const tok = createToken(basePayload({ sub: "mod-1", name: "Moderator Name", email: "mod@example.com" }), kp.privateKey);
    res = await handler(makeEvent({ method: "POST", path: `/moderation/dispatches/${id}`, headers: { authorization: `Bearer ${tok}` }, body: { action: "publish" } }));
    assert.equal(res.statusCode, 200);

    res = await handler(makeEvent({ method: "GET", path: `/audit?month=${month}` }));
    assert.equal(res.statusCode, 200);
    const raw = res.body;
    // find all @ occurrences and ensure they are part of masked pattern ***@
    // If raw contains @, split and verify preceding chars contain ***
    const atCount = (raw.match(/@/g) || []).length;
    const maskedCount = (raw.match(/\*\*\*@/g) || []).length;
    // Every @ should be part of a masked ***@ sequence
    assert.equal(atCount, maskedCount, `raw audit JSON contains unmasked @: ${raw}`);
    // Also ensure actorName never equals raw email
    const body = JSON.parse(raw);
    for (const it of body.items) {
      if (it.actorName.includes("@")) {
        assert.match(it.actorName, /^\w\*\*\*@.+\..+$/, `actorName not properly masked: ${it.actorName}`);
      }
    }
  });

  it("empty actorName from audit entry becomes Moderator and targetLabel empty becomes —", async () => {
    const ddb = new FakeDdb();
    const { handler } = makeHandler({ ddb });
    const month = new Date().toISOString().slice(0, 7);
    const ts = new Date().toISOString();
    ddb.store.set(`AUDIT#${month}|${ts}#empty#xyz`, {
      PK: `AUDIT#${month}`,
      SK: `${ts}#empty#xyz`,
      type: "AUDIT",
      actorName: "   ",
      action: "publish",
      targetType: "DISPATCH",
      targetId: "empty-test",
      targetLabel: "   ",
      ts,
      createdAt: ts,
    });
    const res = await handler(makeEvent({ method: "GET", path: `/audit?month=${month}` }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const item = body.items.find(i => i.actorName === "Moderator" && i.targetLabel === "—");
    assert.ok(item);
  });
});
