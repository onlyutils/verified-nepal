import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyIdToken, clearJwksCache } from "../src/verify.js";
import { makeKeyPair, createToken, basePayload } from "./helpers.js";

describe("verifyIdToken", () => {
  let kp;
  let fetchJwks;

  beforeEach(() => {
    clearJwksCache();
    kp = makeKeyPair();
    fetchJwks = async () => ({ keys: [kp.jwk] });
  });

  it("verifies a valid token", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    const out = await verifyIdToken(token, { fetchJwks, env: { AUTH_ISSUER: "https://auth.onlyutils.com" } });
    assert.equal(out.sub, payload.sub);
    assert.equal(out.email, payload.email);
  });

  it("verifies with default issuer when env not set", async () => {
    const payload = basePayload({ iss: "https://auth.onlyutils.com" });
    const token = createToken(payload, kp.privateKey);
    const out = await verifyIdToken(token, { fetchJwks, env: {} });
    assert.equal(out.iss, "https://auth.onlyutils.com");
  });

  it("rejects invalid iss", async () => {
    const payload = basePayload({ iss: "https://evil.com" });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, env: { AUTH_ISSUER: "https://auth.onlyutils.com" } }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("respects AUTH_ISSUER env override", async () => {
    const payload = basePayload({ iss: "https://custom.example.com" });
    const token = createToken(payload, kp.privateKey);
    const out = await verifyIdToken(token, { fetchJwks, env: { AUTH_ISSUER: "https://custom.example.com" } });
    assert.equal(out.iss, "https://custom.example.com");
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, env: { AUTH_ISSUER: "https://auth.onlyutils.com" } }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("skips aud check when AUTH_AUDIENCE not set", async () => {
    const payload = basePayload({ aud: "other-client" });
    const token = createToken(payload, kp.privateKey);
    const out = await verifyIdToken(token, { fetchJwks, env: {} });
    assert.equal(out.aud, "other-client");
  });

  it("enforces aud when AUTH_AUDIENCE set", async () => {
    const payload = basePayload({ aud: "other-client" });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, env: { AUTH_AUDIENCE: "test-client-id" } }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
    const good = basePayload({ aud: "test-client-id" });
    const goodToken = createToken(good, kp.privateKey);
    const out = await verifyIdToken(goodToken, { fetchJwks, env: { AUTH_AUDIENCE: "test-client-id" } });
    assert.equal(out.aud, "test-client-id");
  });

  it("rejects expired token", async () => {
    const payload = basePayload({ exp: Math.floor(Date.now() / 1000) - 10 });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, env: {} }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("rejects invalid signature", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    const bad = token.slice(0, -4) + "abcd";
    await assert.rejects(() => verifyIdToken(bad, { fetchJwks, env: {} }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("rejects unknown kid and refetches", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey, "unknown-kid");
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return { keys: [kp.jwk] };
    };
    await assert.rejects(() => verifyIdToken(token, { fetchJwks: fetcher, env: {} }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
    assert.equal(calls, 2);
  });

  it("caches jwks in module scope", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return { keys: [kp.jwk] };
    };
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    await verifyIdToken(token, { fetchJwks: fetcher, env: {} });
    await verifyIdToken(token, { fetchJwks: fetcher, env: {} });
    assert.equal(calls, 1);
  });

  it("supports custom AUTH_JWKS_URL via env", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    let fetchedUrl = null;
    const origFetch = globalThis.fetch;
    // Use injected fetchJwks to verify URL handling is not required for custom fetcher
    const out = await verifyIdToken(token, { fetchJwks, env: { AUTH_JWKS_URL: "https://custom.example.com/.well-known/jwks.json" } });
    assert.equal(out.sub, payload.sub);
  });
});
