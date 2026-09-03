import countries from "../../public/data/climate/countries.json";
import timeseries from "../../public/data/climate/timeseries.json";
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
  meta: meta as unknown as ClimateMeta,
};
