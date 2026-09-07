#!/usr/bin/env node
// Builds the admin-unit dataset from BIPAD's public API. Rerun by hand; commit the diff.
//   node scripts/build-admin-units.mjs
import { writeFileSync } from "node:fs";

const BASE = "https://bipadportal.gov.np/api/v1";
const KEEP_TYPES = new Set(["Rural Municipality", "Municipality", "Submetropolitan City", "Metropolitan City"]);
// BIPAD spelling → server DISTRICTS spelling.
const DISTRICT_MAP = {
  Terhathum: "Tehrathum", Kapilbastu: "Kapilvastu", "Rukum East": "RukumEast", "Rukum West": "RukumWest",
  Dhanusa: "Dhanusha", Tanahu: "Tanahun", "Nawalparasi East": "Nawalpur", "Nawalparasi West": "NawalparasiWest",
};

async function fetchAll(resource) {
  const res = await fetch(`${BASE}/${resource}/?limit=10000`);
  if (!res.ok) throw new Error(`${resource}: HTTP ${res.status}`);
  return (await res.json()).results;
}

const [provinces, districts, munis, wards] = await Promise.all(["province", "district", "municipality", "ward"].map(fetchAll));

const provinceName = Object.fromEntries(provinces.map((p) => [p.id, p.title_en]));
const districtById = Object.fromEntries(districts.map((d) => [d.id, { name: DISTRICT_MAP[d.title_en] ?? d.title_en, province: provinceName[d.province], lat: d.centroid.coordinates[1], lng: d.centroid.coordinates[0] }]));

const wardsByMuni = {};
for (const w of wards) (wardsByMuni[w.municipality] ??= []).push(w);

const dropped = munis.filter((m) => !KEEP_TYPES.has(m.type));
const municipalities = munis
  .filter((m) => KEEP_TYPES.has(m.type))
  .map((m) => {
    const d = districtById[m.district];
    const list = (wardsByMuni[m.id] ?? [])
      .filter((w) => /^\d+$/.test(w.title) && Number(w.title) >= 1 && Number(w.title) <= 33)
      .sort((a, b) => Number(a.title) - Number(b.title))
      .filter((w, index, rows) => index === 0 || w.title !== rows[index - 1].title);
    // Keyed by BIPAD ward number (not position): BIPAD lacks polygons for a few wards, e.g. municipality 45008 has 1-6 and 9.
    const wardCentroids = Object.fromEntries(list.map((w) => [w.title, [round(w.centroid.coordinates[1]), round(w.centroid.coordinates[0])]]));
    return {
      id: m.id, district: d.name, province: d.province, name: m.title_en, nameNe: m.title_ne, type: m.type,
      wards: Math.max(0, ...list.map((w) => Number(w.title))), lat: round(m.centroid.coordinates[1]), lng: round(m.centroid.coordinates[0]), wardCentroids,
    };
  })
  .sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));

function round(n) { return Math.round(n * 1e5) / 1e5; }

const districtsOut = Object.fromEntries(Object.values(districtById).map((d) => [d.name, { province: d.province, lat: round(d.lat), lng: round(d.lng) }]));

writeFileSync("server/src/data/admin-units.json", JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), source: BASE, districts: districtsOut, municipalities }, null, 0) + "\n");
writeFileSync("src/lib/admin-units.json", JSON.stringify(municipalities.map(({ wardCentroids, province, ...rest }) => rest)) + "\n");

console.log(`municipalities kept: ${municipalities.length}; dropped (${dropped.length}):`);
for (const m of dropped) console.log(`  ${m.id} ${m.title_en} [${m.type}]`);
const noWards = municipalities.filter((m) => m.wards === 0);
if (noWards.length) { console.error("municipalities without wards:", noWards.map((m) => m.name)); process.exit(1); }
