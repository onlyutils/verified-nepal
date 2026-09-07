import test from "node:test";
import assert from "node:assert/strict";
import { isHashOnlyNavigation } from "./navigation.ts";

test("recognizes a hash-only navigation on the same route", () => {
  assert.equal(isHashOnlyNavigation("/how-to#what", "/how-to#asking-for-help"), true);
  assert.equal(isHashOnlyNavigation("/how-to?print=1#what", "/how-to?print=1#top"), true);
});

test("does not treat a pathname or query change as hash-only", () => {
  assert.equal(isHashOnlyNavigation("/how-to#what", "/info#what"), false);
  assert.equal(isHashOnlyNavigation("/how-to?print=1#what", "/how-to#what"), false);
  assert.equal(isHashOnlyNavigation("/how-to#what", "/how-to#what"), false);
});
