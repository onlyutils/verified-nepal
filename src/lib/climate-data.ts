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
