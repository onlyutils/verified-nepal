import data from "../data/admin-units.json" with { type: "json" };

const byId = new Map(data.municipalities.map((m) => [m.id, m]));
const byDistrict = new Map();
for (const m of data.municipalities) {
  if (!byDistrict.has(m.district)) byDistrict.set(m.district, []);
  byDistrict.get(m.district).push(m);
}

export const DISTRICT_CENTROIDS = Object.fromEntries(Object.entries(data.districts).map(([name, d]) => [name, [d.lat, d.lng]]));
export const PROVINCE_OF = Object.fromEntries(Object.entries(data.districts).map(([name, d]) => [name, d.province]));

export function getMunicipality(id) { return byId.get(Number(id)); }
export function listMunicipalities(district) { return byDistrict.get(district) ?? []; }
export function municipalityInDistrict(id, district) { return getMunicipality(id)?.district === district; }
export function wardInMunicipality(id, ward) {
  const m = getMunicipality(id);
  return Boolean(m) && Number.isInteger(ward) && ward >= 1 && ward <= m.wards;
}
export function wardCentroid(id, ward) { return getMunicipality(id)?.wardCentroids?.[String(ward)]; }
