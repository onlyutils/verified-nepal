import assert from "node:assert/strict";
import test from "node:test";
import { dispatchMeta } from "./og-meta.ts";

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
