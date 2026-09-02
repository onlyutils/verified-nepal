import { maskName } from "../lib/format.js";

export function toPublicOfferListItem(it) {
  const o = {
    id: it.id,
    helperLabel: it.helperLabel || maskName(it.helperName || ""),
    categories: it.categories,
    districts: it.districts,
    description: it.description,
    status: it.status,
    createdAt: it.createdAt,
  };
  if (it.org) o.org = { name: it.org.name };
  return o;
}
