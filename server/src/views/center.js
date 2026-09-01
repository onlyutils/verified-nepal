export function toPublicCenterView(center) {
  const org = {
    id: center.orgId,
    name: center.orgName,
    status: center.orgStatus,
  };
  if (center.orgTier) org.tier = center.orgTier;
  const out = {
    id: center.id,
    name: center.name,
    district: center.district,
    address: center.address,
    contactPhone: center.contactPhone,
    accepts: center.accepts,
    status: center.status,
    org,
    createdAt: center.createdAt,
    updatedAt: center.updatedAt,
  };
  if (center.ward !== undefined) out.ward = center.ward;
  if (center.lat !== undefined) out.lat = center.lat;
  if (center.lng !== undefined) out.lng = center.lng;
  if (center.hours !== undefined) out.hours = center.hours;
  if (center.flagCount !== undefined) out.flagCount = center.flagCount;
  return out;
}

export function toPrivateCenterView(center) {
  const pub = toPublicCenterView(center);
  pub.orgId = center.orgId;
  if (center.notes !== undefined) pub.notes = center.notes;
  if (center.createdBy !== undefined) pub.createdBy = center.createdBy;
  if (center.createdByName !== undefined) pub.createdByName = center.createdByName;
  return pub;
}
