# SEO action plan — verifiednepal.com

Written 2026-10-13 from a live crawl of the site plus three Search Console
exports (Performance, Pages/Coverage, HTTPS; property `sc-domain:verifiednepal.com`,
Aug 28 – Oct 11 2026).

## Where we are

| Signal | Value |
|---|---|
| Pages Google has indexed | **1** (the homepage), flat since 2026-08-29 |
| Pages Google knows about but rejected | 6 (2 redirects, 1 × 404, 1 × 403, 1 "alternate page with proper canonical", 1 "crawled – currently not indexed") |
| URLs Google knows about in total | 7 — against 12 in our sitemap and ~20 public routes |
| Sitemap | **Never submitted.** Search Console → Sitemaps is empty |
| Search traffic (3 months) | 15 impressions, 3 clicks, avg position ~1.9, **homepage only**, queries hidden (below privacy threshold — brand searches) |
| HTTPS | Clean: 1 HTTPS URL, 0 non-HTTPS, no issues |
| `www.verifiednepal.com` | Serves a full 200 copy of the site, self-canonical to `www` → second indexable copy. Google has not noticed yet ("Duplicate without user-selected canonical" = 0) |
| Dev host | Correctly `X-Robots-Tag: noindex, nofollow` |

In short: Google only knows the homepage exists. Nothing else has ever been
shown in a search result.

## Root causes, ranked

1. **Sitemap never submitted** → Google has to discover inner pages by following
   JS-rendered links from the homepage. It found 7 and indexed 1.
2. **12 public routes declare the homepage as their canonical.** Only the 11
   routes in `_routes.json` get a Cloudflare Function that rewrites `<title>`,
   description and `<link rel=canonical>`. Everything else ships `index.html`
   unchanged: `/info`, `/privacy`, `/articles`, `/ledger`, `/audit`,
   `/flood-impact`, `/how-to`, `/our-message`, `/coverage`, `/drones`,
   `/incidents`, `/search`. Google reads "this page is a copy of `/`" and
   drops it — that is the "Alternate page with proper canonical tag" row.
3. **Every unknown URL returns HTTP 200** with the homepage shell (SPA fallback).
   The client renders a Not Found component, but sends no 404 status and no
   `noindex`. Google treats these as soft 404s and lowers crawl trust.
4. **`www` is not redirected.** `public/_redirects` has a host-based rule,
   but Cloudflare Pages ignores host-based sources, so it never fires.
   `canonicalOrigin()` also echoes the request host for any prod host.
5. **Thin crawlable content.** Client-rendered SPA: raw HTML has an empty
   `#root` and a `<noscript>` link list. Google renders JS, but indexing is
   slower and lower priority for new, low-authority sites. `/flood-impact`
   (the outreach page) is a map/video player with almost no text.
6. **No inbound links.** New domain, zero authority. Nothing we do on-site
   will rank for topic queries until other sites link to us.

## Action plan

### Phase 0 — today, in Search Console (owner, ~15 min)

| # | Action | Verify |
|---|---|---|
| 0.1 | Sitemaps → submit `https://verifiednepal.com/sitemap.xml` | Status "Success", discovered pages ≥ 12 within 48 h |
| 0.2 | Pages → click each "not indexed" reason and copy the example URLs for **404**, **403**, **Alternate page with proper canonical tag**, **Crawled – currently not indexed**. Send them over. | We confirm the 404/403 are API-subdomain URLs, not site pages |
| 0.3 | Settings → confirm property type is Domain (`sc-domain:`) and that `dev.verifiednepal.com` / `www` are *not* separate properties | — |
| 0.4 | Check **Manual actions** and **Security issues** are both "No issues" | — |
| 0.5 | Bing Webmaster Tools: the site already carries `msvalidate.01`. Sign in → "Import from Google Search Console" → submit the same sitemap | Bing indexes 10–20 pages within a week |

### Phase 1 — code fixes, this week (engineering, ~half a day)

Ordered by impact. All are small diffs in `functions/` and `public/`.

