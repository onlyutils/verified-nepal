import { nearestPointOnPath, pathLengthKm, pointAlongPath, type LatLng } from "./flood-geometry.ts";

export type Tile = { x: number; y: number };
export type TileIndex = Readonly<Record<string, readonly (readonly [number, number])[]>>;

export type CoverageRange = {
  fromM: number;
  toM: number;
  covered: boolean;
};

const ROUTE_ZOOM = 15;
const PARENT_ROUTE_ZOOM = 14;
const SAMPLE_INTERVAL_KM = 0.5;
const MAX_MERCATOR_LAT = 85.0511287798066;

function zoomLevel(z: number): number {
  return Math.max(0, Math.floor(z));
}

function tileCount(z: number): number {
  return 2 ** zoomLevel(z);
}

function wrapTileX(x: number, z: number): number {
  const count = tileCount(z);
  return ((x % count) + count) % count;
}

function tileKey(tile: Tile): string {
  return `${tile.x}:${tile.y}`;
}

function addTile(result: Tile[], seen: Set<string>, tile: Tile, z: number) {
  const normalized = { x: wrapTileX(tile.x, z), y: tile.y };
  const key = tileKey(normalized);
  if (seen.has(key)) return;
  seen.add(key);
  result.push(normalized);
}

/** Returns the standard Web Mercator XYZ tile containing a longitude/latitude. */
export function lngLatToTile(lng: number, lat: number, z: number): Tile {
  const zoom = zoomLevel(z);
  const count = 2 ** zoom;
  const clampedLng = Math.max(-180, Math.min(180, lng));
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const x = Math.max(0, Math.min(count - 1, Math.floor(((clampedLng + 180) / 360) * count)));
  const latitudeRadians = (clampedLat * Math.PI) / 180;
  const y = Math.max(0, Math.min(count - 1, Math.floor(((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * count)));
  return { x, y };
}

/** Returns a square tile neighborhood centered on a point. */
export function tilesAroundPoint(lat: number, lng: number, z: number, radiusTiles: number): Tile[] {
  const zoom = zoomLevel(z);
  const radius = Math.max(0, Math.ceil(radiusTiles));
  const center = lngLatToTile(lng, lat, zoom);
  const result: Tile[] = [];
  const seen = new Set<string>();
  addTile(result, seen, center, zoom);

  for (let ring = 1; ring <= radius; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const y = center.y + dy;
        if (y < 0 || y >= tileCount(zoom)) continue;
        addTile(result, seen, { x: center.x + dx, y }, zoom);
      }
    }
  }
  return result;
}

function sampledPath(path: LatLng[]): Array<{ point: LatLng; progress: number }> {
  if (path.length === 0) return [];
  if (path.length === 1) return [{ point: [...path[0]], progress: 0 }];

  const totalDistanceKm = pathLengthKm(path);
  if (totalDistanceKm === 0) return [{ point: [...path[0]], progress: 0 }];

  const sampleCount = Math.max(1, Math.ceil(totalDistanceKm / SAMPLE_INTERVAL_KM));
  const points = Array.from({ length: sampleCount + 1 }, (_, index) => ({
    point: pointAlongPath(path, index / sampleCount),
    progress: index / sampleCount,
  }));

  for (const point of path) {
    const projection = nearestPointOnPath(point, path);
    points.push({ point: [...point], progress: (projection?.distanceAlongKm ?? 0) / totalDistanceKm });
  }

  points.sort((a, b) => a.progress - b.progress);
  const result: Array<{ point: LatLng; progress: number }> = [];
  for (const item of points) {
    const previous = result[result.length - 1];
    if (previous?.point[0] === item.point[0] && previous.point[1] === item.point[1]) continue;
    result.push(item);
  }
  return result;
}

/** Returns deduplicated tiles along a path, sampled every roughly 500 metres. */
export function tilesAlongPath(path: LatLng[], z: number, bufferTiles = 1): Tile[] {
  const zoom = zoomLevel(z);
  const result: Tile[] = [];
  const seen = new Set<string>();
  const radius = Math.max(0, Math.ceil(bufferTiles));
  for (const { point } of sampledPath(path)) {
    for (const tile of tilesAroundPoint(point[0], point[1], zoom, radius)) addTile(result, seen, tile, zoom);
  }
  return result;
}

function tileLatitude(y: number, z: number): number {
  const count = tileCount(z);
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / count))) * 180) / Math.PI;
}

function tileLongitude(x: number, z: number): number {
  return (x / tileCount(z)) * 360 - 180;
}

/** Returns the geographic extent of every tile listed in a tile index. */
export function tileIndexBounds(tileIndex: TileIndex): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const [zoomText, entries] of Object.entries(tileIndex)) {
    const zoom = Number(zoomText);
    if (!Number.isInteger(zoom) || zoom < 0) continue;
    for (const entry of entries) {
      const [x, y] = entry;
      if (![x, y].every(Number.isInteger) || y < 0 || y >= tileCount(zoom)) continue;
      const normalizedX = wrapTileX(x, zoom);
      west = Math.min(west, tileLongitude(normalizedX, zoom));
      east = Math.max(east, tileLongitude(normalizedX + 1, zoom));
      north = Math.max(north, tileLatitude(y, zoom));
      south = Math.min(south, tileLatitude(y + 1, zoom));
    }
  }

  return Number.isFinite(west) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(north)
    ? [west, south, east, north]
    : null;
}

