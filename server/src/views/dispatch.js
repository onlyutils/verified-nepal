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
    views: Number(it.views) || 0,
    likes: Number(it.likes) || 0,
    shares: Number(it.shares) || 0,
  };
  if (it.cover && typeof it.cover.url === "string") out.cover = { url: it.cover.url };
  if (it.storyRole) out.storyRole = it.storyRole;
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
    views: Number(item.views) || 0,
    likes: Number(item.likes) || 0,
    shares: Number(item.shares) || 0,
  };
  if (item.cover) publicItem.cover = item.cover;
  if (Array.isArray(item.blocks)) publicItem.blocks = item.blocks;
  if (item.author?.place) publicItem.author.place = item.author.place;
  if (item.storyRole) publicItem.storyRole = item.storyRole;
  if (!publicItem.publishedAt) delete publicItem.publishedAt;
  return publicItem;
}
