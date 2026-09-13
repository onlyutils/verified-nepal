export type FloodFrame = {
  week: string;
  dateRange: [string, string];
  source: "s1" | "s2";
  beforeUrl: string;
  afterUrl: string;
  classOverlayUrl?: string;
  /** Date range of the "before" composite; older manifests only carry the after range. */
  beforeDateRange?: [string, string];
  /** Share of the frame that was cloud-free in the after composite. */
  clearPct?: number;
  /** [[south, west], [north, east]] of the crop, so the PNGs can be laid over the basemap. */
  bounds?: [[number, number], [number, number]];
  location: { lat: number; lng: number; label: string; distanceKm?: number; arrivalLabel?: string };
};

export type FloodManifest = {
  event: string;
  aoi: { type: string; coordinates: unknown; source: string };
  coverageReport: { week: string; validPixelPct: number; usable: boolean }[];
  classification: { threshold: number; unit: string; justification: string };
  frames: FloodFrame[];
  timelapseGifUrl: string;
};

export type FloodAfterScenesData = {
  frameDefaults: Record<string, string>;
  contextOnly: string[];
  storyStart: string;
  labelsNe: Record<string, string>;
};

export type FloodMedia = {
  kind: "video" | "youtube" | "image";
  src: string;
  poster: string | null;
  width: number;
  height: number;
  caption: string;
  credit: string;
  license: string;
  source: string;
  href: string;
  date: string;
};

export type FloodAfterTilesMeta = {
  zooms: number[];
  tileUrl: string;
  tiles: number;
  tileIndex: Readonly<Record<string, readonly (readonly [number, number])[]>>;
  scenes: Array<{ id: string; date: string; gsd: number }>;
  corridor: Record<string, unknown>;
};

export class FloodManifestError extends Error {
  code: "not_found" | "invalid";
  constructor(code: "not_found" | "invalid", message: string) {
    super(message);
    this.code = code;
  }
}

function isValidManifest(value: unknown): value is FloodManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.event === "string" &&
    Array.isArray(m.coverageReport) &&
    Array.isArray(m.frames) &&
    m.frames.length > 0 &&
    typeof m.timelapseGifUrl === "string" &&
    !!m.aoi &&
    !!m.classification
  );
}

function isValidAfterTilesMeta(value: unknown): value is FloodAfterTilesMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Record<string, unknown>;
  return (
    Array.isArray(meta.zooms) &&
    typeof meta.tileUrl === "string" &&
    typeof meta.tiles === "number" &&
    !!meta.tileIndex &&
    typeof meta.tileIndex === "object" &&
    Array.isArray(meta.scenes) &&
    !!meta.corridor &&
    typeof meta.corridor === "object"
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isValidFloodAfterScenesData(value: unknown): value is FloodAfterScenesData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    isStringRecord(data.frameDefaults) &&
    Array.isArray(data.contextOnly) &&
    data.contextOnly.every((item) => typeof item === "string") &&
    typeof data.storyStart === "string" &&
    isStringRecord(data.labelsNe)
  );
}

export function floodSiblingUrl(manifestUrl: string, file: string): string {
  return manifestUrl.replace(/manifest\.json(?:$|(?=[?#]))/, file);
}

export function afterTilesBaseUrl(manifestUrl: string): string {
  return floodSiblingUrl(manifestUrl, "after-tiles/");
}

export async function fetchFloodManifest(url: string, fetchImpl: typeof fetch = fetch): Promise<FloodManifest> {
  const res = await fetchImpl(url);
  if (res.status === 404) throw new FloodManifestError("not_found", `manifest not found at ${url}`);
  if (!res.ok) throw new FloodManifestError("invalid", `manifest fetch failed with status ${res.status}`);
  const data = await res.json();
  if (!isValidManifest(data)) throw new FloodManifestError("invalid", "manifest is missing required fields");
  return data;
}

export async function fetchAfterTilesMeta(url: string, fetchImpl: typeof fetch = fetch): Promise<FloodAfterTilesMeta | null> {
  const metaUrl = `${afterTilesBaseUrl(url)}meta.json`;
  const res = await fetchImpl(metaUrl);
  if (res.status === 404) return null;
  if (!res.ok) throw new FloodManifestError("invalid", `after-tiles metadata fetch failed with status ${res.status}`);
  const data = await res.json();
  if (!isValidAfterTilesMeta(data)) throw new FloodManifestError("invalid", "after-tiles metadata is missing required fields");
  return data;
}

export async function fetchFloodSceneData(manifestUrl: string, fetchImpl: typeof fetch = fetch): Promise<FloodAfterScenesData> {
  const sceneUrl = floodSiblingUrl(manifestUrl, "after-scenes.json");
  const res = await fetchImpl(sceneUrl);
  if (!res.ok) {
    throw new FloodManifestError(
      "invalid",
      res.status === 404 ? `flood scene data not found at ${sceneUrl}` : `flood scene data fetch failed with status ${res.status}`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new FloodManifestError("invalid", "flood scene data is not valid JSON");
  }
  if (!isValidFloodAfterScenesData(data)) throw new FloodManifestError("invalid", "flood scene data is missing required fields");
  return data;
}

export async function fetchFloodMedia(manifestUrl: string, fetchImpl: typeof fetch = fetch): Promise<FloodMedia[]> {
  const mediaUrl = floodSiblingUrl(manifestUrl, "media.json");
  const res = await fetchImpl(mediaUrl);
  if (!res.ok) return [];

  try {
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as FloodMedia[]) : [];
  } catch {
    return [];
  }
}
