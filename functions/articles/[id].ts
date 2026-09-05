// Cloudflare Pages Function for /articles/:id. Runs in front of the static
// index.html and rewrites its <title>, description and Open Graph tags with the
// article's own, so shared links preview the article. Anything that fails
// falls back to the untouched page. Wrangler picks this folder up automatically
// on `pages deploy` (see infra/deploy.sh).
import { dispatchMeta } from "../../src/lib/og-meta";
import { apiBase, applyMeta } from "../_shared/meta";

type Ctx = { request: Request; params: { id: string }; next: () => Promise<Response> };

export const onRequestGet = async ({ request, params, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  let item;
  try {
    const res = await fetch(`${apiBase(url.hostname)}/dispatches/${encodeURIComponent(params.id)}`, {
      cf: { cacheTtl: 300 },
    } as RequestInit);
    if (!res.ok) return page;
    item = await res.json();
  } catch {
    return page;
  }
  const meta = dispatchMeta(item);
  const canonical = `${url.origin}/articles/${encodeURIComponent(params.id)}`;
  return applyMeta(page, meta, canonical, "article");
};
