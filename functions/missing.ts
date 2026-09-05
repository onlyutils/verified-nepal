// Cloudflare Pages Function for /missing: static share card, no per-request data.
import { STATIC_PAGE_META } from "../src/lib/og-meta";
import { applyMeta, withOrigin } from "./_shared/meta";

type Ctx = { request: Request; next: () => Promise<Response> };

export const onRequestGet = async ({ request, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  return applyMeta(page, withOrigin(STATIC_PAGE_META.missing, url.origin), `${url.origin}/missing`);
};
