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
