import districtsGeo from "../public/data/geo/districts.json";
import riverGeo from "../public/data/geo/bhotekoshi.json";
import type { NamedLocation } from "./types";

export type DistrictName = "Rasuwa" | "Nuwakot" | "Sindhupalchok";

export interface PlacedLocation {
  location: NamedLocation;
  lat: number;
  lng: number;
  district: DistrictName;
  approximate?: true;
}

/**
 * NDRRMA publishes rescue locations as free-text place names with a null centroid,
 * so coordinates are resolved here from OpenStreetMap place nodes (verified by name
 * in Devanagari). Spelling variants in the feed each get their own key.
 */
const placeIndex: Record<string, { lat: number; lng: number; district: DistrictName; approximate?: true }> = {
  // Rasuwa — the Bhote Koshi corridor
  "रसुवागढी": { lat: 28.2778, lng: 85.3778, district: "Rasuwa" },
  "टिमुरे": { lat: 28.2528, lng: 85.3667, district: "Rasuwa" },
  "चिलिमे": { lat: 28.1836, lng: 85.3022, district: "Rasuwa" },
  "स्याफ्रुबेसी": { lat: 28.1637, lng: 85.3373, district: "Rasuwa" },
  "स्याफ्रुबेशी": { lat: 28.1637, lng: 85.3373, district: "Rasuwa" },
  "स्याफ्रुवेशी": { lat: 28.1637, lng: 85.3373, district: "Rasuwa" },
  "हाफुबेसी": { lat: 28.1165, lng: 85.2791, district: "Rasuwa" }, // हाकु बेसी / Haku Besi
  "धुन्चे": { lat: 28.1128, lng: 85.2961, district: "Rasuwa" },
  "मैलुङ": { lat: 28.0718, lng: 85.207, district: "Rasuwa" },
  // Approximate corridor stand-ins: confirmed Uttargaya RM settlements near Mailung, no published point found.
  "कोलनी": { lat: 28.0718, lng: 85.207, district: "Rasuwa", approximate: true },
  "सलिटार": { lat: 28.0718, lng: 85.207, district: "Rasuwa", approximate: true },
  "शान्ति बजार": { lat: 28.0173, lng: 85.1814, district: "Rasuwa" },
  "बेत्रावती": { lat: 27.9731, lng: 85.186, district: "Rasuwa" },
  "वेत्रवती": { lat: 27.9731, lng: 85.186, district: "Rasuwa" },
  // Nuwakot — downstream on the Trishuli
  "बट्टार": { lat: 27.8983, lng: 85.1463, district: "Nuwakot" },
  "त्रिशुली": { lat: 27.8953, lng: 85.1464, district: "Nuwakot" },
};

// मानेढुङ्गा intentionally remains unresolved: researched 2026-08-30, no corroborating source found.

/** District-level entries in the feed, in either script. */
const districtIndex: Record<string, DistrictName> = {
  "रसुवा": "Rasuwa",
  Rasuwa: "Rasuwa",
  "नुवाकोट": "Nuwakot",
  Nuwakot: "Nuwakot",
  "सिन्धुपाल्चोक": "Sindhupalchok",
  Sindhupalchok: "Sindhupalchok",
  Sindhupalchowk: "Sindhupalchok",
};

export const districtCenters: Record<DistrictName, [number, number]> = {
  Rasuwa: [28.1128, 85.2961], // Dhunche fallback for bare district titles.
  Nuwakot: [27.8953, 85.1464], // Bidur fallback for bare district titles.
  Sindhupalchok: [27.7751, 85.7148], // Chautara fallback for bare district titles.
};

export const districtLabels: Record<DistrictName, { en: string; ne: string }> = {
  Rasuwa: { en: "Rasuwa", ne: "रसुवा" },
  Nuwakot: { en: "Nuwakot", ne: "नुवाकोट" },
  Sindhupalchok: { en: "Sindhupalchok", ne: "सिन्धुपाल्चोक" },
};

export const districtNames = Object.keys(districtLabels) as DistrictName[];

/** "वेत्रवती, रसुवा" and "Sindhupalchok " both reduce to their bare place name. */
function placeKey(title: string) {
  return title.split(",")[0].trim();
}

export function placeLocation(location: NamedLocation): PlacedLocation | null {
  const keys = [location.title_ne, location.title].filter(Boolean).map(placeKey);

  for (const key of keys) {
    const place = placeIndex[key];
    if (place) return { location, ...place };
  }
  for (const key of keys) {
    const district = districtIndex[key];
    if (district) {
      const [lat, lng] = districtCenters[district];
      return { location, lat, lng, district };
    }
  }
  return null;
}

/** District a location belongs to, even when its own coordinates are unknown. */
export function locationDistrict(location: NamedLocation): DistrictName | null {
  const placed = placeLocation(location);
  if (placed) return placed.district;
  const suffix = (location.title_ne || location.title || "").split(",")[1]?.trim();
  return suffix ? districtIndex[suffix] ?? null : null;
}

type Ring = Array<[number, number]>;

interface DistrictFeature {
  properties: { name: string; name_ne: string };
  geometry: { type: "MultiPolygon"; coordinates: Ring[][] };
}

/** Leaflet wants [lat, lng]; GeoJSON stores [lng, lat]. */
const flip = (ring: Ring): Array<[number, number]> => ring.map(([lng, lat]) => [lat, lng]);

export const districtShapes: Record<DistrictName, Array<Array<[number, number]>>> = (
  districtsGeo as unknown as { features: DistrictFeature[] }
).features.reduce(
  (acc, feature) => {
    acc[feature.properties.name as DistrictName] = feature.geometry.coordinates.map((polygon) =>
      flip(polygon[0]),
    );
    return acc;
  },
  {} as Record<DistrictName, Array<Array<[number, number]>>>,
);

export const riverPath: Array<[number, number]> = flip(
  (riverGeo as unknown as { features: Array<{ geometry: { coordinates: Ring } }> }).features[0]
    .geometry.coordinates,
);
