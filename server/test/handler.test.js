import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload, FakeDdb, makeEvent } from "./helpers.js";

describe("router dispatch", () => {
  it("GET /health returns ok", async () => {
    const handler = createHandler({ env: {} });
    const res = await handler(makeEvent({ method: "GET", path: "/health" }));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.match(res.headers["content-type"], /json/);
  });

  it("unknown route returns 404", async () => {
    const handler = createHandler({ env: {} });
    const res = await handler(makeEvent({ method: "GET", path: "/unknown" }));
    assert.equal(res.statusCode, 404);
    assert.deepEqual(JSON.parse(res.body), { error: "Not Found" });
  });

  it("POST /health is 404 (method mismatch)", async () => {
    const handler = createHandler({ env: {} });
    const res = await handler(makeEvent({ method: "POST", path: "/health" }));
    assert.equal(res.statusCode, 404);
  });

  it("GET /me without auth returns 401", async () => {
    const handler = createHandler({ env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" }, ddbClient: new FakeDdb(), fetchJwks: async () => ({ keys: [] }) });
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: {} }));
    assert.equal(res.statusCode, 401);
  });

  it("GET /me with invalid token returns 401 no stack trace", async () => {
    clearJwksCache();
    const kp = makeKeyPair();
    const handler = createHandler({
      env: { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "t" },
      ddbClient: new FakeDdb(),
      fetchJwks: async () => ({ keys: [kp.jwk] }),
    });
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: "Bearer invalid.token.here" } }));
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.ok(body.error);
    assert.equal(body.stack, undefined);
  });

  it("errors never leak stack traces", async () => {
    const handler = createHandler({
      env: {},
      ddbClient: { send: async () => { throw new Error("boom"); } },
      fetchJwks: async () => { throw new Error("jwks fail"); },
    });
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: "Bearer x.y.z" } }));
    const body = JSON.parse(res.body);
    assert.equal(body.stack, undefined);
    assert.ok(!String(body.error).includes("boom"));
  });
});

describe("GET /me with fake ddb", () => {
  let kp;
  let fetchJwks;

  beforeEach(() => {
    clearJwksCache();
    kp = makeKeyPair();
    fetchJwks = async () => ({ keys: [kp.jwk] });
  });

  it("first login creates helper user", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });

    const payload = basePayload({ sub: "sub-1", email: "alice@example.com", name: "Alice" });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.sub, "sub-1");
    assert.equal(body.email, "alice@example.com");
    assert.equal(body.name, "Alice");
    assert.equal(body.role, "helper");

    const stored = ddb.store.get("USER#sub-1|PROFILE");
    assert.ok(stored);
    assert.equal(stored.role, "helper");
    assert.equal(stored.PK, "USER#sub-1");
    assert.equal(stored.SK, "PROFILE");
  });

  it("first login creates admin if email in ADMIN_EMAILS", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com, bob@example.com " };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });

    const payload = basePayload({ sub: "sub-admin", email: "Bob@Example.com", name: "Bob" });
    payload.email_verified = true;
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
    const stored = ddb.store.get("USER#sub-admin|PROFILE");
    assert.equal(stored.role, "admin");
  });

  it("grants admin even when email_verified is false (OnlyUtils federation verified)", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com, bob@example.com" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });

    const payload = basePayload({ sub: "sub-spoof", email: "alice@example.com", name: "Alice", email_verified: false });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
    const stored = ddb.store.get("USER#sub-spoof|PROFILE");
    assert.equal(stored.role, "admin");
  });

  it("grants admin when email_verified absent (OnlyUtils tokens may not carry it)", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });
    const payload = basePayload({ sub: "sub-no-verified", email: "alice@example.com", name: "Alice" });
    delete payload.email_verified;
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
  });

  it("creates moderator if email in MODERATOR_EMAILS", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", MODERATOR_EMAILS: "mod@example.com" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });
    const payload = basePayload({ sub: "sub-mod", email: "mod@example.com", name: "Mod" });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "moderator");
    const stored = ddb.store.get("USER#sub-mod|PROFILE");
    assert.equal(stored.role, "moderator");
  });

  it("ADMIN_EMAILS wins over MODERATOR_EMAILS", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "both@example.com", MODERATOR_EMAILS: "both@example.com, other@example.com" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });
    const payload = basePayload({ sub: "sub-both", email: "both@example.com", name: "Both" });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
  });

  it("existing user returns stored role (not helper fallback)", async () => {
    const ddb = new FakeDdb();
    ddb.store.set("USER#sub-1|PROFILE", {
      PK: "USER#sub-1",
      SK: "PROFILE",
      sub: "sub-1",
      email: "alice@example.com",
      name: "Alice Original",
      role: "moderator",
      createdAt: new Date().toISOString(),
    });
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });

    const payload = basePayload({ sub: "sub-1", email: "alice@example.com", name: "Alice New" });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.role, "moderator");
    assert.equal(body.name, "Alice Original");
  });

  it("existing user second call does not overwrite store", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });

    const payload = basePayload({ sub: "sub-2", email: "carol@example.com", name: "Carol" });
    const token = createToken(payload, kp.privateKey);

    const r1 = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(r1.statusCode, 200);
    assert.equal(JSON.parse(r1.body).role, "helper");
    const sizeAfterFirst = ddb.store.size;

    const r2 = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(r2.statusCode, 200);
    assert.equal(JSON.parse(r2.body).role, "helper");
    assert.equal(ddb.store.size, sizeAfterFirst);
  });

  it("handles lowercase authorization header", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });
    const payload = basePayload({ sub: "sub-lc" });
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { Authorization: `Bearer ${token}` } }));
    // helper uses case-insensitive, so Authorization capital A should also work
    assert.equal(res.statusCode, 200);
  });

  it("returns 500 when TABLE_NAME missing (no stack)", async () => {
    clearJwksCache();
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com" };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks });
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "Internal Server Error");
    assert.equal(body.stack, undefined);
  });
});
