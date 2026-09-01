import { maskName } from "../lib/format.js";
import { toExpiresAt } from "../lib/format.js";

export function toPublicNeedListItem(it) {
  return {
    id: it.id,
    maskedName: maskName(it.beneficiary?.name || it.name || ""),
    district: it.beneficiary?.district || it.district || "",
    ward: it.beneficiary?.ward ?? it.ward,
    category: it.category,
    description: it.description,
    status: it.status,
    createdAt: it.createdAt,
  };
}

export function toStatusView(need) {
  const out = {
    status: need.status,
    category: need.category,
    district: need.beneficiary?.district || need.district,
    createdAt: need.createdAt,
    expiresAt: need.expiresAt || toExpiresAt(need.ttl),
  };
  if (need.claimCode && ["published", "matched", "fulfilled"].includes(need.status)) {
    out.claimCode = need.claimCode;
  }
  return out;
}

export function toFlagListItem(pointer, flags) {
  const needId = pointer.needId || pointer.SK;
  return {
    needId,
    maskedName: pointer.maskedName,
    ward: pointer.ward,
    district: pointer.district,
    flagCount: pointer.flagCount,
    flags,
  };
}

export function toClaimPrintItem(it) {
  return {
    claimCode: it.claimCode,
    maskedName: maskName(it.beneficiary?.name || ""),
    category: it.category,
    ward: it.beneficiary?.ward ?? it.ward,
    status: it.status,
  };
}
