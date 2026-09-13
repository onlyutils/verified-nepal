import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPrefetchUrls,
  coverageRangesFromTileIndex,
  lngLatToTile,
  prefetchUrls,
  tilesAlongPath,
  tilesAroundPoint,
} from "./flood-prefetch.ts";

test("lngLatToTile uses standard XYZ Web Mercator coordinates", () => {
  assert.deepEqual(lngLatToTile(0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(lngLatToTile(0, 0, 1), { x: 1, y: 1 });
  assert.deepEqual(lngLatToTile(180, 85.0511287798066, 2), { x: 3, y: 0 });
});

test("tilesAroundPoint returns a deduplicated square neighborhood", () => {
  assert.equal(tilesAroundPoint(0, 0, 4, 1).length, 9);
  assert.equal(new Set(tilesAroundPoint(0, 0, 4, 2).map(({ x, y }) => `${x}:${y}`)).size, 25);
  assert.equal(
    tilesAroundPoint(89, 0, 2, 2).every(({ y }) => y >= 0 && y < 4),
    true,
  );
});

test("tilesAlongPath samples long segments as well as vertices", () => {
  const path: [number, number][] = [
    [0, 0],
    [0, 60],
  ];
  const tiles = tilesAlongPath(path, 4, 0);
  assert.deepEqual(lngLatToTile(0, 0, 4), { x: 8, y: 8 });
  assert.deepEqual(lngLatToTile(30, 0, 4), { x: 9, y: 8 });
  assert.deepEqual(lngLatToTile(60, 0, 4), { x: 10, y: 8 });
  for (const point of path) assert.ok(tiles.some((tile) => tile.x === lngLatToTile(point[1], point[0], 4).x && tile.y === 8));
  assert.ok(tiles.some((tile) => tile.x === 9 && tile.y === 8));
});

test("coverageRangesFromTileIndex classifies route samples by their z14 tile", () => {
  const path: [number, number][] = [
    [0, 0],
    [0, 0.044],
  ];
  const covered = lngLatToTile(0, 0, 14);
  const ranges = coverageRangesFromTileIndex(path, { "14": [[covered.x, covered.y]] }, 2000);

  assert.deepEqual(
    ranges.map(({ fromM, covered: isCovered }) => [fromM, isCovered]),
    [
      [0, true],
      [4000, false],
    ],
  );
});

test("buildPrefetchUrls warms route z15 tiles, their z14 parents, and indexed after tiles", () => {
  const routeStart = lngLatToTile(0, 0, 15);
  const parent = lngLatToTile(0, 0, 14);
  const urls = buildPrefetchUrls({
    routePath: [
      [0, 0],
      [0, 0.02],
    ],
    tileIndex: {
      "14": [[parent.x, parent.y]],
      "15": [[routeStart.x, routeStart.y]],
    },
    basemapTemplate: "https://base/{z}/{y}/{x}",
    afterTilesTemplate: "https://after/{z}/{x}/{y}.png",
  });
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls[0], `https://base/15/${routeStart.y}/${routeStart.x}`);
  assert.ok(urls.includes(`https://after/15/${routeStart.x}/${routeStart.y}.png`));
  assert.ok(urls.includes(`https://base/14/${parent.y}/${parent.x}`));
  assert.ok(urls.includes(`https://after/14/${parent.x}/${parent.y}.png`));
  assert.ok(
    urls.every(
      (url) =>
        !url.startsWith("https://after/") || url.includes(`/${routeStart.x}/${routeStart.y}`) || url.includes(`/${parent.x}/${parent.y}`),
    ),
  );
  assert.ok(urls.every((url) => !url.includes("/13/")));
  assert.ok(urls.every((url) => !url.includes("undefined")));
});

test("prefetchUrls bounds concurrency, reports progress, and ignores failures", async () => {
  const originalFetch = globalThis.fetch;
  let active = 0;
  let maxActive = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    calls.push({ url: String(input), init });
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    if (String(input).endsWith("/bad")) throw new Error("missing");
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
  try {
    const progress: Array<[number, number]> = [];
    await prefetchUrls(["/one", "/bad", "/three"], { concurrency: 2, onProgress: (done, total) => progress.push([done, total]) });
    assert.equal(maxActive, 2);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].init.mode, "cors");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.deepEqual(progress.at(-1), [3, 3]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prefetchUrls stops immediately for an already-aborted signal", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
  try {
    const controller = new AbortController();
    controller.abort();
    await prefetchUrls(["/one"], { signal: controller.signal });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
