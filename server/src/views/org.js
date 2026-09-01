export function toPrivateOrgView(org) {
  const out = {
    id: org.id,
    name: org.name,
    orgType: org.orgType,
    contactName: org.contactName,
    contactPhone: org.contactPhone,
    districts: org.districts,
    description: org.description,
    status: org.status,
    ownerSub: org.ownerSub,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
  if (org.registrationNumber !== undefined) out.registrationNumber = org.registrationNumber;
  if (org.contactEmail !== undefined) out.contactEmail = org.contactEmail;
  if (org.website !== undefined) out.website = org.website;
  if (org.tier !== undefined) out.tier = org.tier;
  if (org.ownerEmail !== undefined) out.ownerEmail = org.ownerEmail;
  if (org.verifiedAt !== undefined) out.verifiedAt = org.verifiedAt;
  if (org.verifiedBy !== undefined) out.verifiedBy = org.verifiedBy;
  if (org.verificationNote !== undefined) out.verificationNote = org.verificationNote;
  if (org.rejectionReason !== undefined) out.rejectionReason = org.rejectionReason;
  if (org.suspendedAt !== undefined) out.suspendedAt = org.suspendedAt;
  if (org.suspensionReason !== undefined) out.suspensionReason = org.suspensionReason;
  if (org.vouches !== undefined) out.vouches = org.vouches;
  return out;
}

export function toModerationOrgView(org, centersCount) {
  const base = toPrivateOrgView(org);
  base.centersCount = centersCount;
  return base;
}

export function toMyOrgView(org, role) {
  const base = toPrivateOrgView(org);
  base.role = role;
  return base;
}

export function toMemberView(item, status) {
  const out = {
    role: item.role,
    status,
    createdAt: item.createdAt,
  };
  if (item.sub !== undefined) out.sub = item.sub;
  if (item.email !== undefined) out.email = item.email;
  if (item.name !== undefined) out.name = item.name;
  return out;
}
