// server/test/local-updates.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLocality, validateScope, validateSourceUrls, validateHappenedAt } from "../src/lib/validate.js";

describe("local updates validators", () => {
  it("accepts a municipality inside its district with a valid ward", () => {
    // 69001 = Bannigadhi Jayagadh, Achham, 6 wards (admin-units.json)
    assert.deepEqual(validateLocality({ district: "Achham", municipalityId: 69001, ward: 4 }), {
      district: "Achham",
      municipalityId: 69001,
      ward: 4,
    });
    assert.deepEqual(validateLocality({ district: "Achham", municipalityId: "69001" }), { district: "Achham", municipalityId: 69001 });
  });
  it("rejects a ward above the municipality's ward count and a municipality outside the district", () => {
    assert.throws(() => validateLocality({ district: "Achham", municipalityId: 69001, ward: 7 }), /ward/);
    assert.throws(() => validateLocality({ district: "Kathmandu", municipalityId: 69001 }), /municipality/);
    assert.throws(() => validateLocality({ district: "Nowhere", municipalityId: 69001 }), /district/);
  });
  it("returns undefined for null when optional and throws when required", () => {
    assert.equal(validateLocality(null, { required: false }), undefined);
    assert.throws(() => validateLocality(null, { required: true }), /locality/);
  });
  it("validates scope, sources and happenedAt", () => {
    assert.equal(validateScope("ward"), "ward");
    assert.throws(() => validateScope("galaxy"), /scope/);
    assert.deepEqual(validateSourceUrls(["https://a.example/x", " https://b.example/y "]), ["https://a.example/x", "https://b.example/y"]);
    assert.throws(() => validateSourceUrls(["http://a.example"]), /https/);
    assert.throws(() => validateSourceUrls(["https://1", "https://2", "https://3", "https://4"]), /3/);
    assert.equal(validateHappenedAt("2026-10-14T06:00:00.000Z"), "2026-10-14T06:00:00.000Z");
    assert.throws(() => validateHappenedAt("yesterday"), /happenedAt/);
    assert.throws(() => validateHappenedAt(new Date(Date.now() + 48 * 3600 * 1000).toISOString()), /future/);
  });
});

// append to server/test/local-updates.test.js
import { dispatchKind, applyPublishKeys, localityGsiKey } from "../src/models/dispatch.js";
import { toPublicDispatchListItem, toPublicDispatchDetail } from "../src/views/dispatch.js";

describe("dispatch model: kind and locality keys", () => {
  it("treats a missing kind as article", () => {
    assert.equal(dispatchKind({}), "article");
    assert.equal(dispatchKind({ kind: "news" }), "news");
  });
  it("sets publish and locality keys without inventing an expiry", () => {
    const now = "2026-10-14T06:00:00.000Z";
    const article = { kind: "article", status: "pending" };
    applyPublishKeys(article, now);
    assert.equal(article.gsi1pk, undefined);
    const news = { kind: "news", happenedAt: "2026-10-13T06:00:00.000Z", locality: { district: "Achham", municipalityId: 69001, ward: 4 } };
    applyPublishKeys(news, now);
    assert.equal(news.gsi1pk, localityGsiKey("Achham"));
    assert.equal(news.gsi1sk, now);
    assert.equal(news.expiresAt, undefined);
    news.expiresAt = "2026-10-12T06:00:00.000Z";
    applyPublishKeys(news, now);
    assert.equal(news.expiresAt, "2026-10-12T06:00:00.000Z");
    assert.equal(news.status, "published");
    assert.equal(news.gsi2pk, "DISPATCH#published");
  });
  it("exposes locality fields in public views and never the author email", () => {
    const item = {
      id: "n1",
      kind: "news",
      language: "ne",
      scope: "ward",
      title: { ne: "शीर्षक" },
      body: { ne: "पाठ" },
      author: { displayName: "Sita", email: "x@y" },
      locality: { district: "Achham", municipalityId: 69001, ward: 4 },
      happenedAt: "2026-10-13T06:00:00.000Z",
      sourceNote: "वडा कार्यालयको सूचना",
      sourceUrls: ["https://a.example"],
      tags: ["community"],
      status: "published",
    };
    const list = toPublicDispatchListItem(item);
    assert.equal(list.kind, "news");
    assert.deepEqual(list.locality, item.locality);
    assert.equal(list.scope, "ward");
    assert.equal(JSON.stringify(list).includes("x@y"), false);
    const detail = toPublicDispatchDetail(item);
    assert.deepEqual(detail.sourceUrls, ["https://a.example"]);
    assert.equal(detail.language, "ne");
    assert.equal(list.sourceNote, item.sourceNote);
    assert.equal(detail.sourceNote, item.sourceNote);
  });
});

