import { dispatchKind } from "../models/dispatch.js";

export function localDispatchFields(it) {
  const out = { kind: dispatchKind(it) };
  if (it.language) out.language = it.language;
  if (it.scope) out.scope = it.scope;
  if (it.locality)
    out.locality = {
      district: it.locality.district,
      municipalityId: it.locality.municipalityId,
      ...(it.locality.ward ? { ward: it.locality.ward } : {}),
    };
  for (const key of ["happenedAt", "expiresAt", "sourceNote"]) if (it[key]) out[key] = it[key];
  if (Array.isArray(it.sourceUrls)) out.sourceUrls = it.sourceUrls;
  return out;
}

export function toPublicDispatchListItem(it) {
  const bodyText = (it.body && (it.body.en || it.body.ne)) || "";
  const excerpt = bodyText.slice(0, 200);
  const author = { displayName: it.author?.displayName || "" };
  if (it.author?.place) author.place = it.author.place;
  const out = {
    ...localDispatchFields(it),
    id: it.id,
    title: it.title,
    excerpt,
    author,
    tags: it.tags || [],
    publishedAt: it.publishedAt,
    views: Number(it.views) || 0,
    likes: Number(it.likes) || 0,
    shares: Number(it.shares) || 0,
  };
  if (it.cover && typeof it.cover.url === "string") out.cover = { url: it.cover.url };
  if (!out.publishedAt) delete out.publishedAt;
  return out;
}

export function toPublicDispatchDetail(item) {
  const publicItem = {
    ...localDispatchFields(item),
    id: item.id,
    title: item.title,
    body: item.body,
    author: { displayName: item.author?.displayName || "" },
    tags: item.tags || [],
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    status: item.status,
    views: Number(item.views) || 0,
    likes: Number(item.likes) || 0,
    shares: Number(item.shares) || 0,
  };
  if (item.cover) publicItem.cover = item.cover;
  if (Array.isArray(item.blocks)) publicItem.blocks = item.blocks;
  if (item.author?.place) publicItem.author.place = item.author.place;
  if (!publicItem.publishedAt) delete publicItem.publishedAt;
  return publicItem;
}
