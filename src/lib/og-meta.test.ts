import assert from "node:assert/strict";
import test from "node:test";
import { centerMeta, climateMeta, dispatchJsonLd, dispatchMeta, projectMeta, STATIC_PAGE_META } from "./og-meta.ts";

test("new static page metadata has titles and useful descriptions", () => {
  const keys = ["floodImpact", "info", "howTo", "ourMessage", "articles", "privacy", "ledger", "audit", "coverage", "incidents", "drones"];
  for (const key of keys) {
    const meta = STATIC_PAGE_META[key];
    assert.ok(meta.title.endsWith("· verifiedNepal"));
    assert.ok(meta.title.trim().length > 0);
    assert.ok(meta.description.length >= 50 && meta.description.length <= 170);
  }
});

test("dispatchMeta builds a title and a <=155-char excerpt with author, kept under the meta description limit", () => {
  const meta = dispatchMeta({
    title: { en: "Glacier retreat in Langtang", ne: "लाङटाङ" },
    body: { en: "Line one.\n\nLine   two. " + "x".repeat(300) },
    author: { displayName: "Asha", place: "Dhunche" },
  });
  assert.equal(meta.title, "Glacier retreat in Langtang · verifiedNepal");
  assert.ok(meta.description.startsWith("Line one. Line two. xxx"));
  assert.ok(meta.description.endsWith(" — By Asha, Dhunche"));
  assert.ok(meta.description.length <= 160);
});

test("dispatchMeta tolerates plain strings and missing author", () => {
  const meta = dispatchMeta({ title: "  Plain ", body: "Short" });
  assert.deepEqual(meta, { title: "Plain · verifiedNepal", description: "Short" });
});

test("dispatchMeta includes the cover image and caption for sharing", () => {
  const meta = dispatchMeta({
    title: "A clear title",
    body: "Short",
    cover: { url: " https://cdn.example/cover.jpg ", caption: "River valley after rain" },
  });
  assert.equal(meta.image, "https://cdn.example/cover.jpg");
  assert.equal(meta.imageAlt, "River valley after rain");
});

test("dispatchMeta uses the title as image alt text when the cover has no caption", () => {
  const meta = dispatchMeta({ title: "A clear title", body: "Short", cover: { url: "https://cdn.example/cover.jpg" } });
  assert.equal(meta.imageAlt, "A clear title");
});

test("dispatchJsonLd includes article and publisher data", () => {
  const data = dispatchJsonLd({
    title: { en: "Glacier retreat in Langtang", ne: "लाङटाङ" },
    body: "Article body",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    cover: { url: "https://cdn.example/cover.jpg" },
    author: { displayName: "Asha" },
  }, "https://verifiednepal.com/articles/a1");
  assert.equal(data["@type"], "Article");
  assert.equal(data.headline, "Glacier retreat in Langtang");
  assert.deepEqual(data.author, { "@type": "Person", name: "Asha" });
  assert.equal((data.publisher as { name: string }).name, "verifiedNepal");
});

test("dispatchJsonLd omits optional values from a minimal item", () => {
  const data = dispatchJsonLd({ title: "A clear title", body: "Short" }, "https://verifiednepal.com/articles/a1");
  assert.equal(data.headline, "A clear title");
  assert.equal("author" in data, false);
  assert.equal("image" in data, false);
  assert.equal("datePublished" in data, false);
});

test("climateMeta includes the computed share and Nepal in the description", () => {
  const meta = climateMeta();
  assert.match(meta.title, /%/);
  assert.match(meta.description, /Nepal/);
});

test("projectMeta uses the first published photo, skipping pending ones", () => {
  const meta = projectMeta({
    title: "Tuin over the Bhote Koshi",
    description: "A cable crossing for three wards.",
    photos: [
      { url: "https://cdn.example/pending.jpg", status: "pending" },
      { url: " https://cdn.example/published.jpg ", caption: "The finished crossing", status: "published" },
    ],
  });
  assert.equal(meta.title, "Tuin over the Bhote Koshi · verifiedNepal");
  assert.equal(meta.image, "https://cdn.example/published.jpg");
  assert.equal(meta.imageAlt, "The finished crossing");
});

test("projectMeta has no image when there is no published photo", () => {
  const meta = projectMeta({ title: "A project", description: "Details", photos: [{ url: "https://cdn.example/p.jpg", status: "pending" }] });
  assert.equal(meta.image, undefined);
});

test("centerMeta names the district and open/paused/closed status", () => {
  assert.match(centerMeta({ name: "Dhunche Bazaar", district: "Rasuwa", status: "open" }).description, /^Open drop center in Rasuwa\./);
  assert.match(centerMeta({ name: "X", district: "Y", status: "paused" }).description, /^Paused/);
  assert.match(centerMeta({ name: "X", district: "Y", status: "closed" }).description, /^Closed/);
});
