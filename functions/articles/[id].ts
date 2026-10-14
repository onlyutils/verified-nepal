// Cloudflare Pages Function for /articles/:id. Runs in front of the static
// index.html and rewrites its <title>, description and Open Graph tags with the
// article's own, so shared links preview the article. Anything that fails
// falls back to the untouched page. Wrangler picks this folder up automatically
// on `pages deploy` (see infra/deploy.sh).
import { dispatchJsonLd, dispatchMeta } from "../../src/lib/og-meta";
import { apiBase, appendJsonLd, applyMeta, canonicalOrigin } from "../_shared/meta";

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
    if (res.status === 404) return new Response(page.body, { status: 404, headers: page.headers }); // Stops soft 404s in Google.
    if (!res.ok) return page;
    item = await res.json();
  } catch {
    return page;
  }
  const meta = dispatchMeta(item);
  const canonical = `${canonicalOrigin(url.hostname)}/articles/${encodeURIComponent(params.id)}`;
  const result = applyMeta(page, meta, canonical, item.kind === "news" ? "website" : "article");
  return appendJsonLd(result, dispatchJsonLd(item, canonical));
};
