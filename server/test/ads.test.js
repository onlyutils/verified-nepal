import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { isActive, pickAd, listAds } from "../src/models/ad.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

const now = "2026-10-14T06:00:00.000Z";
function candidate(id, target, overrides = {}) {
  return { id, slot: "localTop", target, startAt: "2026-10-01T00:00:00.000Z", endAt: "2026-11-01T00:00:00.000Z", ...overrides };
}

describe("ad selection", () => {
  it("prefers municipality, then district, then Nepal, within the requested slot", () => {
    const all = candidate("all", { kind: "all" }, { startAt: "2026-10-13T00:00:00.000Z" });
    const district = candidate("district", { kind: "district", value: "Achham" });
    const municipality = candidate("municipality", { kind: "municipality", value: 69001 });
    const ads = [all, district, municipality, candidate("other-slot", { kind: "municipality", value: 69001 }, { slot: "articleEnd" })];
    assert.equal(pickAd(ads, { slot: "localTop", district: "Achham", municipalityId: "69001" }, now), municipality);
    assert.equal(pickAd(ads, { slot: "localTop", district: "Achham", municipalityId: 69002 }, now), district);
    assert.equal(pickAd(ads, { slot: "localTop", district: "Kathmandu" }, now), all);
    assert.equal(pickAd(ads, { slot: "localTop" }, now), all);
  });

  it("breaks specificity ties by newest startAt without mutating the candidates", () => {
    const older = candidate("older", { kind: "district", value: "Achham" });
    const newer = candidate("newer", { kind: "district", value: "Achham" }, { startAt: "2026-10-12T00:00:00.000Z" });
    const ads = [older, newer];
    assert.equal(pickAd(ads, { slot: "localTop", district: "Achham" }, now), newer);
    assert.deepEqual(ads, [older, newer]);
  });

  it("includes the start instant and excludes the end instant, future and invalid dates", () => {
    assert.equal(isActive(candidate("started", { kind: "all" }, { startAt: now }), now), true);
    for (const ad of [
      candidate("ended", { kind: "all" }, { endAt: now }),
      candidate("expired", { kind: "all" }, { endAt: "2026-10-13T00:00:00.000Z" }),
      candidate("future", { kind: "all" }, { startAt: "2026-10-15T00:00:00.000Z" }),
      candidate("invalid", { kind: "all" }, { endAt: "invalid" }),
    ]) {
      assert.equal(isActive(ad, now), false);
      assert.equal(pickAd([ad], { slot: "localTop" }, now), null);
    }
  });

  it("returns null when empty or no target or slot matches", () => {
    assert.equal(pickAd([], { slot: "localTop" }, now), null);
    assert.equal(pickAd([candidate("district", { kind: "district", value: "Achham" })], { slot: "localTop" }, now), null);
    assert.equal(pickAd([candidate("all", { kind: "all" })], { slot: "articleEnd" }, now), null);
  });
});

const kp = makeKeyPair();
const token = (sub) => `Bearer ${createToken(basePayload({ sub }), kp.privateKey)}`;
function setup() {
  const ddb = new FakeDdb();
  for (const role of ["admin", "helper", "moderator"]) {
    ddb.store.set(`USER#${role}|PROFILE`, { PK: `USER#${role}`, SK: "PROFILE", role, name: role });
  }
  const handler = createHandler({
    env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t", MEDIA_PUBLIC_BASE: "https://media.example.com" },
    ddbClient: ddb,
    fetchJwks: async () => ({ keys: [kp.jwk] }),
  });
  const request = (method, path, body, role) => handler(makeEvent({ method, path, body, headers: role ? { authorization: token(role) } : {} }));
  return { ddb, handler, request };
}
function body(overrides = {}) {
  return {
    slot: "localTop",
    target: { kind: "all" },
    image: { url: "https://media.example.com/ad.webp", fileId: "ad-image" },
    href: "https://sponsor.example.com/help",
    label: { en: " Community sponsor ", ne: " स्थानीय सहयोगी " },
    startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
    note: "Private agreement",
    ...overrides,
  };
}
async function create(request, overrides = {}) {
  const res = await request("POST", "/admin/ads", body(overrides), "admin");
  assert.equal(res.statusCode, 201, res.body);
  return JSON.parse(res.body);
}

