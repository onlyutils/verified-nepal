import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { pingIndexNow } from "../src/lib/indexnow.js";

describe("pingIndexNow", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it("posts the full url list to the IndexNow endpoint", async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
    await pingIndexNow(["/articles/abc"], {});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.indexnow.org/indexnow");
    assert.equal(calls[0].body.host, "verifiednepal.com");
    assert.deepEqual(calls[0].body.urlList, ["https://verifiednepal.com/articles/abc"]);
    assert.equal(calls[0].body.keyLocation, `https://verifiednepal.com/${calls[0].body.key}.txt`);
  });

  it("no-ops when INDEXNOW_DISABLED is set", async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return { ok: true }; };
    await pingIndexNow(["/articles/abc"], { INDEXNOW_DISABLED: "1" });
    assert.equal(called, false);
  });

  it("swallows fetch failures", async () => {
    globalThis.fetch = async () => { throw new Error("network down"); };
    await assert.doesNotReject(pingIndexNow(["/articles/abc"], {}));
  });
});