export function expandTemplate(template: string, z: number, tile: Tile): string {
  return template.replaceAll("{z}", String(z)).replaceAll("{x}", String(tile.x)).replaceAll("{y}", String(tile.y));
}

function addUrl(urls: string[], seen: Set<string>, template: string, z: number, tile: Tile) {
  const url = expandTemplate(template, z, tile);
  if (seen.has(url)) return;
  seen.add(url);
  urls.push(url);
}

function indexedTileSet(tileIndex: TileIndex, zoom: number): Set<string> {
  return new Set(
    (tileIndex[String(zoom)] ?? [])
      .filter(([x, y]) => Number.isInteger(x) && Number.isInteger(y))
      .map(([x, y]) => `${wrapTileX(x, zoom)}:${y}`),
  );
}

/** Returns merged covered/uncovered distance ranges using the indexed z14 mosaic tiles. */
export function coverageRangesFromTileIndex(path: LatLng[], tileIndex: TileIndex, stepM = 100): CoverageRange[] {
  if (path.length === 0) return [];

  const totalM = pathLengthKm(path) * 1000;
  const sampleStepM = Number.isFinite(stepM) && stepM > 0 ? stepM : 100;
  const sampleDistances = [0];
  for (let distanceM = sampleStepM; distanceM < totalM; distanceM += sampleStepM) sampleDistances.push(distanceM);
  if (totalM > 0) sampleDistances.push(totalM);

  const z14Tiles = indexedTileSet(tileIndex, 14);
  const rangeCount = totalM === 0 ? 1 : sampleDistances.length - 1;
  const ranges: CoverageRange[] = [];
  for (let index = 0; index < rangeCount; index += 1) {
    const fromM = sampleDistances[index];
    const toM = totalM === 0 ? 0 : sampleDistances[index + 1];
    const point = totalM === 0 ? path[0] : pointAlongPath(path, fromM / totalM);
    const tile = lngLatToTile(point[1], point[0], 14);
    const covered = z14Tiles.has(tileKey(tile));
    const previous = ranges[ranges.length - 1];
    if (previous?.covered === covered && previous.toM === fromM) {
      previous.toM = toM;
    } else {
      ranges.push({ fromM, toM, covered });
    }
  }
  return ranges;
}

function parentTiles(tiles: readonly Tile[], zoom: number, parentZoom: number): Tile[] {
  const factor = 2 ** Math.max(0, zoom - parentZoom);
  const result: Tile[] = [];
  const seen = new Set<string>();
  for (const tile of tiles) {
    const parent = { x: Math.floor(tile.x / factor), y: Math.floor(tile.y / factor) };
    addTile(result, seen, parent, parentZoom);
  }
  return result;
}

/** Builds a route-ordered, deduplicated warm-up list for all drive imagery. */
export function buildPrefetchUrls({
  routePath,
  tileIndex,
  basemapTemplate,
  afterTilesTemplate,
}: {
  routePath: LatLng[];
  tileIndex: TileIndex;
  basemapTemplate: string;
  afterTilesTemplate: string | null;
}): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const indexedByZoom = new Map<number, Set<string>>();
  const appendRouteTiles = (zoom: number, tiles: readonly Tile[]) => {
    const indexed = indexedByZoom.get(zoom) ?? indexedTileSet(tileIndex, zoom);
    indexedByZoom.set(zoom, indexed);
    for (const tile of tiles) {
      addUrl(urls, seen, basemapTemplate, zoom, tile);
      if (afterTilesTemplate && indexed.has(tileKey(tile))) addUrl(urls, seen, afterTilesTemplate, zoom, tile);
    }
  };

  // The drive camera at zoom ~13.7 shows a ~10 km × 6 km ground window, rotated to follow the
  // river, so tiles up to ~6 km from the line are on screen: 5 z15 tiles (≈1.2 km each) either side.
  const routeTiles = tilesAlongPath(routePath, ROUTE_ZOOM, 5);
  appendRouteTiles(ROUTE_ZOOM, routeTiles);
  appendRouteTiles(PARENT_ROUTE_ZOOM, parentTiles(routeTiles, ROUTE_ZOOM, PARENT_ROUTE_ZOOM));
  return urls;
}

export type PrefetchOptions = {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

/** Warms browser HTTP cache entries with bounded parallel fetches. */
export async function prefetchUrls(urls: readonly string[], options: PrefetchOptions = {}): Promise<void> {
  const { concurrency = 16, onProgress, signal } = options;
  if (signal?.aborted || urls.length === 0) return;

  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.max(1, Math.min(urls.length, Math.floor(concurrency) || 1));
  const worker = async () => {
    while (true) {
      if (signal?.aborted) return;
      const index = nextIndex++;
      if (index >= urls.length) return;
      try {
        const response = await fetch(urls[index], { mode: "cors", credentials: "same-origin", signal });
        if (response.ok) await response.arrayBuffer();
      } catch {
        // A missing tile or an aborted request should not prevent the story from playing.
      }
      if (signal?.aborted) return;
      completed += 1;
      onProgress?.(completed, urls.length);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
}
