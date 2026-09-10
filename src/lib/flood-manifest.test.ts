import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFloodManifest, FloodManifestError } from "./flood-manifest.ts";

const validManifest = {
  event: "trishuli-2026-08-26",
  aoi: { type: "Polygon", coordinates: [], source: "hand-drawn" },
  coverageReport: [{ week: "2026-W35", validPixelPct: 91, usable: true }],
  classification: { threshold: -3.5, unit: "dB", justification: "test" },
  frames: [
    {
      week: "2026-W35",
      dateRange: ["2026-08-24", "2026-08-30"],
      source: "s1",
      beforeUrl: "https://cdn.example/before.png",
      afterUrl: "https://cdn.example/after.png",
      location: { lat: 28.1, lng: 85.3, label: "Trishuli Bazaar" },
    },
  ],
  timelapseGifUrl: "https://cdn.example/timelapse.gif",
};

function fakeFetch(status: number, body: unknown) {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response;
}

test("fetchFloodManifest returns the manifest on success", async () => {
  const manifest = await fetchFloodManifest("https://cdn.example/manifest.json", fakeFetch(200, validManifest));
  assert.equal(manifest.event, "trishuli-2026-08-26");
  assert.equal(manifest.frames.length, 1);
});

test("fetchFloodManifest throws a not_found error on 404", async () => {
  await assert.rejects(
    () => fetchFloodManifest("https://cdn.example/manifest.json", fakeFetch(404, null)),
    (err: unknown) => err instanceof FloodManifestError && err.code === "not_found"
  );
});

test("fetchFloodManifest throws an invalid error when frames is missing", async () => {
  const { frames, ...rest } = validManifest;
  await assert.rejects(
    () => fetchFloodManifest("https://cdn.example/manifest.json", fakeFetch(200, rest)),
    (err: unknown) => err instanceof FloodManifestError && err.code === "invalid"
  );
});
