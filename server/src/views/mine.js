export function toMyGroup(need, sub) {
  const membership = need.groupMembers?.[sub];
  const myItems = Object.entries(need.groupItems || {})
    .filter(([, item]) => item.claimedBy === sub)
    .map(([itemId, item]) => ({ itemId, description: item.description, status: item.status, claimedAt: item.claimedAt, doneAt: item.doneAt }));
  return {
    id: need.id,
    groupName: need.group?.name,
    district: need.beneficiary?.district || need.district,
    category: need.category,
    joinedAt: membership?.joinedAt,
    myItems,
  };
}

export function toMyNeed(n) {
  return { id: n.id, refCode: n.refCode, status: n.status, category: n.category, district: n.beneficiary?.district, ward: n.beneficiary?.ward, createdAt: n.createdAt, expiresAt: n.expiresAt };
}

export function toMyOffer(o) {
  return { id: o.id, status: o.status, categories: o.categories, districts: o.districts, createdAt: o.createdAt, expiresAt: o.expiresAt };
}

export function toMyMissing(m) {
  const { PK, SK, type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, createdBy, ...rest } = m;
  return rest;
}
