import { test } from "node:test";
import assert from "node:assert/strict";
import { isContextOnly, pinnedSceneId, selectStoryFrames, stopLabelNe, storyStartIndex, type FloodAfterScenesData } from "./flood-after-scenes.ts";
import type { FloodFrame } from "./flood-manifest.ts";

const fixture: FloodAfterScenesData = {
  frameDefaults: { "pinned-place": "scene-b", "another-pinned-place": "scene-b" },
  contextOnly: ["context-place"],
  storyStart: "pinned-place",
  labelsNe: { "pinned-place": "पिन गरिएको ठाउँ" },
};

const frame = (label: string): FloodFrame => ({
  week: "2026-08-26",
  dateRange: ["2026-08-26", "2026-08-27"],
  source: "s2",
  beforeUrl: "before",
  afterUrl: "after",
  location: { lat: 28, lng: 85, label },
});

test("selectStoryFrames keeps context stops and pinned imagery in manifest order", () => {
  const frames = [frame("Dropped Place"), frame("Context Place"), frame("Pinned Place"), frame("Later Place")];

  assert.deepEqual(
    selectStoryFrames(frames, fixture).map((item) => item.location.label),
    ["Context Place", "Pinned Place"],
  );
});

test("scene metadata identifies context stops, pinned scenes, and story start", () => {
  const frames = [frame("Context Place"), frame("Pinned Place")];

  assert.equal(isContextOnly("context-place", fixture), true);
  assert.equal(isContextOnly("pinned-place", fixture), false);
  assert.equal(pinnedSceneId("pinned-place", fixture), "scene-b");
  assert.equal(pinnedSceneId("missing-place", fixture), null);
  assert.equal(storyStartIndex(frames, fixture), 1);
  assert.equal(storyStartIndex([frame("Other Place")], fixture), 0);
});

test("stopLabelNe returns a matching label and undefined for a miss", () => {
  assert.equal(stopLabelNe("pinned-place", fixture), "पिन गरिएको ठाउँ");
  assert.equal(stopLabelNe("missing-place", fixture), undefined);
});
