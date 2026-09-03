import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.js";
import { FakeDdb, makeEvent } from "./helpers.js";
import { MAX_NEED_MEDIA_ITEMS } from "../src/constants.js";

function makeHandler(opts = {}) {
  const ddb = opts.ddb ?? new FakeDdb();
  const env = { TABLE_NAME: "t", ...opts.envOverrides };
  const handler = createHandler({ env, ddbClient: ddb, fetch: opts.fetch });
  return { handler, ddb };
}

function needBody(extra = {}) {
  return {
    onBehalf: false,
    beneficiary: { name: "Rita Gurung", district: "Gorkha", ward: 5 },
    category: "goods",
    description: "Need food and shelter for testing media support",
    language: "en",
    ...extra,
  };
}

describe("Need supporting media", () => {
  it("stores valid media on a created need", async () => {
    const { handler, ddb } = makeHandler();
    const media = [{ fileId: "f1", type: "photo", originalUrl: "https://example.com/f1.jpg" }];
    const response = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody({ media }) }));

    assert.equal(response.statusCode, 201);
    const { id } = JSON.parse(response.body);
    const stored = ddb.store.get(`NEED#${id}|META`);
    assert.deepEqual(stored.media, media);
  });

  it("rejects more than the supported media item limit", async () => {
    const { handler } = makeHandler();
    const media = Array.from({ length: MAX_NEED_MEDIA_ITEMS + 1 }, (_, index) => ({
      fileId: `f${index}`,
      type: "photo",
      originalUrl: `https://example.com/f${index}.jpg`,
    }));
    const response = await handler(makeEvent({ method: "POST", path: "/needs", body: needBody({ media }) }));

    assert.equal(response.statusCode, 400);
  });

  it("rejects an invalid media type", async () => {
    const { handler } = makeHandler();
    const response = await handler(
      makeEvent({
        method: "POST",
        path: "/needs",
        body: needBody({ media: [{ fileId: "f1", type: "audio", originalUrl: "https://example.com/f1.mp3" }] }),
      }),
    );

    assert.equal(response.statusCode, 400);
  });

  it("rejects an unsupported presign content type", async () => {
    const { handler } = makeHandler({ envOverrides: { OU_MEDIA_CLIENT_ID: "client", OU_MEDIA_CLIENT_SECRET: "secret" } });
    const response = await handler(
      makeEvent({
        method: "POST",
        path: "/needs/media/presign",
        body: { filename: "file.pdf", contentType: "application/pdf", size: 100 },
      }),
    );

    assert.equal(response.statusCode, 400);
  });

  it("returns media_not_configured without contacting the media service", async () => {
    let fetchCalled = false;
    const { handler } = makeHandler({ fetch: async () => { fetchCalled = true; } });
    const response = await handler(
      makeEvent({
        method: "POST",
        path: "/needs/media/presign",
        body: { filename: "file.jpg", contentType: "image/jpeg", size: 100 },
      }),
    );

    assert.equal(response.statusCode, 503);
    assert.deepEqual(JSON.parse(response.body), { error: "media_not_configured" });
    assert.equal(fetchCalled, false);
  });
});
