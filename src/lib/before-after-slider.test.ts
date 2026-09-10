import { test } from "node:test";
import assert from "node:assert/strict";
import { clipPercentFromPointer } from "./before-after-slider.ts";

test("clipPercentFromPointer returns 50 at the midpoint", () => {
  assert.equal(clipPercentFromPointer(150, { left: 100, width: 100 }), 50);
});

test("clipPercentFromPointer clamps below 0 to 0", () => {
  assert.equal(clipPercentFromPointer(50, { left: 100, width: 100 }), 0);
});

test("clipPercentFromPointer clamps above 100 to 100", () => {
  assert.equal(clipPercentFromPointer(500, { left: 100, width: 100 }), 100);
});
