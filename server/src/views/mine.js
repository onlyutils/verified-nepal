import { needTimeline } from "./need-timeline.js";
import { getMunicipality } from "../lib/adminUnits.js";

export function toMyGroup(need, sub, donation) {
  const membership = need.groupMembers?.[sub];
  const myItems = Object.entries(need.groupItems || {})
    .filter(([, item]) => item.claimedBy === sub)
    .map(([itemId, item]) => ({ itemId, description: item.description, status: item.status, claimedAt: item.claimedAt, doneAt: item.doneAt }));
  return {
    id: need.id,
    updatedAt: need.updatedAt || need.createdAt,
    groupName: need.group?.name,
    district: need.beneficiary?.district || need.district,
    category: need.category,
    joinedAt: membership?.joinedAt,
    myItems,
    timeline: needTimeline(need, { donation }),
    ...(need.deliveryChannel ? { deliveryChannel: need.deliveryChannel, centerId: need.centerId } : {}),
    ...(need.status === "matched" && need.handledBy?.kind === "group" ? {
      handling: {
        status: need.status,
        handler: need.handledBy.label,
        contact: toHandlingContact(need, donation),
      },
    } : {}),
  };
}

export function toHandlingContact(need, donation) {
  return {
    id: need.id, status: need.status, category: need.category, description: need.description, createdAt: need.createdAt, updatedAt: need.updatedAt || need.createdAt,
    beneficiary: { name: need.beneficiary?.name || "", phone: need.beneficiary?.phone || null, district: need.beneficiary?.district || need.district, ward: need.beneficiary?.ward ?? need.ward, municipalityId: need.beneficiary?.municipalityId, municipality: getMunicipality(need.beneficiary?.municipalityId)?.name },
    handledAt: need.handledBy?.at,
    timeline: needTimeline(need, { donation }),
    ...(need.deliveryChannel ? { deliveryChannel: need.deliveryChannel, centerId: need.centerId } : {}),
  };
}

export function toMyNeed(n, donation) {
  return {
    id: n.id, refCode: n.refCode, status: n.status, category: n.category, district: n.beneficiary?.district, ward: n.beneficiary?.ward, municipalityId: n.beneficiary?.municipalityId, municipality: getMunicipality(n.beneficiary?.municipalityId)?.name,
    createdAt: n.createdAt, updatedAt: n.updatedAt || n.createdAt, expiresAt: n.expiresAt, timeline: needTimeline(n, { donation }),
    ...(n.deliveryChannel ? { deliveryChannel: n.deliveryChannel, centerId: n.centerId } : {}),
  };
}

export function toMyRegisteredNeed(n, donation) {
  return {
    ...toMyNeed(n, donation),
    claimCode: n.claimCode && ["published", "matched", "fulfilled"].includes(n.status) ? n.claimCode : undefined,
    handledBy: n.handledBy?.label || n.handledBy?.orgName,
    handledByKind: n.handledBy?.kind || (n.handledBy?.orgName ? "org" : undefined),
    deliveredBy: n.deliveredBy?.label,
    confirmedAt: n.confirmedAt,
    timeline: needTimeline(n, { donation }),
    ...(n.deliveryChannel ? { deliveryChannel: n.deliveryChannel, centerId: n.centerId } : {}),
  };
}

export function toMyDonation(donation) {
  return {
    ref: donation.ref,
    updatedAt: donation.updatedAt || donation.receivedAt || donation.declaredAt,
    center: { id: donation.centerId, name: donation.centerName, district: donation.district },
    category: donation.category,
    unit: donation.unit,
    qty: donation.qty,
    status: donation.status,
    declaredAt: donation.declaredAt,
    ...(donation.receivedAt ? { receivedAt: donation.receivedAt } : {}),
  };
}

export function toMyProject(p) {
  return { id: p.id, title: p.title, status: p.status, district: p.district, ward: p.ward, createdAt: p.createdAt };
}

export function toMyOffer(o) {
  return { id: o.id, status: o.status, categories: o.categories, districts: o.districts, createdAt: o.createdAt, expiresAt: o.expiresAt };
}

export function toMyMissing(m) {
  const { PK, SK, type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, createdBy, publicationStatus, ...rest } = m;
  return { ...rest, publicationStatus: publicationStatus || "published" };
}

export function toPublicMissing(m) {
  const { PK, SK, type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, createdBy, phones, email, phone, rejectReason, publicationStatus, ...rest } = m;
  return { ...rest, publicationStatus: "published" };
}

export function toMyIncident(i) {
  return {
    id: i.id,
    name: i.name,
    kind: i.kind,
    status: i.status,
    districts: i.affectedDistricts,
    createdAt: i.createdAt,
    rejectionReason: i.status === "rejected" ? i.rejectionReason : undefined,
  };
}
