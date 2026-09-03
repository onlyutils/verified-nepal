// Plain-text share metadata for a dispatch. Used by functions/dispatches/[id].ts
// (Cloudflare Pages) to rewrite index.html's <title> and Open Graph tags so a
// shared link previews the article instead of the generic site card.
type Localized = string | { en: string; ne?: string };

export interface DispatchLike {
  title: Localized;
  body: Localized;
  author?: { displayName?: string; place?: string };
}

export interface ShareMeta {
  title: string;
  description: string;
}

function text(value: Localized | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.en || value.ne || "";
}

export function dispatchMeta(item: DispatchLike): ShareMeta {
  const title = text(item.title).trim() || "Dispatch";
  const excerpt = text(item.body).replace(/\s+/g, " ").trim().slice(0, 200);
  const by = [item.author?.displayName, item.author?.place].filter(Boolean).join(", ");
  const description = [excerpt, by ? `By ${by}` : ""].filter(Boolean).join(" — ");
  return { title: `${title} · verifiedNepal`, description };
}
