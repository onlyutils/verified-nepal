import assert from "node:assert/strict";
import test from "node:test";
import { validateArticle } from "./validate.ts";

const cover = { url: "https://cdn.example/cover.jpg", fileId: "cover-1", source: "Author" };
const paragraph = { type: "paragraph" as const, text: "A useful paragraph." };

test("returns every missing strict-submit requirement", () => {
  assert.deepEqual(validateArticle({ title: "", cover: null, blocks: [], tags: [] }), ["title", "cover", "paragraph", "tags"]);
});

test("requires source on the cover and every media block", () => {
  assert.deepEqual(
    validateArticle({
      title: "A title",
      cover: { ...cover, source: "" },
      blocks: [paragraph, { type: "image", url: "https://cdn.example/a.jpg", fileId: "a", source: "" }],
      tags: ["story"],
    }),
    ["cover.source", "block.source:1"],
  );
});

test("accepts a complete article and ignores surrounding whitespace", () => {
  assert.deepEqual(
    validateArticle({ title: "  A title ", cover, blocks: [{ ...paragraph, text: "  text  " }], tags: ["story", "climate"] }),
    [],
  );
});

test("rejects invalid tag counts and duplicates", () => {
  assert.deepEqual(validateArticle({ title: "Title", cover, blocks: [paragraph], tags: ["story", "story"] }), ["tags"]);
  assert.deepEqual(validateArticle({ title: "Title", cover, blocks: [paragraph], tags: [] }), ["tags"]);
  assert.deepEqual(validateArticle({ title: "Title", cover, blocks: [paragraph], tags: ["a", "b", "c", "d"] }), ["tags"]);
  assert.deepEqual(validateArticle({ title: "Title", cover, blocks: [paragraph], tags: ["story "] }), ["tags"]);
});
