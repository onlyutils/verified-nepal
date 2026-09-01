export function toPublicCommittee(committee) {
  if (!committee) return undefined;
  const out = { name: committee.name, verified: !!committee.verified };
  if (committee.verified) {
    if (committee.bank) out.bank = committee.bank;
    if (committee.esewaId) out.esewaId = committee.esewaId;
    if (committee.khaltiId) out.khaltiId = committee.khaltiId;
  }
  return out;
}

export function toPublicProject(item) {
  if (!item) return null;
  const publishedPhotos = Array.isArray(item.photos) ? item.photos.filter((p) => p.status === "published") : [];
  const coverPhoto = publishedPhotos.length ? publishedPhotos[0].url : undefined;
  const out = {
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    district: item.district,
    ward: item.ward,
    locationText: item.locationText,
    costEstimateNpr: item.costEstimateNpr,
    committee: toPublicCommittee(item.committee),
    photos: publishedPhotos,
    status: item.status,
    createdAt: item.createdAt,
  };
  if (coverPhoto) out.coverPhoto = coverPhoto;
  return out;
}

export function toPublishedUpdatesView(allUpdates) {
  return allUpdates
    .filter((u) => u.status === "published")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map((u) => ({ id: u.id, text: u.text, photos: u.photos || [], spentNpr: u.spentNpr, status: u.status, createdAt: u.createdAt }));
}
