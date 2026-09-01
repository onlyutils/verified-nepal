export function toPublicDispatchListItem(it) {
  const bodyText = (it.body && (it.body.en || it.body.ne)) || "";
  const excerpt = bodyText.slice(0, 200);
  const author = { displayName: it.author?.displayName || "" };
  if (it.author?.place) author.place = it.author.place;
  const out = {
    id: it.id,
    title: it.title,
    excerpt,
    author,
    tags: it.tags || [],
    publishedAt: it.publishedAt,
  };
  if (!out.publishedAt) delete out.publishedAt;
  return out;
}

export function toPublicDispatchDetail(item) {
  const publicItem = {
    id: item.id,
    title: item.title,
    body: item.body,
    author: { displayName: item.author?.displayName || "" },
    tags: item.tags || [],
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    status: item.status,
  };
  if (item.author?.place) publicItem.author.place = item.author.place;
  if (!publicItem.publishedAt) delete publicItem.publishedAt;
  return publicItem;
}
