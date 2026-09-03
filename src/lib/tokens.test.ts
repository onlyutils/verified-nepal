import assert from "node:assert/strict";
import test from "node:test";
import { clearTokens, loadTokens, refreshAccessToken, saveTokens } from "./tokens.ts";

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

function stubFetch(status: number, body: unknown) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { ok: status < 400, status, json: async () => body } as Response;
  }) as typeof fetch;
  return () => calls;
}

test("concurrent callers share one refresh and get the new token", async () => {
  saveTokens({ access_token: "old", refresh_token: "r1" });
  const calls = stubFetch(200, { access_token: "new", refresh_token: "r2", expires_in: 900 });
  const [a, b] = await Promise.all([refreshAccessToken("https://api", "old"), refreshAccessToken("https://api", "old")]);
  assert.deepEqual([a, b], ["new", "new"]);
  assert.equal(calls(), 1);
  assert.equal(loadTokens()?.refresh_token, "r2");
});

test("a token another request already refreshed is reused without a network call", async () => {
  saveTokens({ access_token: "fresh", refresh_token: "r2" });
  const calls = stubFetch(200, {});
  assert.equal(await refreshAccessToken("https://api", "stale"), "fresh");
  assert.equal(calls(), 0);
});

test("a rejected refresh clears the session", async () => {
  saveTokens({ access_token: "old", refresh_token: "dead" });
  stubFetch(400, { error: "invalid_grant" });
  assert.equal(await refreshAccessToken("https://api", "old"), null);
  assert.equal(loadTokens(), null);
  clearTokens();
});
