import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BASE_URL = "https://ndrrma.gov.np/api/v1/rescues/";
const OUT_DIR = path.resolve("public/data");

const endpoints = {
  persons: "rescued-persons/?limit=200&offset=0",
  statusCounts: "status-counts/",
  rescuedStatistics: "rescued-statistics/",
  rescuedLocations: "rescued-locations/",
  stationedLocations: "stationed-locations/",
  statuses: "statuses/",
  messages: "messages/",
};

function endpointUrl(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

async function fetchJson(url) {
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          accept: "application/json",
          "user-agent": "verifiedNepal local sync",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed ${url}: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw lastError;
}

async function fetchPaginated(url) {
  const pages = [];
  let next = url;

  while (next) {
    const page = await fetchJson(next);
    pages.push(page);
    next = page.next;
  }

  return {
    count: pages[0]?.count ?? 0,
    results: pages.flatMap((page) => page.results ?? []),
  };
}

function trimString(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

function normalizePerson(person) {
  const name = trimString(person.name ?? "");
  const name_ne = trimString(person.name_ne ?? "");
  const country = trimString(person.country ?? "");
  const nationality = trimString(person.nationality ?? "");

  return {
    id: person.id,
    name,
    name_ne,
    display_name: name_ne || name || "Name unavailable",
    age: person.age ?? null,
    rescued_location: person.rescued_location ?? null,
    stationed_location: person.stationed_location ?? null,
    status: person.status ?? null,
    rescued_date: person.rescued_date ?? null,
    nationality: nationality || null,
    country: country || null,
    gender: person.gender ?? null,
    remarks: trimString(person.remarks ?? "") || null,
  };
}

function groupCountryCounts(persons) {
  const counts = new Map();

  for (const person of persons) {
    const key = person.country || person.nationality || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

async function writeJson(filename, data) {
  await writeFile(path.join(OUT_DIR, filename), `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const [
    personsRaw,
    statusCounts,
    rescuedStatistics,
    rescuedLocations,
    stationedLocations,
    statuses,
    messages,
  ] = await Promise.all([
    fetchPaginated(endpointUrl(endpoints.persons)),
    fetchJson(endpointUrl(endpoints.statusCounts)),
    fetchJson(endpointUrl(endpoints.rescuedStatistics)),
    fetchJson(endpointUrl(endpoints.rescuedLocations)),
    fetchJson(endpointUrl(endpoints.stationedLocations)),
    fetchJson(endpointUrl(endpoints.statuses)),
    fetchJson(endpointUrl(endpoints.messages)),
  ]);

  const persons = {
    count: personsRaw.count,
    results: personsRaw.results.map(normalizePerson),
  };
  const countryCounts = groupCountryCounts(persons.results);

  const counts = {
    rescued_count: rescuedStatistics.rescued_count,
    verified_records: statusCounts.total_count,
    nepali_count: statusCounts.nepali_count,
    foreign_count: statusCounts.foreign_count,
    rescued_person_records: persons.results.length,
    rescued_locations: rescuedLocations.count ?? rescuedLocations.results?.length ?? 0,
    stationed_locations: stationedLocations.count ?? stationedLocations.results?.length ?? 0,
  };

  await Promise.all([
    writeJson("rescued-persons.json", persons),
    writeJson("country-counts.json", countryCounts),
    writeJson("status-counts.json", statusCounts),
    writeJson("rescued-statistics.json", rescuedStatistics),
    writeJson("rescued-locations.json", rescuedLocations),
    writeJson("stationed-locations.json", stationedLocations),
    writeJson("statuses.json", statuses),
    writeJson("messages.json", messages),
    writeJson("meta.json", {
      synced_at: new Date().toISOString(),
      source_url: BASE_URL,
      counts,
    }),
  ]);

  console.log(`Synced ${persons.results.length} rescued-person records from ${BASE_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
