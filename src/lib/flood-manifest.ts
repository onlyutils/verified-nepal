export type FloodFrame = {
  week: string;
  dateRange: [string, string];
  source: "s1" | "s2";
  beforeUrl: string;
  afterUrl: string;
  classOverlayUrl?: string;
  location: { lat: number; lng: number; label: string };
};

export type FloodManifest = {
  event: string;
  aoi: { type: string; coordinates: unknown; source: string };
  coverageReport: { week: string; validPixelPct: number; usable: boolean }[];
  classification: { threshold: number; unit: string; justification: string };
  frames: FloodFrame[];
  timelapseGifUrl: string;
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

export async function fetchFloodManifest(url: string, fetchImpl: typeof fetch = fetch): Promise<FloodManifest> {
  const res = await fetchImpl(url);
  if (res.status === 404) throw new FloodManifestError("not_found", `manifest not found at ${url}`);
  if (!res.ok) throw new FloodManifestError("invalid", `manifest fetch failed with status ${res.status}`);
  const data = await res.json();
  if (!isValidManifest(data)) throw new FloodManifestError("invalid", "manifest is missing required fields");
  return data;
}