describe("ad API", () => {
  beforeEach(() => clearJwksCache());

  it("requires sign-in and rejects helpers and moderators on every admin route", async () => {
    const { request, ddb } = setup();
    for (const [method, path] of [["GET", "/admin/ads"], ["POST", "/admin/ads"], ["PUT", "/admin/ads/id"], ["DELETE", "/admin/ads/id"]]) {
      assert.equal((await request(method, path, body())).statusCode, 401);
      for (const role of ["helper", "moderator"]) assert.equal((await request(method, path, body(), role)).statusCode, 403);
    }
    assert.equal([...ddb.store.values()].some((item) => item.type === "AD" || item.type === "AUDIT"), false);
  });

  it("defaults to null, tolerates unknown locality parameters, and validates slot", async () => {
    const { request } = setup();
    for (const path of ["/ads", "/ads?slot=localTop", "/ads?slot=articleEnd&district=Nowhere&municipality=invalid&unknown=yes"]) {
      const res = await request("GET", path);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), { ad: null });
      assert.equal(res.headers["cache-control"], "public, max-age=300");
    }
    for (const path of ["/ads?slot=unknown", "/ads?slot="]) assert.equal((await request("GET", path)).statusCode, 400);
  });

  it("serves municipality 69001 ahead of all, falls back elsewhere, and exposes only public fields", async () => {
    const { request, ddb } = setup();
    const general = await create(request);
    const local = await create(request, { target: { kind: "municipality", value: "69001" } });
    const res = await request("GET", "/ads?slot=localTop&district=Achham&municipality=69001");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ad: { id: local.id, slot: "localTop", image: { url: local.image.url }, href: local.href, label: { en: "Community sponsor", ne: "स्थानीय सहयोगी" } } });
    for (const query of ["&district=Achham&municipality=69002", "", "&district=unknown&municipality=unknown"]) {
      assert.equal(JSON.parse((await request("GET", `/ads?slot=localTop${query}`)).body).ad.id, general.id);
    }
    const stored = ddb.store.get(`AD#${local.id}|META`);
    assert.equal(stored.type, "AD");
    assert.equal(stored.createdBy, "admin");
    assert.equal(stored.target.value, 69001);
    assert.equal(stored.gsi2pk, "AD#localTop");
    assert.equal(stored.gsi2sk, stored.startAt);
    assert.equal(stored.updatedAt, stored.createdAt);
    assert.equal(res.body.includes("note"), false);
    assert.equal(res.body.includes("createdBy"), false);
    assert.equal(res.body.includes("fileId"), false);
    assert.deepEqual(JSON.parse((await request("GET", "/ads")).body), { ad: null });
  });

  it("never serves expired or future ads and lists both slots with active flags", async () => {
    const { request } = setup();
    const expired = await create(request, { startAt: new Date(Date.now() - 172800000).toISOString(), endAt: new Date(Date.now() - 86400000).toISOString() });
    const future = await create(request, { startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 172800000).toISOString() });
    const active = await create(request, { slot: "articleEnd" });
    assert.deepEqual(JSON.parse((await request("GET", "/ads?slot=localTop")).body), { ad: null });
    assert.equal(JSON.parse((await request("GET", "/ads?slot=articleEnd")).body).ad.id, active.id);
    const res = await request("GET", "/admin/ads", undefined, "admin");
    assert.equal(res.statusCode, 200);
    const { items } = JSON.parse(res.body);
    assert.equal(items.length, 3);
    assert.equal(items.find((item) => item.id === expired.id).active, false);
    assert.equal(items.find((item) => item.id === future.id).active, false);
    assert.equal(items.find((item) => item.id === active.id).active, true);
    assert.equal(items[0].note, "Private agreement");
    assert.equal(items.some((item) => "PK" in item || "gsi2pk" in item), false);
  });

  it("updates all editable fields, preserves creation metadata, deletes, and audits each mutation", async () => {
    const { request, ddb } = setup();
    const original = await create(request, { createdBy: "forged", id: "forged" });
    const updatedBody = body({ slot: "articleEnd", target: { kind: "district", value: "Achham" }, note: " revised ", createdBy: "forged", createdAt: "forged" });
    const res = await request("PUT", `/admin/ads/${original.id}`, updatedBody, "admin");
    assert.equal(res.statusCode, 200, res.body);
    const updated = JSON.parse(res.body);
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(updated.createdBy, "admin");
    assert.equal(updated.note, "revised");
    assert.equal(ddb.store.get(`AD#${original.id}|META`).gsi2pk, "AD#articleEnd");
    assert.deepEqual(JSON.parse((await request("GET", "/ads?slot=localTop")).body), { ad: null });
    assert.equal(JSON.parse((await request("GET", "/ads?slot=articleEnd&district=Achham")).body).ad.id, original.id);
    const deleted = await request("DELETE", `/admin/ads/${original.id}`, undefined, "admin");
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(JSON.parse(deleted.body), { ok: true });
    assert.equal(ddb.store.has(`AD#${original.id}|META`), false);
    assert.deepEqual(JSON.parse((await request("GET", "/ads?slot=articleEnd&district=Achham")).body), { ad: null });
    const audit = [...ddb.store.values()].filter((item) => item.type === "AUDIT");
    assert.deepEqual(audit.map((item) => item.action), ["ad.create", "ad.update", "ad.delete"]);
    for (const entry of audit) {
      assert.equal(entry.targetType, "AD");
      assert.equal(entry.targetId, original.id);
      assert.equal(entry.actorSub, "admin");
    }
    for (const method of ["PUT", "DELETE"]) {
      assert.equal((await request(method, "/admin/ads/missing", body(), "admin")).statusCode, 404);
      assert.equal((await request(method, "/admin/ads/%3Cbad%3E", body(), "admin")).statusCode, 400);
    }
  });

  it("validates both create and update bodies without changing or auditing rejected input", async () => {
    const { request, ddb } = setup();
    const original = await create(request);
    const invalid = [
      null, [], {},
      body({ slot: "sidebar" }), body({ target: { kind: "nepal" } }), body({ target: { kind: "district", value: "Nowhere" } }),
      body({ target: { kind: "municipality", value: 99999 } }), body({ target: { kind: "municipality", value: [69001] } }),
      body({ image: {} }), body({ image: { url: "data:image/png;base64,abc", fileId: "id" } }),
      body({ image: { url: "https://media.example.com.evil/ad.webp", fileId: "id" } }), body({ image: { url: "https://media.example.com/x" } }),
      ...["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://", "https://example.com/" + "a".repeat(500)].map((href) => body({ href })),
      ...[{ en: "", ne: "ठीक" }, { en: "Okay" }, { en: "a".repeat(61), ne: "ठीक" }, { en: "Okay", ne: "क".repeat(61) }, { en: "<b>Ad</b>", ne: "ठीक" }, { en: "Okay", ne: "<script>bad</script>" }].map((label) => body({ label })),
      body({ startAt: "yesterday" }), body({ startAt: "2026-02-30T00:00:00.000Z" }), body({ startAt: "2026-10-01" }),
      body({ startAt: now, endAt: now }), body({ startAt: "2026-11-01T00:00:00.000Z", endAt: now }), body({ note: "a".repeat(501) }),
    ];
    const snapshot = JSON.stringify([...ddb.store]);
    for (const input of invalid) {
      for (const [method, path] of [["POST", "/admin/ads"], ["PUT", `/admin/ads/${original.id}`]]) {
        const res = await request(method, path, input, "admin");
        assert.equal(res.statusCode, 400, `${method} ${JSON.stringify(input)}: ${res.body}`);
      }
    }
    assert.equal(JSON.stringify([...ddb.store]), snapshot);
  });

  it("accepts ISO offsets, canonicalizes dates, and allows an omitted note", async () => {
    const { request } = setup();
    const ad = await create(request, { startAt: "2026-10-01T05:45:00+05:45", endAt: "2026-11-01T05:45:00+05:45", note: undefined });
    assert.equal(ad.startAt, "2026-10-01T00:00:00.000Z");
    assert.equal(ad.endAt, "2026-11-01T00:00:00.000Z");
    assert.equal(ad.note, "");
  });

  it("rejects oversized bytes and invalid JSON, including encoded requests", async () => {
    const { request, handler } = setup();
    for (const method of ["POST", "PUT"]) {
      const path = method === "POST" ? "/admin/ads" : "/admin/ads/id";
      assert.equal((await request(method, path, "{", "admin")).statusCode, 400);
      // Fewer than 16 KiB characters, but over 16 KiB when encoded as UTF-8.
      const oversized = JSON.stringify(body({ extra: "क".repeat(6000) }));
      assert.equal((await request(method, path, oversized, "admin")).statusCode, 413);
      const event = makeEvent({ method, path, headers: { authorization: token("admin") }, body: Buffer.from(oversized).toString("base64") });
      event.isBase64Encoded = true;
      assert.equal((await handler(event)).statusCode, 413);
    }
    const encoded = makeEvent({ method: "POST", path: "/admin/ads", headers: { authorization: token("admin") }, body: Buffer.from(JSON.stringify(body())).toString("base64") });
    encoded.isBase64Encoded = true;
    assert.equal((await handler(encoded)).statusCode, 201);
  });
});

it("lists ads using every GSI2 page in the requested slot", async () => {
  const ddb = new FakeDdb();
  for (const [id, slot] of [["a", "localTop"], ["b", "localTop"], ["c", "articleEnd"]]) {
    ddb.store.set(`AD#${id}|META`, { ...candidate(id, { kind: "all" }), PK: `AD#${id}`, SK: "META", slot, gsi2pk: `AD#${slot}`, gsi2sk: id });
  }
  const calls = [];
  const paged = { send(cmd) {
    calls.push(cmd.input);
    cmd.input.Limit = 1;
    return ddb.send(cmd);
  } };
  const ads = await listAds(paged, "t", { slot: "localTop" });
  assert.deepEqual(ads.map((ad) => ad.id).sort(), ["a", "b"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].IndexName, "GSI2");
  assert.equal(calls[0].ExpressionAttributeValues[":pk"], "AD#localTop");
  assert.ok(calls[1].ExclusiveStartKey);
});
