// Shared by every Pages Function that rewrites index.html's share metadata.
// Underscore-prefixed folder: Cloudflare Pages excludes it from routing, so this
// is import-only, never a route of its own.
import type { ShareMeta } from "../../src/lib/og-meta";

export function apiBase(hostname: string): string {
  return hostname === "verifiednepal.com" || hostname === "www.verifiednepal.com"
    ? "https://api.prod.verifiednepal.com"
    : "https://api.dev.verifiednepal.com";
}

/** Resolves a site-relative image path (e.g. "/brand/og-poster.png") to an absolute URL. */
export function withOrigin(meta: ShareMeta, origin: string): ShareMeta {
  return meta.image && meta.image.startsWith("/") ? { ...meta, image: `${origin}${meta.image}` } : meta;
}

export function applyMeta(page: Response, meta: ShareMeta, canonical: string, type: "website" | "article" = "website"): Response {
  const set = (attr: string, value: string) => ({ element: (e: Element) => e.setAttribute(attr, value) });
  const rewriter = new HTMLRewriter()
    .on("title", { element: (e: Element) => e.setInnerContent(meta.title) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', set("content", meta.title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set("content", meta.description))
    .on('meta[property="og:url"]', set("content", canonical))
    .on('meta[property="og:type"]', set("content", type))
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
}
