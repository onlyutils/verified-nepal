// Cloudflare Pages Function for /projects/:id. Rewrites the static page's share
// metadata with the project's own title, description and cover photo (if any).
import { projectMeta, STATIC_PAGE_META } from "../../src/lib/og-meta";
import { apiBase, applyMeta, withOrigin } from "../_shared/meta";

type Ctx = { request: Request; params: { id: string }; next: () => Promise<Response> };

export const onRequestGet = async ({ request, params, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  let item;
  try {
    const res = await fetch(`${apiBase(url.hostname)}/projects/${encodeURIComponent(params.id)}`, {
      cf: { cacheTtl: 300 },
    } as RequestInit);
    if (!res.ok) return page;
    item = await res.json();
  } catch {
    return page;
  }
  const meta = projectMeta(item);
  if (!meta.image) meta.image = withOrigin(STATIC_PAGE_META.projects, url.origin).image;
  const canonical = `${url.origin}/projects/${encodeURIComponent(params.id)}`;
  return applyMeta(page, meta, canonical, "article");
};