| # | Fix | Where | Why |
|---|---|---|---|
| 1.1 | `canonicalOrigin()` always returns `https://verifiednepal.com` | `functions/_shared/meta.ts` | Kills `www` self-canonicals in one line |
| 1.2 | **`www` → apex 301** as a Cloudflare **Redirect Rule** on the zone (Rules → Redirect Rules, or Terraform in `verified-nepal-infra` if the zone is managed there). Delete the dead host rule from `public/_redirects`. | Cloudflare dashboard / infra repo | Pages `_redirects` can't do host-based sources; Redirect Rules are free and don't touch the Functions quota |
| 1.3 | Add Pages Functions with their own title/description/canonical for every public route that lacks one: `/flood-impact`, `/info`, `/how-to`, `/our-message`, `/articles`, `/privacy`, `/ledger`, `/audit`, `/coverage`, `/incidents`, `/drones`. Reuse the `missing.ts` pattern + `STATIC_PAGE_META`. `/flood-impact` first — it is the outreach landing page. | `functions/*.ts`, `src/lib/og-meta.ts` | Removes the "copy of homepage" signal. `_routes.json` is derived from `functions/` by `infra/deploy.sh`, so nothing else to wire. Quota impact: HTML-only routes, low volume |
| 1.4 | **Real 404s on detail routes.** In `functions/articles/[id].ts`, `projects/[id].ts`, `drop-centers/[id].ts`: when the API returns 404, return the page with `status: 404` instead of falling through with 200. The function already runs, so zero extra quota. | `functions/**/[id].ts` | Stops soft 404s on deleted/unknown items |
| 1.5 | **`noindex` on the client Not Found page.** When `page === "notFound"`, set `<meta name="robots" content="noindex">` (same mechanism `/search` uses today). | `src/App.tsx` | Google honours JS-set `noindex`; a Function catch-all would cost quota on every request |
| 1.6 | Sitemap: add `/flood-impact`, `/climate`, `/how-to`, `/our-message`, `/incidents`, `/coverage`; drop `/audit` and `/ledger` if they're not meant to rank. Log (don't swallow) API fetch failures. | `functions/sitemap.xml.ts` | Google only crawls what it is told about |
| 1.7 | `robots.txt`: add `Disallow: /desk`, `/me`, `/org`, `/poster/` (signed-in surfaces & per-user posters) so crawl budget goes to public pages. Keep `/search` blocked; the JS `noindex` on `/search` is then redundant but harmless. | `public/robots.txt` | Crawl budget |
| 1.8 | After deploy: URL Inspection → **Request indexing** for `/`, `/flood-impact`, `/missing`, `/get-help`, `/give-help`, `/drop-centers`, `/how-to`. (10 requests/day limit.) | Search Console | Forces a recrawl now instead of in weeks |

Verification for Phase 1: `curl -sI https://www.verifiednepal.com/` → 301;
`curl -s https://verifiednepal.com/flood-impact | grep canonical` → its own URL;
`curl -sI https://verifiednepal.com/articles/nope` → 404;
Search Console → Pages: "Alternate page…" count falls to 0 within 2–3 weeks,
Indexed count climbs toward the sitemap size.

### Phase 2 — content & structure, next 2–4 weeks

| # | Action | Why |
|---|---|---|
| 2.1 | **Give `/flood-impact` crawlable text**: a 150–300 word intro (what happened, dates, rivers, districts, what the imagery shows) rendered in HTML, not only in the map UI. Add an `h1` that matches how people search ("Trishuli flood before and after satellite images"). | Google can't rank a video player |
| 2.2 | Titles/H1s that match real queries. People search "Nepal flood missing person", "Rasuwa flood relief", "Trishuli flood donation", not "verifiedNepal". Audit the 8 main public pages' `<title>`/`h1`/description against this. | Topic queries, not brand queries |
| 2.3 | **Article schema**: `functions/articles/[id].ts` already rewrites `<head>`; inject `Article` JSON-LD (headline, datePublished, author=Organization, image). | Rich results eligibility; "Search appearance" is currently empty |
| 2.4 | **Internal links in HTML**: expand the `<noscript>` list into a real footer nav rendered server-side in `index.html` (it's static anyway) so every public route is one link from `/` even before JS runs. | Discovery without JS |
| 2.5 | **Nepali as its own URL** (`?lang=ne` or `/ne/` prefix) with `hreflang`. Today EN/NE share one URL via a toggle, so the Nepali content is invisible to Nepali-language search. | Nepal is the top country in the Performance export. Bigger change — plan separately |
| 2.6 | **Links from outside.** Use the outreach copy in `docs/outreach/`: ask partner NGOs, the GitHub org page, LinkedIn posts, the Kathmandu Post / Setopati style coverage of the Trishuli flood to link to `/flood-impact` and `/drop-centers`. A handful of real links matters more than anything else in this document. | Zero-authority domain |
| 2.7 | Turn on Cloudflare **Crawler Hints / IndexNow** on the zone (one toggle). | Bing/Yandex learn about changes instantly |

### Phase 3 — monitoring, ongoing

| # | Action | Cadence |
|---|---|---|
| 3.1 | Search Console → Pages: Indexed count vs sitemap count; any new "not indexed" reason | Weekly |
| 3.2 | Search Console → Performance: first non-homepage impressions; first visible queries | Weekly |
| 3.3 | Core Web Vitals (Search Console → Experience) once there is enough traffic; until then run Lighthouse on `/`, `/flood-impact`, `/drop-centers` mobile | Monthly |
| 3.4 | Optional: Search Console API read access (service account added as Restricted user) so index status for every sitemap URL can be pulled automatically | Once |

## What *not* to do

- Don't add a Function catch-all for 404s — it runs on every request and
  re-creates the 100k/day quota problem fixed on 2026-09-30.
- Don't pre-render/SSR the whole SPA for SEO. Google renders JS fine; the
  problem is canonicals, sitemap and content, not rendering.
- Don't buy links or submit to directories.

## Open questions for the owner

1. Example URLs behind the 404 and 403 rows (Phase 0.2).
2. Is the Cloudflare zone managed in `verified-nepal-infra` Terraform? Decides
   where the `www` Redirect Rule lives.
3. Which 3–5 queries matter most? ("Trishuli flood", "Nepal flood help",
   "missing person Nepal", brand) — drives Phase 2.2 wording.
4. Should `/ledger` and `/audit` rank at all, or just be reachable?
