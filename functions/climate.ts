// Cloudflare Pages Function for /climate. Rewrites the static page metadata so
// shared climate links preview the computed climate case instead of the site card.
import { climateMeta } from "../src/lib/og-meta";
import { applyMeta } from "./_shared/meta";

type Ctx = { request: Request; next: () => Promise<Response> };

export const onRequestGet = async ({ request, next }: Ctx): Promise<Response> => {
  const page = await next();
  if (!page.headers.get("content-type")?.includes("text/html")) return page;
  const url = new URL(request.url);
  const meta = climateMeta();
  const canonical = `${url.origin}/climate`;
  return applyMeta(page, meta, canonical, "website");
};
