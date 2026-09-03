import countries from "../../public/data/climate/countries.json";
import timeseries from "../../public/data/climate/timeseries.json";
import rankingsByYear from "../../public/data/climate/rankings-by-year.json";
import meta from "../../public/data/climate/meta.json";

export interface CountryClimate {
  iso3: string;
  name: string;
  warming_c: number;
  co2_c: number | null;
  ch4_c: number | null;
  n2o_c: number | null;
  fossil_c: number | null;
  lulucf_c: number | null;
  cumulative_pg_co2e100: number | null;
  share_pct: number;
}

export interface ClimateTimeseries {
  years: number[];
  series: Record<string, (number | null)[]>;
}

export interface YearRankingRow {
  iso3: string;
  name: string;
  warming_c: number;
  share_pct: number | null;
  rank: number;
}

export interface ClimateRankingsByYear {
  years: number[];
  byYear: YearRankingRow[][];
}

export interface ClimateFacts {
  nepal: CountryClimate;
  top: CountryClimate;
  nepalRank: number;
  total: number;
  nepalShare: string;
  topShare: string;
  ratio: number;
  lulucfPct: number;
}

let facts: ClimateFacts | undefined;

export function climateFacts(): ClimateFacts {
  if (facts) return facts;
  const countryList = countries as unknown as CountryClimate[];
  const nepal = countryList.find((country) => country.iso3 === "NPL");
  const sorted = [...countryList].sort((a, b) => b.warming_c - a.warming_c);
  const top = sorted[0];
  if (!nepal || !top) throw new Error("Climate dataset is missing Nepal or its top country");
  const rank = sorted.findIndex((country) => country.iso3 === "NPL") + 1;
  facts = {
    nepal,
    top,
    nepalRank: rank,
    total: countryList.length,
    nepalShare: nepal.share_pct.toFixed(2),
    topShare: top.share_pct.toFixed(2),
    ratio: Math.round(top.warming_c / nepal.warming_c),
    lulucfPct: Math.round(((nepal.lulucf_c ?? 0) / nepal.warming_c) * 100),
  };
  return facts;
}

/** GeoJSON world country boundaries (id = ISO3), loaded on demand — see world-map.tsx. */
export async function loadWorldGeoJson(): Promise<GeoJSON.FeatureCollection> {
  const mod = await import("../../public/data/climate/world-countries.geo.json");
  return mod.default as unknown as GeoJSON.FeatureCollection;
}

export interface ClimateMeta {
  synced_at: string;
  latest_year: number;
  global_warming_c: number;
  unit: string;
  source: {
    title: string | null;
    authors: string[];
    doi: string | null;
    version: string | null;
    publication_date: string | null;
    record_url: string;
    github_url: string;
    license: string;
  };
  methodology_note: string;
}

export const climateData = {
  countries: countries as unknown as CountryClimate[],
  timeseries: timeseries as unknown as ClimateTimeseries,
  rankingsByYear: rankingsByYear as unknown as ClimateRankingsByYear,
  meta: meta as unknown as ClimateMeta,
};