// append to server/test/local-updates.test.js
import { beforeEach } from "node:test";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

function setup() {
  const kp = makeKeyPair();
  const ddb = new FakeDdb();
  const handler = createHandler({
    env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" },
    ddbClient: ddb,
    fetchJwks: async () => ({ keys: [kp.jwk] }),
  });
  return { handler, ddb, kp };
}
const bearer = (kp, sub, extra = {}) =>
  `Bearer ${createToken(basePayload({ sub, name: "Name", email: `${sub}@example.com`, ...extra }), kp.privateKey)}`;
function seedReporter(ddb, sub, localities = [{ district: "Achham", municipalityId: 69001, ward: 4 }]) {
  ddb.store.set(`USER#${sub}|PROFILE`, {
    PK: `USER#${sub}`,
    SK: "PROFILE",
    role: "helper",
    name: "Rep",
    email: `${sub}@example.com`,
    districts: [],
    reporter: { localities, nationalScope: false, approvedAt: "2026-10-01T00:00:00.000Z", recentSubmits: [] },
  });
}
function seedMod(ddb, sub, extra = {}) {
  ddb.store.set(`USER#${sub}|PROFILE`, {
    PK: `USER#${sub}`,
    SK: "PROFILE",
    role: "moderator",
    name: "Mod",
    email: `${sub}@example.com`,
    guidelinesAckAt: "now",
    districts: [],
    ...extra,
  });
}
const LOC = { district: "Achham", municipalityId: 69001, ward: 4 };
const validNews = {
  title: "Bridge closed",
  blocks: [{ type: "paragraph", text: "The Karnali footbridge is closed after last night's rain." }],
  tags: ["community"],
  locality: LOC,
  scope: "ward",
  happenedAt: "2026-10-13T06:00:00.000Z",
  sourceUrls: [],
  sourceNote: "Ward 4 office notice, 13 Oct",
};

async function createNews(handler, kp, sub = "rep-1") {
  const res = await handler(
    makeEvent({
      method: "POST",
      path: "/me/articles",
      headers: { authorization: bearer(kp, sub) },
      body: { language: "ne", kind: "news", happenedAt: validNews.happenedAt, sourceNote: validNews.sourceNote },
    }),
  );
  return res;
}

