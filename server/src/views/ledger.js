import { csvEscape } from "../lib/http.js";

export function toLedgerItem(it) {
  return { maskedName: it.maskedName, category: it.category, district: it.district, ward: it.ward, redeemedAt: it.redeemedAt, ...(it.orgName ? { orgName: it.orgName } : {}) };
}

export function toLedgerCsv(items) {
  const header = ["maskedName", "category", "district", "ward", "redeemedAt", "orgName"].map(csvEscape).join(",");
  const rows = items.map((it) => [it.maskedName, it.category, it.district, String(it.ward), it.redeemedAt, it.orgName || ""].map(csvEscape).join(","));
  return [header, ...rows].join("\n");
}
