import { csvEscape } from "../lib/http.js";
import { getMunicipality } from "../lib/adminUnits.js";

export function toLedgerItem(it) {
  const deliveredBy = it.deliveredBy || (it.orgName ? { kind: "org", label: it.orgName } : { kind: "field", label: "Claim code · moderator" });
  const label = deliveredBy?.via?.centerName ? `${deliveredBy.label} via ${deliveredBy.via.centerName}` : deliveredBy?.label;
  const publicDeliveredBy = deliveredBy ? { kind: deliveredBy.kind, label } : undefined;
  return { maskedName: it.maskedName, category: it.category, district: it.district, ward: it.ward, municipalityId: it.municipalityId, redeemedAt: it.redeemedAt, households: it.households, receipt: Boolean(it.hasReceipt), ...(it.orgName ? { orgName: it.orgName } : {}), ...(publicDeliveredBy ? { deliveredBy: publicDeliveredBy } : {}), ...(it.confirmedAt ? { confirmedAt: it.confirmedAt } : {}) };
}

export function toLedgerCsv(items) {
  const header = ["maskedName", "category", "district", "ward", "redeemedAt", "orgName", "deliveredBy", "deliveredByKind", "municipality", "households", "receipt"].map(csvEscape).join(",");
  const rows = items.map((it) => [it.maskedName, it.category, it.district, String(it.ward), it.redeemedAt, it.orgName || "", it.deliveredBy?.label || it.orgName || "Claim code · moderator", it.deliveredBy?.kind || (it.orgName ? "org" : "field"), getMunicipality(it.municipalityId)?.name || "", it.households ?? "", it.receipt ? "yes" : ""].map(csvEscape).join(","));
  return [header, ...rows].join("\n");
}
