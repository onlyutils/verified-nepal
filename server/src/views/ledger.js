import { csvEscape } from "../lib/http.js";

export function toLedgerItem(it) {
  return { maskedName: it.maskedName, category: it.category, district: it.district, ward: it.ward, redeemedAt: it.redeemedAt };
}

export function toLedgerCsv(items) {
  const header = ["maskedName", "category", "district", "ward", "redeemedAt"].map(csvEscape).join(",");
  const rows = items.map((it) => [it.maskedName, it.category, it.district, String(it.ward), it.redeemedAt].map(csvEscape).join(","));
  return [header, ...rows].join("\n");
}
