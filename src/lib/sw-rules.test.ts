import assert from "node:assert/strict";
import test from "node:test";
import { classifyApiRequest, isPrivateApiPath, isPublicApiPath, hasAuthHeader } from "./sw-rules.ts";

function url(path: string): URL {
  return new URL(path, "https://api.verifiednepal.com");
}

test("public GETs are StaleWhileRevalidate without auth", () => {
  const publics = [
    "/needs",
    "/offers",
    "/status/ABC123",
    "/ledger",
    "/projects",
    "/projects/proj_123",
    "/projects/proj_123/updates",
    "/dispatches",
    "/dispatches/disp_1",
    "/audit",
  ];
  for (const p of publics) {
    assert.equal(classifyApiRequest({ url: url(p) }), "StaleWhileRevalidate", `${p} should be SWR`);
    assert.equal(isPublicApiPath(p), true, `${p} isPublic`);
  }
});

test("claims is NOT public and is private", () => {
  assert.equal(isPublicApiPath("/claims"), false);
  assert.equal(isPublicApiPath("/claims/abc/redeem"), false);
  assert.equal(isPrivateApiPath("/claims"), true);
  assert.equal(isPrivateApiPath("/claims/abc/redeem"), true);
  assert.equal(classifyApiRequest({ url: url("/claims") }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/claims/abc/redeem") }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/claims/print") }), "NetworkOnly");
});

test("private paths are NetworkOnly", () => {
  const privates = ["/me", "/auth/exchange", "/auth/refresh", "/moderation/queue", "/moderation/projects", "/moderation/dispatches", "/admin/users", "/admin/stats", "/claims/sync", "/claims/ABC/redeem"];
  for (const p of privates) {
    assert.equal(isPrivateApiPath(p), true, `${p} private`);
    assert.equal(classifyApiRequest({ url: url(p) }), "NetworkOnly", `${p} NetworkOnly`);
  }
});

test("Authorization header forces NetworkOnly even for public paths", () => {
  const headers = { Authorization: "Bearer token" };
  assert.equal(hasAuthHeader(headers), true);
  assert.equal(classifyApiRequest({ url: url("/needs"), headers }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/offers"), headers }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/ledger"), request: { headers } as unknown as Request }), "NetworkOnly");
  const lower = { authorization: "Bearer token" };
  assert.equal(classifyApiRequest({ url: url("/projects"), headers: lower }), "NetworkOnly");
  const hg = { has: (k: string) => k === "Authorization", get: () => "Bearer x" };
  assert.equal(classifyApiRequest({ url: url("/audit"), headers: hg }), "NetworkOnly");
});

test("non-GET is always NetworkOnly", () => {
  assert.equal(classifyApiRequest({ url: url("/needs"), method: "POST" }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/offers"), method: "PUT" }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/ledger"), request: { method: "POST" } as unknown as Request }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/status/XYZ"), method: "DELETE" }), "NetworkOnly");
  assert.equal(classifyApiRequest({ url: url("/unknown"), method: "POST" }), "NetworkOnly");
});

test("unknown paths return null (no cache)", () => {
  assert.equal(classifyApiRequest({ url: url("/unknown") }), null);
  assert.equal(classifyApiRequest({ url: url("/health") }), null);
  assert.equal(isPublicApiPath("/unknown"), false);
  assert.equal(isPrivateApiPath("/unknown"), false);
});
