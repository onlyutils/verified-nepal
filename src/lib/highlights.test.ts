import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NEWS_API_BASE = "https://api.news.verifiednepal.com";
process.env.VITE_NEWS_SITE_BASE = "https://news.verifiednepal.com";
const { NEWS_SITE_BASE, fetchHighlights } = await import("./highlights.ts");

test("maps published items to highlight rows with a news-site href and locality", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        items: [
          {
            id: "one",
            title: "Update one",
            language: "en",
            locality: { district: "Rasuwa", municipalityId: 29001, ward: 3 },
            happenedAt: "2026-10-27T08:00:00Z",
          },
          {
            id: "two",
            title: "Update two",
            language: "ne",
            locality: { district: "Rasuwa", municipalityId: 29001 },
            happenedAt: "2026-10-27T07:00:00Z",
          },
        ],
      }),
      { status: 200 },
    );
  const items = await fetchHighlights(6, fetchImpl);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: "one",
    title: "Update one",
    language: "en",
    place: "Gosaikunda · Ward 3",
    happenedAt: "2026-10-27T08:00:00Z",
    href: `${NEWS_SITE_BASE}/n/one`,
  });
  assert.equal(items[1].href, `${NEWS_SITE_BASE}/n/two`);
});

test("returns an empty list when the request rejects", async () => {
  assert.deepEqual(
    await fetchHighlights(6, async () => {
      throw new Error("offline");
    }),
    [],
  );
});

test("returns an empty list when the response is not an array of items", async () => {
  assert.deepEqual(await fetchHighlights(6, async () => new Response(JSON.stringify({}), { status: 200 })), []);
});
