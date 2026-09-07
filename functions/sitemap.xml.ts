// Cloudflare Pages Function for /sitemap.xml. Static top-level routes plus
// published items pulled live from the API, so new articles/projects/centers/
// posters show up without a manual edit. Replaces the old hand-written
// public/sitemap.xml.
import { apiBase, canonicalOrigin } from "./_shared/meta";

type Ctx = { request: Request };

const STATIC_ROUTES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/missing", changefreq: "weekly", priority: "0.8" },
  { path: "/info", changefreq: "weekly", priority: "0.6" },
  { path: "/privacy", changefreq: "monthly", priority: "0.3" },
  { path: "/get-help", changefreq: "weekly", priority: "0.8" },
  { path: "/give-help", changefreq: "weekly", priority: "0.8" },
  { path: "/drop-centers", changefreq: "daily", priority: "0.7" },
  { path: "/projects", changefreq: "daily", priority: "0.7" },
  { path: "/articles", changefreq: "daily", priority: "0.7" },
  { path: "/poster", changefreq: "daily", priority: "0.5" },
  { path: "/ledger", changefreq: "daily", priority: "0.5" },
  { path: "/audit", changefreq: "daily", priority: "0.4" },
];

const DYNAMIC_SOURCES: Array<{ endpoint: string; pathPrefix: string; changefreq: string; priority: string }> = [
  { endpoint: "/dispatches", pathPrefix: "/articles", changefreq: "weekly", priority: "0.6" },
  { endpoint: "/projects", pathPrefix: "/projects", changefreq: "weekly", priority: "0.6" },
  { endpoint: "/centers", pathPrefix: "/drop-centers", changefreq: "weekly", priority: "0.5" },
  { endpoint: "/missing", pathPrefix: "/poster", changefreq: "weekly", priority: "0.5" },
];

type Item = { id?: string; updatedAt?: string; createdAt?: string };

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: string): string {
  return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>\n` : ""}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export const onRequestGet = async ({ request }: Ctx): Promise<Response> => {
  const url = new URL(request.url);
  const base = apiBase(url.hostname);
  const origin = canonicalOrigin(url.hostname);

  const entries = STATIC_ROUTES.map((r) => urlEntry(`${origin}${r.path}`, r.changefreq, r.priority));

  const dynamic = await Promise.all(
    DYNAMIC_SOURCES.map(async (source) => {
      try {
        const res = await fetch(`${base}${source.endpoint}`, { cf: { cacheTtl: 300 } } as RequestInit);
        if (!res.ok) return [];
        const body = (await res.json()) as { items?: Item[] };
        return (body.items ?? [])
          .filter((item) => item.id)
          .map((item) =>
            urlEntry(
              `${origin}${source.pathPrefix}/${encodeURIComponent(item.id!)}`,
              source.changefreq,
              source.priority,
              item.updatedAt || item.createdAt,
            ),
          );
      } catch {
        return [];
      }
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...entries, ...dynamic.flat()].join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
};
