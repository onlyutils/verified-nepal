// Cloudflare Pages Function for /climate. Rewrites the static page metadata so
// shared climate links preview the computed climate case instead of the site card.
import { climateMeta } from "../src/lib/og-meta";

type Ctx = { request: Request; next: () => Promise<Response> };

export const onRequestGet = async ({ request, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  const meta = climateMeta();
  const canonical = `${url.origin}/climate`;
  const set = (attr: string, value: string) => ({ element: (e: Element) => e.setAttribute(attr, value) });
  return new HTMLRewriter()
    .on("title", { element: (e: Element) => e.setInnerContent(meta.title) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', set("content", meta.title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set("content", meta.description))
    .on('meta[property="og:url"]', set("content", canonical))
    .on('meta[property="og:type"]', set("content", "website"))
    .on('link[rel="canonical"]', set("href", canonical))
    .transform(page);
};