describe("news authoring", () => {
  beforeEach(() => clearJwksCache());

  it("refuses news from a non-correspondent and allows an approved one", async () => {
    const { handler, ddb, kp } = setup();
    const denied = await createNews(handler, kp, "helper-1");
    assert.equal(denied.statusCode, 403);
    assert.equal(JSON.parse(denied.body).error, "reporter_required");
    seedReporter(ddb, "rep-1");
    const ok = await createNews(handler, kp);
    assert.equal(ok.statusCode, 201, ok.body);
    const item = ddb.store.get(`DISPATCH#${JSON.parse(ok.body).id}|META`);
    assert.equal(item.kind, "news");
    assert.deepEqual(item.locality, LOC); // prefilled from the correspondent's first locality
  });

  it("validates news on submit: body length, block types, tag count, locality", async () => {
    const { handler, ddb, kp } = setup();
    seedReporter(ddb, "rep-1");
    const id = JSON.parse((await createNews(handler, kp)).body).id;
    const put = (body) =>
      handler(makeEvent({ method: "PUT", path: `/me/articles/${id}`, headers: { authorization: bearer(kp, "rep-1") }, body }));
    const submit = () =>
      handler(makeEvent({ method: "POST", path: `/me/articles/${id}/submit`, headers: { authorization: bearer(kp, "rep-1") } }));
    assert.equal((await put({ ...validNews, blocks: [{ type: "paragraph", text: "x".repeat(1201) }] })).statusCode, 200);
    assert.deepEqual(JSON.parse((await submit()).body).missing, ["body"]);
    assert.equal((await put({ ...validNews, blocks: [{ type: "heading", text: "H" }, ...validNews.blocks] })).statusCode, 200);
    assert.deepEqual(JSON.parse((await submit()).body).missing, ["blocks"]);
    assert.equal((await put({ ...validNews, tags: ["community", "floods"] })).statusCode, 200);
    assert.deepEqual(JSON.parse((await submit()).body).missing, ["tags"]);
    assert.equal((await put({ ...validNews, locality: null })).statusCode, 200);
    assert.deepEqual(JSON.parse((await submit()).body).missing, ["locality"]);
    assert.equal((await put({ ...validNews, locality: { ...LOC, ward: 99 } })).statusCode, 400);
    assert.equal((await put(validNews)).statusCode, 200);
    const ok = await submit();
    assert.equal(ok.statusCode, 200, ok.body);
    assert.equal(ddb.store.get(`DISPATCH#${id}|META`).status, "pending");
  });

  it("lists news separately from articles, publicly and on the Desk", async () => {
    const { handler, ddb, kp } = setup();
    seedReporter(ddb, "rep-1");
    seedMod(ddb, "mod-1");
    const id = JSON.parse((await createNews(handler, kp)).body).id;
    await handler(
      makeEvent({ method: "PUT", path: `/me/articles/${id}`, headers: { authorization: bearer(kp, "rep-1") }, body: validNews }),
    );
    await handler(makeEvent({ method: "POST", path: `/me/articles/${id}/submit`, headers: { authorization: bearer(kp, "rep-1") } }));
    const deskArticles = JSON.parse(
      (await handler(makeEvent({ method: "GET", path: "/moderation/dispatches", headers: { authorization: bearer(kp, "mod-1") } }))).body,
    );
    assert.equal(deskArticles.items.length, 0);
    const deskNews = JSON.parse(
      (
        await handler(
          makeEvent({
            method: "GET",
            path: "/moderation/dispatches",
            queryStringParameters: { kind: "news" },
            headers: { authorization: bearer(kp, "mod-1") },
          }),
        )
      ).body,
    );
    assert.equal(deskNews.items.length, 1);
    assert.equal(deskNews.items[0].kind, "news");
    const pub = await handler(
      makeEvent({
        method: "POST",
        path: `/moderation/dispatches/${id}`,
        headers: { authorization: bearer(kp, "mod-1") },
        body: { action: "publish" },
      }),
    );
    assert.equal(pub.statusCode, 200, pub.body);
    const articles = JSON.parse((await handler(makeEvent({ method: "GET", path: "/dispatches" }))).body);
    assert.equal(articles.items.length, 0);
    const news = JSON.parse(
      (await handler(makeEvent({ method: "GET", path: "/dispatches", queryStringParameters: { kind: "news" } }))).body,
    );
    assert.equal(news.items.length, 1);
    assert.equal(news.items[0].locality.municipalityId, 69001);
    assert.equal(news.items[0].expiresAt, undefined);
  });
});

import { validateSourceNote } from "../src/lib/validate.js";
import { queryLocalDispatches, queryNationalNews } from "../src/models/dispatch.js";

function seedAdmin(ddb, sub = "admin-1") {
  seedMod(ddb, sub, { role: "admin" });
}

function request(ctx, method, path, body, sub) {
  return ctx.handler(makeEvent({ method, path, body, ...(sub ? { headers: { authorization: bearer(ctx.kp, sub) } } : {}) }));
}

async function draft(ctx, sub = "rep-1", extra = {}) {
  const res = await request(ctx, "POST", "/me/articles", { language: "ne", kind: "news", ...validNews, ...extra }, sub);
  assert.equal(res.statusCode, 201, res.body);
  return JSON.parse(res.body).id;
}

async function pending(ctx, sub = "rep-1", extra = {}) {
  const id = await draft(ctx, sub, extra);
  const res = await request(ctx, "POST", `/me/articles/${id}/submit`, undefined, sub);
  assert.equal(res.statusCode, 200, res.body);
  return id;
}

function seedDispatch(ddb, id, options = {}) {
  const { kind = "news", status = "published", createdAt = "2026-10-01T00:00:00.000Z", sub = "rep-1", ...extra } = options;
  const item = {
    PK: `DISPATCH#${id}`,
    SK: "META",
    type: "DISPATCH",
    id,
    kind,
    status,
    authorSub: sub,
    createdAt,
    gsi2pk: `DISPATCH#${status}`,
    gsi2sk: createdAt,
    tags: ["community"],
    ...extra,
  };
  if (Object.hasOwn(options, "kind") && options.kind === undefined) delete item.kind;
  ddb.store.set(`${item.PK}|META`, item);
  ddb.store.set(`USER#${sub}|ARTICLE#${id}`, { PK: `USER#${sub}`, SK: `ARTICLE#${id}`, type: "MINE", kind: "ARTICLE", id, sub, createdAt });
  return item;
}

