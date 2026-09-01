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

  it("OPTIONS returns 204 with empty body", async () => {
    const handler = createHandler({ env: {} });
    const res = await handler(makeEvent({ method: "OPTIONS", path: "/unknown" }));
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, "");
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

  function tokenWithoutEmail(sub) {
    const payload = basePayload({ sub });
    delete payload.email;
    delete payload.name;
    delete payload.email_verified;
    return createToken(payload, kp.privateKey);
  }

  function userinfoFetch(email, name, opts = {}) {
    const data = {};
    if (email !== undefined) data.email = email;
    if (name !== undefined) data.name = name;
    if (opts.primary_email !== undefined) data.primary_email = opts.primary_email;
    if (opts.display_name !== undefined) data.display_name = opts.display_name;
    return async (url, init) => {
      // ensure correct endpoint and auth
      assert.ok(String(url).endsWith("/userinfo"));
      assert.ok(init?.headers?.Authorization?.startsWith("Bearer "));
      return {
        ok: true,
        status: 200,
        json: async () => data,
      };
    };
  }

  it("first login creates helper user", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "" };
    const fetchMock = userinfoFetch("alice@example.com", "Alice");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });

    const token = tokenWithoutEmail("sub-1");
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
    assert.equal(stored.email, "alice@example.com");
    assert.equal(stored.name, "Alice");
    assert.equal(stored.email_verified, undefined);
  });

  it("first login creates admin if email in ADMIN_EMAILS", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com, bob@example.com " };
    const fetchMock = userinfoFetch("Bob@Example.com", "Bob");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });

    const token = tokenWithoutEmail("sub-admin");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
    const stored = ddb.store.get("USER#sub-admin|PROFILE");
    assert.equal(stored.role, "admin");
    assert.equal(stored.email, "Bob@Example.com");
  });

  it("grants admin even when email_verified is false (OnlyUtils federation verified)", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com, bob@example.com" };
    const fetchMock = userinfoFetch("alice@example.com", "Alice");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });

    const token = tokenWithoutEmail("sub-spoof");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
    const stored = ddb.store.get("USER#sub-spoof|PROFILE");
    assert.equal(stored.role, "admin");
  });

  it("grants admin when email_verified absent (OnlyUtils tokens may not carry it)", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "alice@example.com" };
    const fetchMock = userinfoFetch("alice@example.com", "Alice");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-no-verified");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
  });

  it("creates moderator if email in MODERATOR_EMAILS via userinfo", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", MODERATOR_EMAILS: "mod@example.com" };
    const fetchMock = userinfoFetch("mod@example.com", "Mod");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-mod");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "moderator");
    const stored = ddb.store.get("USER#sub-mod|PROFILE");
    assert.equal(stored.role, "moderator");
    assert.equal(stored.email, "mod@example.com");
  });

  it("ADMIN_EMAILS wins over MODERATOR_EMAILS", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", ADMIN_EMAILS: "both@example.com", MODERATOR_EMAILS: "both@example.com, other@example.com" };
    const fetchMock = userinfoFetch("both@example.com", "Both");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-both");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).role, "admin");
  });

  it("first login uses primary_email and display_name fallback", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", MODERATOR_EMAILS: "fallback@example.com" };
    const fetchMock = userinfoFetch(undefined, undefined, { primary_email: "fallback@example.com", display_name: "Fallback Name" });
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-fallback");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.email, "fallback@example.com");
    assert.equal(body.name, "Fallback Name");
    assert.equal(body.role, "moderator");
    const stored = ddb.store.get("USER#sub-fallback|PROFILE");
    assert.equal(stored.email, "fallback@example.com");
    assert.equal(stored.name, "Fallback Name");
  });

  it("first login with no email/name omits undefined fields", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const fetchMock = async () => ({ ok: true, status: 200, json: async () => ({}) });
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-noinfo");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.email, "");
    assert.equal(body.name, "");
    assert.equal(body.role, "helper");
    const stored = ddb.store.get("USER#sub-noinfo|PROFILE");
    assert.ok(stored);
    assert.equal(stored.email, undefined);
    assert.equal(stored.name, undefined);
    assert.equal(stored.role, "helper");
  });

  it("userinfo failure returns 502 and logs userinfo_fail", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const fetchMock = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-fail");
    let logged = null;
    const orig = console.error;
    console.error = (obj) => { try { if (obj && obj.tag === "userinfo_fail") logged = obj; } catch {} };
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    console.error = orig;
    assert.equal(res.statusCode, 502);
    assert.deepEqual(JSON.parse(res.body), { error: "userinfo" });
    assert.ok(logged);
    assert.equal(logged.tag, "userinfo_fail");
    assert.equal(logged.status, 401);
    assert.equal(ddb.store.has("USER#sub-fail|PROFILE"), false);
  });

  it("existing user returns stored role (not helper fallback) and skips userinfo", async () => {
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
    let fetchCalled = false;
    const fetchMock = async () => { fetchCalled = true; return { ok: true, status: 200, json: async () => ({ email: "hacker@example.com", name: "Hacker" }) }; };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });

    const payload = basePayload({ sub: "sub-1" });
    delete payload.email;
    delete payload.name;
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.role, "moderator");
    assert.equal(body.name, "Alice Original");
    assert.equal(body.email, "alice@example.com");
    assert.equal(fetchCalled, false);
  });

  it("existing user second call does not overwrite store and skips userinfo", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    let callCount = 0;
    const fetchMock = async () => {
      callCount++;
      return { ok: true, status: 200, json: async () => ({ email: "carol@example.com", name: "Carol" }) };
    };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });

    const token = tokenWithoutEmail("sub-2");

    const r1 = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(r1.statusCode, 200);
    assert.equal(JSON.parse(r1.body).role, "helper");
    const sizeAfterFirst = ddb.store.size;
    assert.equal(callCount, 1);

    const r2 = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(r2.statusCode, 200);
    assert.equal(JSON.parse(r2.body).role, "helper");
    assert.equal(ddb.store.size, sizeAfterFirst);
    assert.equal(callCount, 1);
  });

  it("handles lowercase authorization header", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const fetchMock = userinfoFetch("lc@example.com", "LC");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const payload = basePayload({ sub: "sub-lc" });
    delete payload.email;
    delete payload.name;
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { Authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
  });

  it("uses AUTH_HOST for userinfo URL", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table", AUTH_HOST: "https://custom.auth.example.com/" };
    let capturedUrl = null;
    const fetchMock = async (url, init) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ email: "a@b.com", name: "A" }) };
    };
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-host");
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 200);
    assert.equal(capturedUrl, "https://custom.auth.example.com/userinfo");
  });

  it("auth_ok log includes emailResolved boolean", async () => {
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com", TABLE_NAME: "test-table" };
    const fetchMock = userinfoFetch("log@example.com", "Log");
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const token = tokenWithoutEmail("sub-log");
    let logged = null;
    const orig = console.error;
    console.error = (obj) => { try { if (obj && obj.tag === "auth_ok") logged = obj; } catch {} };
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    console.error = orig;
    assert.equal(res.statusCode, 200);
    assert.ok(logged);
    assert.equal(logged.tag, "auth_ok");
    assert.ok(Array.isArray(logged.claimKeys));
    assert.equal(typeof logged.emailResolved, "boolean");
    assert.equal(logged.emailResolved, true);
  });

  it("returns 500 when TABLE_NAME missing (no stack)", async () => {
    clearJwksCache();
    const ddb = new FakeDdb();
    const env = { AUTH_ISSUER: "https://auth.onlyutils.com" };
    const fetchMock = async () => ({ ok: true, status: 200, json: async () => ({ email: "x@y.com" }) });
    const handler = createHandler({ env, ddbClient: ddb, fetchJwks, fetch: fetchMock });
    const payload = basePayload();
    delete payload.email;
    const token = createToken(payload, kp.privateKey);
    const res = await handler(makeEvent({ method: "GET", path: "/me", headers: { authorization: `Bearer ${token}` } }));
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "Internal Server Error");
    assert.equal(body.stack, undefined);
  });
});

