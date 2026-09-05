import assert from "node:assert/strict";
import test from "node:test";
import { layoutWordCloud, type PlacedWord } from "./word-cloud.ts";

const measure = (text: string, size: number) => ({ width: text.length * size * 0.6, height: size * 1.2 });

function overlaps(a: PlacedWord, b: PlacedWord) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

test("places a weighted cloud largest-first without overlaps", () => {
  const words = Array.from({ length: 30 }, (_, index) => ({ text: `w${index + 1}`, weight: index + 1 }));
  const placed = layoutWordCloud(words, { width: 1000, height: 600, minSize: 20, maxSize: 80, measure });

  assert.equal(placed.length, 30);
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) assert.equal(overlaps(placed[i], placed[j]), false);
  }
  assert.equal(placed[0].weight, 30);
  assert.equal(placed[0].size, 80);
  for (let i = 1; i < placed.length; i += 1) assert.ok(placed[i - 1].size >= placed[i].size);
  assert.ok(Math.abs(placed[0].x - 500) < 1 && Math.abs(placed[0].y - 300) < 1);
});

test("handles empty input", () => {
  assert.deepEqual(layoutWordCloud([], { width: 100, height: 100, minSize: 10, maxSize: 20, measure }), []);
});

test("drops a word wider than the canvas", () => {
  const placed = layoutWordCloud([{ text: "too-wide", weight: 1 }], { width: 20, height: 100, minSize: 20, maxSize: 20, measure });
  assert.deepEqual(placed, []);
});

test("every word is placed even when the round cloud shape is crowded", () => {
  // Reproduces the real bug: ~36 distinct messages (a handful with a big weight lead,
  // most tied at weight 1) crammed into the 960x520 circular word-cloud canvas used on
  // /climate used to leave most of the low-weight words unplaced.
  const words = [
    { text: "Don't Melt Nepal", weight: 6 },
    { text: "We Didn't Cause", weight: 4 },
    { text: "Enough With Heating", weight: 3 },
    { text: "Keep Mountains Frozen", weight: 3 },
    { text: "We Deserve Better", weight: 3 },
    { text: "You've Done Enough", weight: 3 },
    ...Array.from({ length: 30 }, (_, index) => ({ text: `Message ${index}`, weight: 1 })),
  ];
  const placed = layoutWordCloud(words, {
    width: 960,
    height: 520,
    minSize: 18,
    maxSize: 72,
    padding: 6,
    measure,
  });
  assert.equal(placed.length, words.length);
});
