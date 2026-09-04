import { maskName } from "../lib/format.js";
import { toExpiresAt } from "../lib/format.js";

export function toPublicGroup(need) {
  if (!need.group) return undefined;
  const items = Object.entries(need.groupItems || {})
    .map(([itemId, item]) => ({
      itemId,
      description: item.description,
      status: item.status,
      claimedByName: item.claimedByName,
      createdAt: item.createdAt,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    name: need.group.name,
    items,
    memberCount: Object.keys(need.groupMembers || {}).length,
  };
}

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
    group: toPublicGroup(it),
    ...(it.handledBy?.orgName ? { handledBy: it.handledBy.orgName } : {}),
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
  if (need.handledBy?.orgName) out.handledBy = need.handledBy.orgName;
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
