import assert from "node:assert/strict";
import test from "node:test";
import { climateMeta, dispatchMeta } from "./og-meta.ts";

test("dispatchMeta builds a title and a 200-char excerpt with author", () => {
  const meta = dispatchMeta({
    title: { en: "Glacier retreat in Langtang", ne: "लाङटाङ" },
    body: { en: "Line one.\n\nLine   two. " + "x".repeat(300) },
    author: { displayName: "Asha", place: "Dhunche" },
  });
  assert.equal(meta.title, "Glacier retreat in Langtang · verifiedNepal");
  assert.ok(meta.description.startsWith("Line one. Line two. xxx"));
  assert.ok(meta.description.endsWith(" — By Asha, Dhunche"));
  assert.equal(meta.description.length, 200 + " — By Asha, Dhunche".length);
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

test("climateMeta includes the computed share and Nepal in the description", () => {
  const meta = climateMeta();
  assert.match(meta.title, /%/);
  assert.match(meta.description, /Nepal/);
});
