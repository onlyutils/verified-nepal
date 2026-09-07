import { err, getQuery } from "../lib/http.js";
import { getIncidentById } from "../models/incident.js";
import { listNeedsByDistrictStatuses } from "../models/need.js";
import { PUBLIC_NEED_STATUSES } from "../constants.js";
import { aggregateCoverage, to3wCsv, to3wGeoJson } from "../views/coverage.js";

const CACHE = "public, max-age=300";

async function loadIncidentNeeds(ddb, tableName, incidentId) {
  const incident = await getIncidentById(ddb, tableName, incidentId);
  if (!incident || !["active", "archived"].includes(incident.status)) throw err(404, "incident not found");
  const needs = [];
  // ponytail: one GSI1 query per (district, status); move to counters at status transitions if an incident exceeds ~20 districts.
  for (const district of incident.affectedDistricts || []) needs.push(...(await listNeedsByDistrictStatuses(ddb, tableName, incidentId, district, PUBLIC_NEED_STATUSES)));
  return { incident, needs };
}

export async function handleGetCoverage(event, { getDdb, env }) {
  const incidentId = String(getQuery(event).incidentId || "").trim();
  if (!incidentId) throw err(400, "incidentId required");
  const { needs } = await loadIncidentNeeds(getDdb(), env.TABLE_NAME, incidentId);
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": CACHE }, body: JSON.stringify({ incidentId, generatedAt: new Date().toISOString(), rows: aggregateCoverage(needs) }) };
}

export async function handleGet3w(event, { getDdb, env }) {
  const q = getQuery(event);
  const incidentId = String(q.incidentId || "").trim();
  const format = String(q.format || "csv").toLowerCase();
  if (!incidentId) throw err(400, "incidentId required");
  if (!["csv", "geojson"].includes(format)) throw err(400, "format must be csv or geojson");
  const { needs } = await loadIncidentNeeds(getDdb(), env.TABLE_NAME, incidentId);
  const safe = incidentId.replace(/[^a-z0-9-]/gi, "");
  if (format === "geojson") return { statusCode: 200, headers: { "content-type": "application/geo+json", "cache-control": CACHE, "content-disposition": `attachment; filename="verifiednepal-3w-${safe}.geojson"` }, body: JSON.stringify(to3wGeoJson(needs)) };
  return { statusCode: 200, headers: { "content-type": "text/csv; charset=utf-8", "cache-control": CACHE, "content-disposition": `attachment; filename="verifiednepal-3w-${safe}.csv"` }, body: to3wCsv(needs) };
}
