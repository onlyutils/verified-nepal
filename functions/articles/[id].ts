// Cloudflare Pages Function for /articles/:id. Runs in front of the static
// index.html and rewrites its <title>, description and Open Graph tags with the
// article's own, so shared links preview the article. Anything that fails
// falls back to the untouched page. Wrangler picks this folder up automatically
// on `pages deploy` (see infra/deploy.sh).
import { dispatchMeta } from "../../src/lib/og-meta";

type Ctx = { request: Request; params: { id: string }; next: () => Promise<Response> };

function apiBase(hostname: string): string {
  return hostname === "verifiednepal.com" || hostname === "www.verifiednepal.com"
    ? "https://api.prod.verifiednepal.com"
    : "https://api.dev.verifiednepal.com";
}

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
  const set = (attr: string, value: string) => ({ element: (e: Element) => e.setAttribute(attr, value) });
  const rewriter = new HTMLRewriter()
    .on("title", { element: (e: Element) => e.setInnerContent(meta.title) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', set("content", meta.title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set("content", meta.description))
    .on('meta[property="og:url"]', set("content", canonical))
    .on('meta[property="og:type"]', set("content", "article"))
    .on('link[rel="canonical"]', set("href", canonical));
  if (meta.image) {
    rewriter
      .on('meta[property="og:image"]', set("content", meta.image))
      .on('meta[property="og:image:alt"]', set("content", meta.imageAlt || meta.title))
      .on('meta[name="twitter:image"]', set("content", meta.image))
      .on('meta[name="twitter:card"]', set("content", "summary_large_image"))
      .on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (e: Element) => e.remove() });
  }
  return rewriter.transform(page);
};