describe("local update amendments", () => {
  beforeEach(() => clearJwksCache());

  it("accepts a trimmed single source line and rejects invalid notes and URLs", () => {
    assert.equal(validateSourceNote("  वडा कार्यालयको सूचना  "), "वडा कार्यालयको सूचना");
    assert.equal(validateSourceNote(" "), undefined);
    for (const note of [123, {}, "x".repeat(201), "notice\nsecond line"]) assert.throws(() => validateSourceNote(note), { status: 400 });
    for (const urls of [["https://"], ["https://user:pass@example.com"], [42], "https://example.com"])
      assert.throws(() => validateSourceUrls(urls), { status: 400 });
    assert.equal(validateScope("national"), "national");
    assert.equal(validateScope("province"), "province");
  });

  it("requires happenedAt and a source on create and reports named missing fields without writing a dispatch", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    for (const [body, missing] of [
      [{ ...validNews, happenedAt: undefined }, "happenedAt"],
      [{ ...validNews, sourceNote: undefined }, "source"],
      [{ ...validNews, sourceNote: "   " }, "source"],
      [{ ...validNews, blocks: [{ type: "paragraph", text: "x".repeat(1201) }] }, "body"],
      [{ ...validNews, blocks: [{ type: "paragraph", text: "x".repeat(5001) }] }, "body"],
    ]) {
      const res = await request(ctx, "POST", "/me/articles", { language: "ne", kind: "news", ...body }, "admin-1");
      assert.equal(res.statusCode, 400, res.body);
      assert.ok([JSON.parse(res.body).missing].flat().includes(missing), res.body);
    }
    assert.equal([...ctx.ddb.store.values()].filter((it) => it.type === "DISPATCH").length, 0);
  });

  it("creates complete source-note-only or linked drafts, exposes owner fields and keeps drafts private", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    const expiry = "2026-10-01T00:00:00.000Z";
    for (const extra of [{ expiresAt: expiry }, { sourceNote: undefined, sourceUrls: ["https://www.opmcm.gov.np/"] }]) {
      const id = await draft(ctx, "admin-1", extra);
      const detail = JSON.parse((await request(ctx, "GET", `/me/articles/${id}`, undefined, "admin-1")).body);
      assert.equal(detail.kind, "news");
      assert.equal(detail.title, validNews.title);
      assert.equal(detail.happenedAt, validNews.happenedAt);
      assert.deepEqual(detail.locality, LOC);
      assert.deepEqual(detail.blocks, validNews.blocks);
      assert.equal(detail.sourceNote, extra.sourceUrls ? undefined : validNews.sourceNote);
      assert.equal(detail.expiresAt, extra.expiresAt);
      assert.equal((await request(ctx, "GET", `/dispatches/${id}`)).statusCode, 404);
      const list = JSON.parse((await request(ctx, "GET", "/me/articles", undefined, "admin-1")).body).items;
      assert.equal(list.find((it) => it.id === id).kind, "news");
    }
  });

  it("prevents changing kind and validates optional article locality", async () => {
    const ctx = setup();
    seedReporter(ctx.ddb, "rep-1");
    const id = await draft(ctx);
    assert.equal((await request(ctx, "PUT", `/me/articles/${id}`, { kind: "article" }, "rep-1")).statusCode, 400);
    const article = await request(ctx, "POST", "/me/articles", { language: "en" }, "rep-1");
    const aid = JSON.parse(article.body).id;
    assert.equal((await request(ctx, "PUT", `/me/articles/${aid}`, { kind: "news" }, "rep-1")).statusCode, 400);
    assert.equal((await request(ctx, "PUT", `/me/articles/${aid}`, { locality: LOC }, "rep-1")).statusCode, 200);
    assert.equal((await request(ctx, "PUT", `/me/articles/${aid}`, { locality: { ...LOC, ward: 7 } }, "rep-1")).statusCode, 400);
    assert.deepEqual(ctx.ddb.store.get(`DISPATCH#${aid}|META`).locality, LOC);
    assert.equal((await request(ctx, "POST", "/me/articles", { language: "en", kind: "other" }, "rep-1")).statusCode, 400);
  });

  it("rechecks source, happenedAt, forbidden blocks and image attribution at submit", async () => {
    const ctx = setup();
    seedReporter(ctx.ddb, "rep-1");
    const id = await draft(ctx);
    const item = ctx.ddb.store.get(`DISPATCH#${id}|META`);
    delete item.happenedAt;
    delete item.sourceNote;
    item.sourceUrls = [];
    ctx.ddb.store.set(`DISPATCH#${id}|META`, item);
    let res = await request(ctx, "POST", `/me/articles/${id}/submit`, undefined, "rep-1");
    assert.deepEqual(JSON.parse(res.body).missing, ["happenedAt", "source"]);
    for (const block of [
      { type: "quote", text: "quote" },
      { type: "video", url: "https://cdn.example/video", fileId: "v", source: "Office" },
      { type: "image", url: "https://cdn.example/image", fileId: "i", source: "" },
    ]) {
      assert.equal(
        (await request(ctx, "PUT", `/me/articles/${id}`, { ...validNews, blocks: [...validNews.blocks, block] }, "rep-1")).statusCode,
        200,
      );
      res = await request(ctx, "POST", `/me/articles/${id}/submit`, undefined, "rep-1");
      assert.equal(res.statusCode, 400);
      assert.ok(JSON.parse(res.body).missing.includes(block.type === "image" ? "block.source:1" : "blocks"));
    }
  });

  it("blocks admin and moderator authors from publishing or rejecting their own local updates, while articles keep existing behaviour", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedMod(ctx.ddb, "mod-1", { reporter: { approvedAt: "now", localities: [] } });
    for (const sub of ["admin-1", "mod-1"]) {
      const id = await pending(ctx, sub);
      for (const action of ["publish", "reject"]) {
        const res = await request(ctx, "POST", `/moderation/dispatches/${id}`, { action, reason: "Source missing" }, sub);
        assert.equal(res.statusCode, 403, res.body);
        assert.equal(JSON.parse(res.body).error, "own_item");
        assert.equal(ctx.ddb.store.get(`DISPATCH#${id}|META`).status, "pending");
      }
      assert.equal(
        (await request(ctx, "POST", `/moderation/dispatches/${id}`, { action: "publish" }, sub === "admin-1" ? "mod-1" : "admin-1"))
          .statusCode,
        200,
      );
    }
    seedDispatch(ctx.ddb, "legacy", { kind: undefined, status: "pending", sub: "admin-1" });
    assert.equal((await request(ctx, "POST", "/moderation/dispatches/legacy", { action: "publish" }, "admin-1")).statusCode, 200);
  });

  it("retains supplied expiry on publish and includes expired items in public and locality queries", async () => {
    const ctx = setup();
    seedReporter(ctx.ddb, "rep-1");
    seedAdmin(ctx.ddb);
    const expiry = "2020-01-01T00:00:00.000Z";
    const id = await pending(ctx, "rep-1", { expiresAt: expiry, scope: "national" });
    assert.equal((await request(ctx, "POST", `/moderation/dispatches/${id}`, { action: "publish" }, "admin-1")).statusCode, 200);
    for (const path of ["/dispatches?kind=news", `/dispatches/${id}`]) {
      const res = await request(ctx, "GET", path);
      assert.equal(res.statusCode, 200);
      const out = JSON.parse(res.body).items?.[0] || JSON.parse(res.body);
      assert.equal(out.expiresAt, expiry);
      assert.equal(out.sourceNote, validNews.sourceNote);
      assert.equal(out.authorSub, undefined);
      assert.equal(out.author.email, undefined);
    }
    assert.equal((await queryLocalDispatches(ctx.ddb, "t", { district: LOC.district }))[0].id, id);
    assert.equal((await queryNationalNews(ctx.ddb, "t"))[0].id, id);
  });

  it("pages past other kinds in both public lists and does not drop matching items between cursors", async () => {
    const ctx = setup();
    for (let i = 0; i < 85; i++)
      seedDispatch(ctx.ddb, `item-${i}`, {
        kind: i % 3 === 0 ? "news" : i % 3 === 1 ? "article" : undefined,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      });
    for (const kind of ["news", "article"]) {
      let cursor;
      const ids = [];
      do {
        const res = await request(ctx, "GET", `/dispatches?kind=${kind}${cursor ? `&cursor=${cursor}` : ""}`);
        assert.equal(res.statusCode, 200, res.body);
        const page = JSON.parse(res.body);
        assert.ok(page.items.length <= 20);
        ids.push(...page.items.map((it) => it.id));
        cursor = page.cursor;
      } while (cursor);
      const expected = [...ctx.ddb.store.values()]
        .filter((it) => it.type === "DISPATCH" && dispatchKind(it) === kind)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((it) => it.id);
      assert.deepEqual(ids, expected);
    }
    assert.equal((await request(ctx, "GET", "/dispatches?kind=other")).statusCode, 400);
    seedAdmin(ctx.ddb);
    assert.equal((await request(ctx, "GET", "/moderation/dispatches?kind=other", undefined, "admin-1")).statusCode, 400);
  });
});

