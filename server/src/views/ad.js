import { isActive } from "../models/ad.js";

export function toPublicAd(ad) {
  if (!ad) return null;
  return { id: ad.id, slot: ad.slot, image: { url: ad.image.url }, href: ad.href, label: { en: ad.label.en, ne: ad.label.ne } };
}

export function toAdminAd(ad, nowIso) {
  return {
    ...toPublicAd(ad),
    target: ad.target,
    image: { url: ad.image.url, fileId: ad.image.fileId },
    startAt: ad.startAt,
    endAt: ad.endAt,
    note: ad.note,
    createdBy: ad.createdBy,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    active: isActive(ad, nowIso),
  };
}
