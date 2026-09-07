import { maskName } from "../lib/format.js";
import { toExpiresAt } from "../lib/format.js";

export function toPublicGroup(need, viewerSub) {
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
    ...(viewerSub ? { isMember: Boolean(need.groupMembers?.[viewerSub]) } : {}),
  };
}

export function toPublicNeedListItem(it, { includeClaimCode = false, viewerSub } = {}) {
  const out = {
    id: it.id,
    maskedName: maskName(it.beneficiary?.name || it.name || ""),
    district: it.beneficiary?.district || it.district || "",
    ward: it.beneficiary?.ward ?? it.ward,
    category: it.category,
    description: it.description,
    status: it.status,
    createdAt: it.createdAt,
    group: toPublicGroup(it, viewerSub),
    ...(it.handledBy ? { handledBy: it.handledBy.label || it.handledBy.orgName, handledByKind: it.handledBy.kind || (it.handledBy.orgName ? "org" : undefined) } : {}),
    ...(it.deliveredBy ? { deliveredBy: it.deliveredBy.label, confirmedAt: it.confirmedAt } : {}),
    ...(it.assignOnly ? { assignOnly: true } : {}),
  };
  if (includeClaimCode && it.claimCode && ["published", "matched", "fulfilled"].includes(it.status)) out.claimCode = it.claimCode;
  if (includeClaimCode && it.matchedOfferId) out.matchedOfferId = it.matchedOfferId;
  return out;
}

export function toStatusView(need) {
  const out = {
    status: need.status,
    category: need.category,
    district: need.beneficiary?.district || need.district,
    createdAt: need.createdAt,
    expiresAt: need.expiresAt || toExpiresAt(need.ttl),
  };
  if (need.handledBy) {
    out.handledBy = need.handledBy.label || need.handledBy.orgName;
    out.handledByKind = need.handledBy.kind || (need.handledBy.orgName ? "org" : undefined);
  }
  if (need.deliveredBy) out.deliveredBy = need.deliveredBy.label;
  if (need.confirmedAt) out.confirmedAt = need.confirmedAt;
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
