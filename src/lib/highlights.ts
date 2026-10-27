import { municipalityById, municipalityLabel } from "./admin-units.ts";
import { districtLabels, type DistrictName } from "./districts.ts";
import { toDevanagariDigits } from "./bs-calendar.ts";

const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const processEnv = typeof process === "undefined" ? undefined : process.env;

export const NEWS_API_BASE = (viteEnv?.VITE_NEWS_API_BASE ?? processEnv?.VITE_NEWS_API_BASE ?? "").replace(/\/$/, "");
export const NEWS_SITE_BASE = (viteEnv?.VITE_NEWS_SITE_BASE ?? processEnv?.VITE_NEWS_SITE_BASE ?? "").replace(/\/$/, "");

export type HighlightItem = {
  id: string;
  title: string;
  language: "en" | "ne";
  place: string;
  happenedAt: string;
  href: string;
};

type NewsItem = {
  id?: unknown;
  title?: unknown;
  language?: unknown;
  locality?: { district?: unknown; municipalityId?: unknown; ward?: unknown };
  happenedAt?: unknown;
};

function placeLabel(locality: NewsItem["locality"], language: "en" | "ne"): string {
  if (!locality || typeof locality.district !== "string") return "";
  const municipalityId = Number(locality.municipalityId);
  const municipality = Number.isInteger(municipalityId) ? municipalityById(municipalityId) : undefined;
  const place =
    municipality?.district === locality.district
      ? municipalityLabel(municipality, language)
      : districtLabels[locality.district as DistrictName]?.[language] || locality.district;
  const ward =
    typeof locality.ward === "number" && Number.isInteger(locality.ward) && locality.ward > 0
      ? language === "ne"
        ? toDevanagariDigits(locality.ward)
        : String(locality.ward)
      : "";
  return [place, ward ? (language === "ne" ? `वडा ${ward}` : `Ward ${ward}`) : ""].filter(Boolean).join(" · ");
}

export async function fetchHighlights(limit = 6, fetchImpl: typeof fetch = fetch): Promise<HighlightItem[]> {
  if (!NEWS_API_BASE || !NEWS_SITE_BASE) return [];
  try {
    const response = await fetchImpl(`${NEWS_API_BASE}/news?limit=${limit}`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { items?: unknown };
    if (!Array.isArray(payload.items)) return [];
    return payload.items.flatMap((raw: NewsItem) => {
      if (
        typeof raw.id !== "string" ||
        !raw.id ||
        typeof raw.title !== "string" ||
        (raw.language !== "en" && raw.language !== "ne") ||
        typeof raw.happenedAt !== "string"
      )
        return [];
      const language = raw.language;
      return [
        {
          id: raw.id,
          title: raw.title,
          language,
          place: placeLabel(raw.locality, language),
          happenedAt: raw.happenedAt,
          href: `${NEWS_SITE_BASE}/n/${encodeURIComponent(raw.id)}`,
        },
      ];
    });
  } catch {
    return [];
  }
}