describe("correspondent onboarding and daily settings", () => {
  beforeEach(() => clearJwksCache());

  it("allows an admin to approve and revoke by flag without changing the user's role, exposing it in me and lookup", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedMod(ctx.ddb, "mod-1");
    seedReporter(ctx.ddb, "rep-1");
    delete ctx.ddb.store.get("USER#rep-1|PROFILE").reporter;
    const update = { reporter: { localities: [], nationalScope: false, approvedAt: "forged" } };
    assert.equal((await request(ctx, "POST", "/admin/users/rep-1/role", update, "mod-1")).statusCode, 403);
    let res = await request(ctx, "POST", "/admin/users/rep-1/role", update, "admin-1");
    assert.equal(res.statusCode, 200, res.body);
    const user = JSON.parse((await request(ctx, "GET", "/me", undefined, "rep-1")).body);
    assert.equal(user.role, "helper");
    assert.deepEqual(user.reporter.localities, []);
    assert.ok(Number.isFinite(Date.parse(user.reporter.approvedAt)));
    assert.notEqual(user.reporter.approvedAt, "forged");
    const lookup = JSON.parse((await request(ctx, "GET", "/admin/users/lookup?email=rep-1@example.com", undefined, "admin-1")).body);
    assert.deepEqual(lookup.reporter, user.reporter);
    assert.equal((await draft(ctx)).length > 0, true);
    res = await request(ctx, "POST", "/admin/users/rep-1/role", { reporter: null }, "admin-1");
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(JSON.parse((await request(ctx, "GET", "/me", undefined, "rep-1")).body).reporter, undefined);
    res = await createNews(ctx.handler, ctx.kp);
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, "reporter_required");
  });

  it("validates correspondent localities and boolean nationalScope, preserves flags across role updates and allows clearing approvedAt", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedReporter(ctx.ddb, "rep-1");
    for (const reporter of [
      { localities: [], nationalScope: "false" },
      { localities: {}, nationalScope: false },
      { localities: [{ ...LOC, ward: 99 }], nationalScope: false },
    ]) {
      assert.equal((await request(ctx, "POST", "/admin/users/rep-1/role", { reporter }, "admin-1")).statusCode, 400);
    }
    assert.equal(
      (await request(ctx, "POST", "/admin/users/rep-1/role", { role: "moderator", districts: ["Achham"] }, "admin-1")).statusCode,
      200,
    );
    assert.ok(ctx.ddb.store.get("USER#rep-1|PROFILE").reporter.approvedAt);
    assert.equal(
      (
        await request(
          ctx,
          "POST",
          "/admin/users/rep-1/role",
          { reporter: { localities: [LOC], nationalScope: false, approvedAt: null } },
          "admin-1",
        )
      ).statusCode,
      200,
    );
    assert.equal((await createNews(ctx.handler, ctx.kp)).statusCode, 403);
  });

  it("defaults to enabled, five; stores only validated settings in the single SETTINGS item and restricts both routes to admins", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedMod(ctx.ddb, "mod-1");
    const defaults = { dailyLimitEnabled: true, dailyLimit: 5 };
    assert.deepEqual(JSON.parse((await request(ctx, "GET", "/admin/settings/local-updates", undefined, "admin-1")).body), defaults);
    for (const method of ["GET", "PUT"]) {
      for (const sub of ["mod-1", "helper-1"])
        assert.equal((await request(ctx, method, "/admin/settings/local-updates", defaults, sub)).statusCode, 403);
      assert.equal((await request(ctx, method, "/admin/settings/local-updates", defaults)).statusCode, 401);
    }
    for (const body of [
      { dailyLimitEnabled: true, dailyLimit: 0 },
      { dailyLimitEnabled: true, dailyLimit: 51 },
      { dailyLimitEnabled: true, dailyLimit: 1.5 },
      { dailyLimitEnabled: true, dailyLimit: "5" },
      { dailyLimit: 5 },
      { dailyLimitEnabled: "true", dailyLimit: 5 },
    ]) {
      assert.equal((await request(ctx, "PUT", "/admin/settings/local-updates", body, "admin-1")).statusCode, 400);
    }
    const settings = { dailyLimitEnabled: false, dailyLimit: 50 };
    assert.deepEqual(
      JSON.parse((await request(ctx, "PUT", "/admin/settings/local-updates", { ...settings, unsafe: true }, "admin-1")).body),
      settings,
    );
    assert.deepEqual(ctx.ddb.store.get("SETTINGS|LOCAL_UPDATES"), { PK: "SETTINGS", SK: "LOCAL_UPDATES", ...settings });
    assert.deepEqual(JSON.parse((await request(ctx, "GET", "/admin/settings/local-updates", undefined, "admin-1")).body), settings);
  });

  it("counts news creations across statuses in the last 24 hours; disabled limit and admins are exempt", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedReporter(ctx.ddb, "rep-1");
    assert.equal(
      (await request(ctx, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 1 }, "admin-1")).statusCode,
      200,
    );
    const id = await draft(ctx);
    let res = await createNews(ctx.handler, ctx.kp);
    assert.equal(res.statusCode, 429, res.body);
    const error = JSON.parse(res.body);
    assert.equal(error.error, "daily_limit");
    assert.equal(error.limit, 1);
    assert.equal(error.resetsAt, new Date(Date.parse(ctx.ddb.store.get(`DISPATCH#${id}|META`).createdAt) + 86400000).toISOString());
    await draft(ctx, "admin-1");
    await draft(ctx, "admin-1");
    assert.equal(
      (await request(ctx, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: false, dailyLimit: 1 }, "admin-1")).statusCode,
      200,
    );
    await draft(ctx);
    assert.equal(
      (await request(ctx, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 5 }, "admin-1")).statusCode,
      200,
    );
  });

  it("ignores old news, articles, dangling pointers and pointers to another author; reset time accounts for a lowered limit", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    seedReporter(ctx.ddb, "rep-1");
    const now = Date.now();
    for (const [id, extra] of [
      ["old", { createdAt: new Date(now - 86400001).toISOString() }],
      ["article", { kind: "article", createdAt: new Date(now - 1000).toISOString() }],
      ["one", { createdAt: new Date(now - 7200000).toISOString(), status: "rejected" }],
      ["two", { createdAt: new Date(now - 3600000).toISOString(), status: "draft" }],
    ])
      seedDispatch(ctx.ddb, id, extra);
    seedDispatch(ctx.ddb, "other-author", { sub: "other", createdAt: new Date(now - 1000).toISOString() });
    ctx.ddb.store.set("USER#rep-1|ARTICLE#other-author", {
      PK: "USER#rep-1",
      SK: "ARTICLE#other-author",
      type: "MINE",
      kind: "ARTICLE",
      id: "other-author",
    });
    ctx.ddb.store.set("USER#rep-1|ARTICLE#gone", { PK: "USER#rep-1", SK: "ARTICLE#gone", type: "MINE", kind: "ARTICLE", id: "gone" });
    await request(ctx, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 3 }, "admin-1");
    const third = await draft(ctx);
    await request(ctx, "PUT", "/admin/settings/local-updates", { dailyLimitEnabled: true, dailyLimit: 1 }, "admin-1");
    const res = await createNews(ctx.handler, ctx.kp);
    assert.equal(res.statusCode, 429, res.body);
    assert.equal(
      JSON.parse(res.body).resetsAt,
      new Date(Date.parse(ctx.ddb.store.get(`DISPATCH#${third}|META`).createdAt) + 86400000).toISOString(),
    );
    assert.equal((await request(ctx, "POST", "/me/articles", { language: "en" }, "rep-1")).statusCode, 201);
  });
});

