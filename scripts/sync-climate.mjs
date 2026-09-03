import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const RECORD_API = "https://zenodo.org/api/records/16640595";
const RECORD_URL = "https://zenodo.org/records/16640595";
const GITHUB_URL = "https://github.com/jonesmattw/National_Warming_Contributions";
const OUT_DIR = path.resolve("public/data/climate");

const GMST_FILE = "GMST_response_1851-2024.csv";
const CUMULATIVE_FILE = "EMISSIONS_CUMULATIVE_CO2e100_1851-2024.csv";

const GROUP_CODES = new Set(["ANNEXI", "ANNEXII", "BASIC", "EIT", "EU27", "GLOBAL", "LDC", "LMDC", "NONANNEX", "OECD"]);
const TOP_N_TIMESERIES = 15;

async function fetchWithRetry(url, asJson) {
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
        headers: {
          accept: asJson ? "application/json" : "*/*",
          "user-agent": "verifiedNepal climate sync",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed ${url}: ${response.status} ${response.statusText}`);
      }

      return asJson ? response.json() : response.text();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

// Minimal RFC4180 line parser: fields are double-quoted, may contain commas within quotes.
function parseCsv(text) {
  const rows = [];
  const lines = text.split("\n");

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = [];
    let field = "";
    let inQuotes = false;
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c];
      if (inQuotes) {
        if (ch === '"' && line[c + 1] === '"') {
          field += '"';
          c += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    fields.push(field);
    if (fields.length < 6) continue;

    rows.push({
      name: fields[0],
      iso3: fields[1],
      gas: fields[2],
      component: fields[3],
      year: Number(fields[4]),
      value: Number(fields[5]),
    });
  }

  return rows;
}

function buildIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    index.set(`${row.iso3}|${row.gas}|${row.component}|${row.year}`, row.value);
  }
  return index;
}

function round(value, digits = 6) {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const record = await fetchWithRetry(RECORD_API, true);
  const files = record.files ?? [];
  const gmstFile = files.find((f) => f.key === GMST_FILE);
  const cumulativeFile = files.find((f) => f.key === CUMULATIVE_FILE);
  if (!gmstFile) throw new Error(`Expected file "${GMST_FILE}" not found in current Zenodo record — dataset schema may have changed.`);
  if (!cumulativeFile) throw new Error(`Expected file "${CUMULATIVE_FILE}" not found in current Zenodo record — dataset schema may have changed.`);

  const [gmstText, cumulativeText] = await Promise.all([
    fetchWithRetry(gmstFile.links.self, false),
    fetchWithRetry(cumulativeFile.links.self, false),
  ]);

  const gmstRows = parseCsv(gmstText);
  const cumulativeRows = parseCsv(cumulativeText);
  if (!gmstRows.length) throw new Error(`Parsed zero rows from ${GMST_FILE}.`);

  const gmstIndex = buildIndex(gmstRows);
  const cumulativeIndex = buildIndex(cumulativeRows);

  const latestYear = gmstRows.reduce((max, row) => (row.year > max ? row.year : max), 0);
  const years = [...new Set(gmstRows.filter((r) => r.iso3 === "GLOBAL").map((r) => r.year))].sort((a, b) => a - b);

  const namesByIso3 = new Map();
  for (const row of gmstRows) {
    if (!GROUP_CODES.has(row.iso3) && !namesByIso3.has(row.iso3)) {
      namesByIso3.set(row.iso3, row.name);
    }
  }

  const globalWarming = gmstIndex.get(`GLOBAL|3-GHG|Total|${latestYear}`);
  if (globalWarming === undefined) throw new Error(`No GLOBAL 3-GHG Total value found for ${latestYear}.`);

  const countries = [];
  const skipped = [];
  for (const [iso3, name] of namesByIso3) {
    const warming = gmstIndex.get(`${iso3}|3-GHG|Total|${latestYear}`);
    if (warming === undefined) {
      skipped.push(iso3);
      continue;
    }
    countries.push({
      iso3,
      name,
      warming_c: round(warming),
      co2_c: round(gmstIndex.get(`${iso3}|CO[2]|Total|${latestYear}`)),
      ch4_c: round(gmstIndex.get(`${iso3}|CH[4]|Total|${latestYear}`)),
      n2o_c: round(gmstIndex.get(`${iso3}|N[2]*O|Total|${latestYear}`)),
      fossil_c: round(gmstIndex.get(`${iso3}|3-GHG|Fossil|${latestYear}`)),
      lulucf_c: round(gmstIndex.get(`${iso3}|3-GHG|LULUCF|${latestYear}`)),
      cumulative_pg_co2e100: round(cumulativeIndex.get(`${iso3}|3-GHG|Total|${latestYear}`)),
      share_pct: round((warming / globalWarming) * 100, 4),
    });
  }
  countries.sort((a, b) => b.warming_c - a.warming_c);

  if (skipped.length) {
    console.warn(`Skipped ${skipped.length} ISO3 codes missing a ${latestYear} 3-GHG Total value: ${skipped.join(", ")}`);
  }

  const rankingsByYear = years.map((year) => {
    const globalForYear = gmstIndex.get(`GLOBAL|3-GHG|Total|${year}`);
    const rows = [];
    for (const [iso3, name] of namesByIso3) {
      const warming = gmstIndex.get(`${iso3}|3-GHG|Total|${year}`);
      if (warming === undefined) continue;
      rows.push({
        iso3,
        name,
        warming_c: round(warming),
        share_pct: globalForYear ? round((warming / globalForYear) * 100, 4) : null,
      });
    }
    rows.sort((a, b) => b.warming_c - a.warming_c);
    const top = rows.slice(0, TOP_N_TIMESERIES);
    if (!top.some((r) => r.iso3 === "NPL")) {
      const nepal = rows.find((r) => r.iso3 === "NPL");
      if (nepal) top.push({ ...nepal, rank: rows.indexOf(nepal) + 1 });
    }
    return top.map((r) => (r.rank ? r : { ...r, rank: rows.indexOf(r) + 1 }));
  });

  const seriesIso3 = new Set(countries.slice(0, TOP_N_TIMESERIES).map((c) => c.iso3));
  seriesIso3.add("NPL");
  const series = { GLOBAL: years.map((year) => round(gmstIndex.get(`GLOBAL|3-GHG|Total|${year}`))) };
  for (const iso3 of seriesIso3) {
    series[iso3] = years.map((year) => round(gmstIndex.get(`${iso3}|3-GHG|Total|${year}`)));
  }

  const meta = {
    synced_at: new Date().toISOString(),
    latest_year: latestYear,
    global_warming_c: round(globalWarming),
    unit: "°C",
    source: {
      title: record.metadata?.title ?? null,
      authors: (record.metadata?.creators ?? []).map((c) => c.name),
      doi: record.metadata?.doi ?? record.doi ?? null,
      version: record.metadata?.version ?? null,
      publication_date: record.metadata?.publication_date ?? null,
      record_url: RECORD_URL,
      github_url: GITHUB_URL,
      license: "CC-BY-4.0",
    },
    methodology_note:
      "GMST response values represent an estimated contribution to global mean surface temperature change (IPCC AR6 TCRE methodology), not observed temperature within that country.",
  };

  await Promise.all([
    writeFile(path.join(OUT_DIR, "countries.json"), JSON.stringify(countries, null, 2)),
    writeFile(path.join(OUT_DIR, "timeseries.json"), JSON.stringify({ years, series }, null, 2)),
    writeFile(path.join(OUT_DIR, "rankings-by-year.json"), JSON.stringify({ years, byYear: rankingsByYear })),
    writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2)),
  ]);

  console.log(`Synced climate data for ${countries.length} countries, latest year ${latestYear}, from ${RECORD_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
