import { getMunicipality, wardCentroid, DISTRICT_CENTROIDS, PROVINCE_OF } from "../lib/adminUnits.js";
import { csvEscape } from "../lib/http.js";

const STATUS_LABEL = { published: "open", matched: "in progress", fulfilled: "delivered" };

function loc(need) {
  const b = need.beneficiary || {};
  const district = b.district || need.district || "";
  const municipalityId = Number.isInteger(b.municipalityId) ? b.municipalityId : null;
  const ward = Number.isInteger(b.ward ?? need.ward) ? (b.ward ?? need.ward) : null;
  return { district, municipalityId, municipality: municipalityId ? getMunicipality(municipalityId)?.name ?? null : null, ward };
}

export function aggregateCoverage(needs) {
  const map = new Map();
  for (const need of needs) {
    const l = loc(need);
    const key = `${l.district}|${l.municipalityId}|${l.ward}`;
    const row = map.get(key) || { ...l, open: 0, matched: 0, fulfilled: 0, lastDeliveredAt: null };
    if (need.status === "published") row.open++;
    else if (need.status === "matched") row.matched++;
    else if (need.status === "fulfilled") {
      row.fulfilled++;
      if (need.redeemedAt && (!row.lastDeliveredAt || need.redeemedAt > row.lastDeliveredAt)) row.lastDeliveredAt = need.redeemedAt;
    }
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => {
    if (!a.lastDeliveredAt !== !b.lastDeliveredAt) return a.lastDeliveredAt ? 1 : -1;
    if (a.lastDeliveredAt !== b.lastDeliveredAt) return (a.lastDeliveredAt || "").localeCompare(b.lastDeliveredAt || "");
    return a.district.localeCompare(b.district) || (a.municipality || "").localeCompare(b.municipality || "") || (a.ward || 0) - (b.ward || 0);
  });
}

function orgLabel(need) {
  const d = need.deliveredBy || need.handledBy;
  if (!d) return "";
  if (d.kind === "org" || d.orgName) return d.orgName || d.label;
  if (d.kind === "group") return "Helper group";
  if (d.kind === "helper") return "Helper";
  return "Moderator";
}

export const HXL_COLUMNS = [
  ["org", "#org+name"], ["sector", "#sector+name"], ["activity", "#activity+name"],
  ["province", "#adm1+name"], ["district", "#adm2+name"], ["municipality", "#adm3+name"], ["municipality_code", "#adm3+code"], ["ward", "#adm4+name"],
  ["status", "#status"], ["registered", "#date+start"], ["delivered", "#date+end"], ["households", "#reached+households"], ["need_id", "#meta+id"],
];

export function to3wRows(needs) {
  const header = HXL_COLUMNS.map(([c]) => c), hxl = HXL_COLUMNS.map(([, h]) => h);
  const rows = needs.map((need) => {
    const l = loc(need);
    return [orgLabel(need), need.category || "", "relief delivery", PROVINCE_OF[l.district] || "", l.district, l.municipality || "", l.municipalityId ?? "", l.ward ?? "",
      STATUS_LABEL[need.status] || need.status, need.createdAt || "", need.redeemedAt || "", need.deliveryReceipt?.households ?? "", need.id].map(String);
  });
  return { header, hxl, rows };
}

export function to3wCsv(needs) {
  const { header, hxl, rows } = to3wRows(needs);
  return [header, hxl, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

function point(l) {
  const w = l.municipalityId && l.ward ? wardCentroid(l.municipalityId, l.ward) : undefined;
  const m = l.municipalityId ? getMunicipality(l.municipalityId) : undefined;
  const [lat, lng] = w || (m ? [m.lat, m.lng] : DISTRICT_CENTROIDS[l.district] || [null, null]);
  return lat == null ? null : { type: "Point", coordinates: [lng, lat] };
}

export function to3wGeoJson(needs) {
  const { header, rows } = to3wRows(needs);
  return { type: "FeatureCollection", features: needs.map((need, i) => ({ type: "Feature", geometry: point(loc(need)), properties: Object.fromEntries(header.map((h, j) => [h, h === "municipality" ? rows[i][j] || null : rows[i][j]])) })) };
}
