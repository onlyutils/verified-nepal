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
    const out = await verifyIdToken(token, { fetchJwks, googleClientId: "test-client-id" });
    assert.equal(out.sub, payload.sub);
    assert.equal(out.email, payload.email);
  });

  it("accepts iss without https prefix", async () => {
    const payload = basePayload({ iss: "accounts.google.com" });
    const token = createToken(payload, kp.privateKey);
    const out = await verifyIdToken(token, { fetchJwks, googleClientId: "test-client-id" });
    assert.equal(out.iss, "accounts.google.com");
  });

  it("rejects invalid iss", async () => {
    const payload = basePayload({ iss: "https://evil.com" });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, googleClientId: "test-client-id" }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("rejects wrong aud", async () => {
    const payload = basePayload({ aud: "other-client" });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, googleClientId: "test-client-id" }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("rejects expired token", async () => {
    const payload = basePayload({ exp: Math.floor(Date.now() / 1000) - 10 });
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, googleClientId: "test-client-id" }), (e) => {
      assert.equal(e.status, 401);
      return true;
    });
  });

  it("rejects invalid signature", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    const bad = token.slice(0, -4) + "abcd";
    await assert.rejects(() => verifyIdToken(bad, { fetchJwks, googleClientId: "test-client-id" }), (e) => {
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
    await assert.rejects(() => verifyIdToken(token, { fetchJwks: fetcher, googleClientId: "test-client-id" }), (e) => {
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
    await verifyIdToken(token, { fetchJwks: fetcher, googleClientId: "test-client-id" });
    await verifyIdToken(token, { fetchJwks: fetcher, googleClientId: "test-client-id" });
    assert.equal(calls, 1);
  });

  it("rejects missing GOOGLE_CLIENT_ID as 500", async () => {
    const payload = basePayload();
    const token = createToken(payload, kp.privateKey);
    await assert.rejects(() => verifyIdToken(token, { fetchJwks, googleClientId: "" }), (e) => {
      assert.equal(e.status, 500);
      return true;
    });
  });
});
