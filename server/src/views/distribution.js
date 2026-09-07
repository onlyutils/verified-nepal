import { getMunicipality } from "../lib/adminUnits.js";
import { csvEscape } from "../lib/http.js";

function baseView(item) {
  const out = {
    id: item.id,
    orgId: item.orgId,
    orgName: item.orgName,
    orgTier: item.orgTier,
    incidentId: item.incidentId,
    district: item.district,
    municipalityId: item.municipalityId,
    municipality: getMunicipality(item.municipalityId)?.name,
    wards: item.wards,
    plannedDate: item.plannedDate,
    items: item.items,
    transport: item.transport,
    staffCount: item.staffCount,
    notes: item.notes,
    status: item.status,
    ackAt: item.ackAt,
    completedAt: item.completedAt,
    householdsReached: item.householdsReached,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  if (item.ackBy) out.ackBy = { ...item.ackBy };
  if (item.ackNote !== undefined) out.ackNote = item.ackNote;
  if (item.completedNote !== undefined) out.completedNote = item.completedNote;
  return out;
}

export function toPrivateDistributionView(item) {
  const out = baseView(item);
  out.contactPhone = item.contactPhone;
  out.createdBy = item.createdBy;
  return out;
}

export function toPublicDistributionView(item) {
  const out = baseView(item);
  if (item.ackBy) out.ackBy = { role: item.ackBy.role };
  return out;
}

export const DDMC_COLUMNS = [
  ["date", "#date"],
  ["district", "#adm2+name"],
  ["municipality", "#adm3+name"],
  ["ward", "#adm4+name"],
  ["organization", "#org+name"],
  ["tier", "#org+type"],
  ["items", "#item+list"],
  ["transport", "#meta+transport"],
  ["staff", "#meta+staff"],
  ["status", "#status"],
  ["acknowledged_by", "#meta+ack_by"],
  ["acknowledged_at", "#date+ack"],
  ["households_reached", "#reached+households"],
];

function itemSummary(items) {
  return (items || []).map((item) => `${item.category} ${item.qty} ${item.unit}`).join("; ");
}

function acknowledgedRole(item) {
  return ["moderator", "admin"].includes(item.ackBy?.role) ? item.ackBy.role : "";
}

export function toDdmcRows(distributions) {
  const rows = [];
  for (const item of distributions) {
    for (const ward of item.wards || []) {
      rows.push([
        item.plannedDate || "",
        item.district || "",
        getMunicipality(item.municipalityId)?.name || "",
        ward,
        item.orgName || "",
        item.orgTier || "",
        itemSummary(item.items),
        item.transport || "",
        item.staffCount ?? "",
        item.status || "",
        acknowledgedRole(item),
        item.ackAt || "",
        item.householdsReached ?? "",
      ].map(String));
    }
  }
  return { header: DDMC_COLUMNS.map(([name]) => name), hxl: DDMC_COLUMNS.map(([, tag]) => tag), rows };
}

export function toDdmcCsv(distributions) {
  const { header, hxl, rows } = toDdmcRows(distributions);
  return [header, hxl, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function toDdmcJson(distributions) {
  const { header, rows } = toDdmcRows(distributions);
  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index]])));
}