describe("local update limits across DynamoDB pages", () => {
  beforeEach(() => clearJwksCache());

  it("enforces the default five creations even if pointer queries are paginated", async () => {
    const ctx = setup();
    seedReporter(ctx.ddb, "rep-1");
    const send = ctx.ddb.send.bind(ctx.ddb);
    ctx.ddb.send = (command) => {
      if (command.constructor.name === "QueryCommand") command.input.Limit = 2;
      return send(command);
    };
    for (let i = 0; i < 5; i++) await draft(ctx);
    const res = await createNews(ctx.handler, ctx.kp);
    assert.equal(res.statusCode, 429, res.body);
    assert.equal(JSON.parse(res.body).limit, 5);
    assert.equal([...ctx.ddb.store.values()].filter((it) => it.type === "DISPATCH").length, 5);
    assert.equal(ctx.ddb.store.has("SETTINGS|LOCAL_UPDATES"), false);
  });

  it("lists all pending local updates past article-only DynamoDB pages", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    const send = ctx.ddb.send.bind(ctx.ddb);
    ctx.ddb.send = (command) => {
      if (command.constructor.name === "QueryCommand") command.input.Limit = 2;
      return send(command);
    };
    for (let i = 0; i < 6; i++)
      seedDispatch(ctx.ddb, `pending-${i}`, {
        kind: i < 3 ? undefined : "news",
        status: "pending",
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      });
    for (const [query, expected] of [
      ["?kind=news", [3, 4, 5]],
      ["", [0, 1, 2]],
    ]) {
      const res = await request(ctx, "GET", `/moderation/dispatches${query}`, undefined, "admin-1");
      assert.equal(res.statusCode, 200);
      assert.deepEqual(
        JSON.parse(res.body).items.map((it) => it.id),
        expected.map((i) => `pending-${i}`),
      );
    }
  });
});

