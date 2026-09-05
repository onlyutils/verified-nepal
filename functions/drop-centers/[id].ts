// Cloudflare Pages Function for /drop-centers/:id. Rewrites title/description with
// the center's own name/district/status; centers have no cover photo, so the image
// stays the generic drop-centers card.
import { centerMeta, STATIC_PAGE_META } from "../../src/lib/og-meta";
import { apiBase, applyMeta, withOrigin } from "../_shared/meta";

type Ctx = { request: Request; params: { id: string }; next: () => Promise<Response> };

export const onRequestGet = async ({ request, params, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  let item;
  try {
    const res = await fetch(`${apiBase(url.hostname)}/centers/${encodeURIComponent(params.id)}`, {
      cf: { cacheTtl: 300 },
    } as RequestInit);
    if (!res.ok) return page;
    item = await res.json();
  } catch {
    return page;
  }
  const meta = centerMeta(item);
  meta.image = withOrigin(STATIC_PAGE_META.dropCenters, url.origin).image;
  const canonical = `${url.origin}/drop-centers/${encodeURIComponent(params.id)}`;
  return applyMeta(page, meta, canonical, "website");
};
