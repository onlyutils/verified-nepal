// Runs before every request on every Pages deployment (prod, dev, previews).
// Non-production hosts must never be indexed: without this, dev.verifiednepal.com
// serves byte-identical pages with no crawl block, so search engines can pick it
// up as a second, competing copy of the whole site. One header, every response.
// ponytail: header only, no per-route noindex meta needed — X-Robots-Tag covers
// crawlers that don't render JS too.
import { isProdHost } from "./_shared/meta";

type Ctx = { request: Request; next: () => Promise<Response> };

export const onRequest = async ({ request, next }: Ctx): Promise<Response> => {
  const res = await next();
  if (isProdHost(new URL(request.url).hostname)) return res;
  const headers = new Headers(res.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