describe("local update authoring boundaries", () => {
  beforeEach(() => clearJwksCache());

  it("accepts a 1200-character plain body and rejects longer bodies or too many sources", async () => {
    const ctx = setup();
    seedAdmin(ctx.ddb);
    const body = { ...validNews, language: "ne", kind: "news", blocks: undefined, body: { ne: "अ".repeat(1200) } };
    const res = await request(ctx, "POST", "/me/articles", body, "admin-1");
    assert.equal(res.statusCode, 201, res.body);
    const id = JSON.parse(res.body).id;
    assert.equal(ctx.ddb.store.get(`DISPATCH#${id}|META`).body.ne.length, 1200);
    for (const size of [1201, 5001]) {
      const invalid = await request(ctx, "POST", "/me/articles", { ...body, body: "अ".repeat(size) }, "admin-1");
      assert.equal(invalid.statusCode, 400);
      assert.deepEqual(JSON.parse(invalid.body).missing, ["body"]);
    }
    assert.equal(
      (await request(ctx, "POST", "/me/articles", { ...body, sourceUrls: Array(4).fill("https://www.opmcm.gov.np/") }, "admin-1"))
        .statusCode,
      400,
    );
    assert.equal((await request(ctx, "POST", "/me/articles", { ...body, sourceNote: "x".repeat(201) }, "admin-1")).statusCode, 400);
  });

  it("allows rejecting, editing and resubmitting, but keeps pending and published updates locked", async () => {
    const ctx = setup();
    seedReporter(ctx.ddb, "rep-1");
    seedAdmin(ctx.ddb);
    const id = await pending(ctx);
    assert.equal((await request(ctx, "PUT", `/me/articles/${id}`, { title: "changed" }, "rep-1")).statusCode, 409);
    assert.equal(
      (await request(ctx, "POST", `/moderation/dispatches/${id}`, { action: "reject", reason: "Check the source date" }, "admin-1"))
        .statusCode,
      200,
    );
    assert.equal((await request(ctx, "GET", `/dispatches/${id}`)).statusCode, 404);
    assert.equal(
      (
        await request(
          ctx,
          "PUT",
          `/me/articles/${id}`,
          { title: "Source date checked", sourceNote: "Ward 4 office notice, 14 Oct" },
          "rep-1",
        )
      ).statusCode,
      200,
    );
    assert.equal((await request(ctx, "POST", `/me/articles/${id}/submit`, undefined, "rep-1")).statusCode, 200);
    assert.equal(ctx.ddb.store.get(`DISPATCH#${id}|META`).rejectReason, undefined);
    assert.equal((await request(ctx, "POST", `/moderation/dispatches/${id}`, { action: "publish" }, "admin-1")).statusCode, 200);
    assert.equal((await request(ctx, "PUT", `/me/articles/${id}`, { title: "changed" }, "rep-1")).statusCode, 409);
  });
});
