# Verified Nepal — public-site inventory (2026-10-14)

Scope: the public, signed-out surfaces of verifiednepal.com. Excludes `/desk`, `/org`, moderator queues and `/me` internals (only the reader-facing value of `/me` is noted in §9).

Sources: repo `/home/lxu/workspace/laxman/verifiednepal` at commit `80b04f2` (main, 2026-10-13), the committed `dist/` build from the same minute, and live `curl` / headless-Chrome checks against `https://verifiednepal.com` and `https://api.prod.verifiednepal.com` on 2026-10-14. File references are `path:line`. Screenshots (360×740 and 1280×800) are in `./screenshots/`; the desktop flood-impact capture timed out in headless Chrome (WebGL map) and is absent. The prod article page could not be captured because the prod API returns no published articles (see §3), so `article-dev-*.png` is the **dev** host (`dev.verifiednepal.com`) article page, same code, seeded content.

Live-state facts that shape everything below (checked 2026-10-14):

- `GET https://api.prod.verifiednepal.com/dispatches` → `{"items":[]}` (no published articles on prod).
- `GET /stories`, `/projects`, `/centers`, `/incidents` on prod → all `{"items":[]}`.
- `GET https://verifiednepal.com/articles/nope` → HTTP 404 (`functions/articles/[id].ts:20`).
- `GET https://www.verifiednepal.com/` → HTTP 200, no redirect (the www→apex Redirect Rule described in `docs/SEO-ACTION-PLAN.md` 1.2 is not in effect on the live zone; canonicals do point at apex via `functions/_shared/meta.ts:canonicalOrigin`).
- Bundled NDRRMA snapshot `public/data/meta.json` has `synced_at: 2026-08-29T19:32:46Z`; `src/data/relief-centers.json` meta `last_verified: 2026-09-08` (16 centres).

---

## 1. Public routes

Router: hand-rolled path matcher `src/lib/page-routing.ts:18-62`, page table `src/App.tsx:66-105`. All routes are rendered client-side from one `index.html`; Cloudflare Pages Functions in `functions/` rewrite `<title>`/OG/canonical per route before serving (`functions/_shared/meta.ts:applyMeta`). `_redirects` 301s `/dispatches*`→`/articles*`, `/poster/new`→`/poster`, `/flood-relief*`→`/drop-centers` (`public/_redirects:1-5`).

| Route | Component | What it shows | Sign-in | Kind |
|---|---|---|---|---|
| `/` | `src/pages/home.tsx` | Hero + 5 action cards, relief CTA band, flood-impact CTA, live NDRRMA figures, relief map, OPMCM updates, stories strip, hotlines, PMDRF donate notice, chat CTA | No | Mixed (reading + action) |
| `/articles` | `src/pages/dispatches.tsx` | Moderated article list, 7 tag filters, "Write an article" button | No to read; Google sign-in to write | Reading |
| `/articles/:id` | `src/pages/dispatch-detail.tsx` | Single article: byline, tags, cover with source, blocks, counters, like, share, print | No | Reading |
| `/incidents` | `src/pages/incidents.tsx` | Admin-approved disaster cards (name, kind, districts, summary, source link, share) | No | Reading |
| `/flood-impact` | `src/pages/flood-impact.tsx` | MapLibre "drive" along the Trishuli corridor with Sentinel before/after tiles, stops list, media gallery | No | Reading |
| `/climate` | `src/pages/climate.tsx` | Static dataset page: national warming contributions, ranking, trend chart, donut, share-card downloads | No | Reading |
| `/our-message` | `src/pages/our-message.tsx` | Word cloud of pre-set messages sent "from Nepal" to a chosen country; send form (Turnstile) | No | Reading/participation |
| `/projects`, `/projects/:id` | `src/pages/projects.tsx`, `project-detail.tsx` | Community rebuild projects filtered by disaster/district/status; detail with committee verification badge, photos, updates, payment details, share | No | Reading |
| `/projects/register`, `/projects/update` | `project-register.tsx`, `project-update.tsx` | Register a project / post a progress update with update code | No account (update code) | Action |
| `/drop-centers`, `/drop-centers/:id` | `src/pages/drop-centers.tsx`, `drop-center-detail.tsx` | Bundled JSON list of 16 relief drop-off points for the Rasuwa flood with Leaflet map, district/category filter, directions links; API-backed org centres (empty on prod) | No | Reading/action |
| `/coverage` | `src/pages/coverage.tsx` | Ward-level coverage table for a selected disaster; CSV/GeoJSON 3W export | No | Reading |
| `/ledger` | `src/pages/ledger.tsx` | Public masked ledger of fulfilled aid; CSV download (Turnstile) | No | Reading/transparency |
| `/audit` | `src/pages/audit.tsx` | Month-by-month moderator action log, names masked | No | Transparency |
| `/drones` | `src/pages/drones.tsx` | Public drone tasking board (open requests, landing sites, flights) | No | Reading (operational) |
| `/search` | `src/pages/find-person.tsx` | Name search over bundled NDRRMA rescued list + live NDRRMA missing list; `noindex` (`src/App.tsx:265`) | No | Action |
| `/missing` | `src/pages/missing-guide.tsx` | 7-step guide for families of missing persons; hotlines | No | Reading/guide |
| `/poster`, `/poster/:id` | `src/pages/poster.tsx` | Missing-person poster builder (canvas), public poster board, tip form | No to build/download; Google to save | Action |
| `/get-help` (`/status/:ref`) | `src/pages/get-help/index.tsx` | Need registration form (Turnstile), reference-code status check | No for self; Google when registering for someone else | Action |
| `/give-help` | `src/pages/give-help/index.tsx` | Published needs board with filters; "Register an offer" | No to browse; Google to offer/take | Action |
| `/report-incident` | `src/pages/report-incident.tsx` | Report an unlisted disaster with photo | Google required (`report-incident.tsx:78`) | Action |
| `/register-organization` | `register-organization.tsx` | Org registration | Google | Action |
| `/donation/:ref` | `donation-status.tsx` | Look up one donation's receipt/distribution | No | Reading |
| `/info` | `src/pages/info-help.tsx` | Hotlines, PMDRF notice, "What this site is", data source + sync time, status/nationality tables, official links, INGO links | No | Reading/about |
| `/how-to` | `src/pages/how-to.tsx` | Long illustrated "How VerifiedNepal works" guide with print styles | No | Reading/about |
| `/privacy` | `src/pages/privacy.tsx` | 23-section Privacy & Terms, EN and NE | No | Trust |
| `/me`, `/me/articles`, `/me/articles/:id/edit` | `me.tsx`, `src/articles/*` | Personal dashboard; article drafts/editor | Google | Account |
| `/desk`, `/desk/login`, `/org` | excluded | | | |
| anything else | `NotFound` (`src/components/not-found.tsx`) | "Page not found" + back button; JS `noindex`; HTTP status still 200 for non-detail routes | | |

Reading surfaces: `/articles*`, `/incidents`, `/flood-impact`, `/climate`, `/our-message`, `/projects*`, `/coverage`, `/ledger`, `/audit`, `/drones`, `/missing`, `/info`, `/how-to`. Action surfaces: `/get-help`, `/give-help`, `/report-incident`, `/search`, `/poster`, `/projects/register|update`, `/register-organization`. "Stories" have no route of their own; they appear only as a strip on `/` (`src/pages/home.tsx:365-407`) and `/stories` renders Not Found (screenshot `stories-404-*.png`). "Local updates" do not exist as a route (planned; §3).

Navigation exposure: header hamburger lists 13 pages (`src/components/site-header.tsx:28-42`: search, poster, getHelp, giveHelp, dropCenters, incidents, climate, ourMessage, info, projects, dispatches, ledger, drones) plus sign-in, org, guides; desktop status bar lists 8 (`src/components/site-status-bar.tsx:22-31`: front page, poster, drop centers, climate, our message, projects, articles, ledger) + Sign in. `/flood-impact`, `/coverage`, `/audit`, `/how-to`, `/missing`, `/incidents`, `/privacy` are reached only via home CTAs, footer, or the raw-HTML `<nav>` (`index.html:71-84`).

**Absent:** a dedicated `/stories` page; `/local` or any locality route; a category/section hierarchy; an author page; a search page over site content (only person search); a date archive.

## 2. Home page

Order of sections (`src/pages/home.tsx:51-224`), after the shared header, status bar and emergency bar:

1. Hero (`:55-80`): eyebrow `landingFloodName`, h1 `landingTitle`, lead `labels.aboutBody`; right column five `ActionCard`s in order find → missing (external OPMCM link) → poster → need → want, then "Running a relief group or a drop center? Register" link.
2. Blue relief band (`:82-125`): pulsing "live" dot, pill "16 relief centers" (count from bundled JSON, `:90`), h2 "Drop off flood relief goods", CTA to `/drop-centers`, link to `donate.gov.np`.
3. Flood-impact CTA band (`:127-142`): "Satellite view · Trishuli flash flood" / "See the corridor before and after".
4. `SituationBand` (`:144`, def `:316-350`): "Current situation" with four `StatCard`s — People rescued, People missing, Verified records, Active relief locations — "Source: NDRRMA — Government of Nepal / Updated <datetime>", link to ndrrma.gov.np situation report, disclaimer "Figures may change as official records are updated.", then `OfficialMessages` (NDRRMA messages feed) if any.
5. "Find relief near you" (`:146-211`): district `<select>` (persisted to `localStorage vn:region`, `:228-238`), place text search, `AffectedLocations` list, lazy Leaflet `ReliefMap`.
6. `OfficialUpdates` (`:213`, def `:440-466`): "Latest official update" — top 3 OPMCM `government-efforts` items with category badge, "OPMCM · <datetime>" and a green "Verified" `StatusBadge`; renders nothing if the feed fails.
7. `Stories` strip (`:215`, def `:365-407`): horizontal snap scroller of photo/video cards with role badge, caption, "By <name>"; **renders nothing when the API returns no items** (`:380`) — which is the prod state today.
8. Footer-adjacent block (`:217-223`): `EmergencyContacts` (1234 hero tile, 100/102/101 tiles, remaining hotlines from `src/lib/helplines.ts`), `PublicNotice` (PMDRF donate CTA + QR + police fake-QR warning), `AskTheDesk` (opens OnlyUtils chat widget).

Hero copy:

| | EN (`src/i18n/shell.ts:11`, `src/i18n/index.ts:67`) | NE (`src/i18n/shell.ts:109`, `src/i18n/index.ts` ne block) |
|---|---|---|
| Eyebrow | "Disaster response across Nepal" | "नेपालभरि विपद् प्रतिक्रिया" |
| H1 | "Community-verified disaster response for Nepal" | "नेपालका लागि समुदायबाट प्रमाणित विपद् प्रतिक्रिया" |
| Lead | "verifiedNepal is a community-verified disaster response coordination platform for Nepal. It is designed to make response information easy to scan while keeping individual records behind an explicit name search." | "भेरिफाइड नेपाल नेपालका लागि समुदायबाट प्रमाणित विपद् प्रतिक्रिया समन्वय गर्ने प्लेटफर्म हो। यसले प्रतिक्रिया सम्बन्धी जानकारी छिटो बुझ्न मद्दत गर्छ र व्यक्तिगत अभिलेखलाई स्पष्ट नाम खोजी पछाडि राख्छ।" |
| Tagline (header) | "Independent disaster information and mutual aid" | "स्वतन्त्र विपद् सूचना र पारस्परिक सहयोग" |

How "latest" is surfaced: only (a) the NDRRMA live counters (polled every 5 min, `src/lib/live.ts:19`), (b) the three newest OPMCM government-effort items (external links), (c) the stories strip. No article headlines, no incident cards and no project cards appear on the home page.

Disaster selection: the home page is hard-wired to the 2026 Rasuwa/Bhote Koshi–Trishuli flood (NDRRMA rescues API, bundled relief-centres JSON event string, flood-impact CTA). The multi-disaster model (`src/lib/incidents.ts`, `/incidents`) drives `/projects`, `/coverage`, `/get-help` pickers but is not represented on `/`. District choice on the home page filters only the relief map/list and is passed to the chat widget as context (`src/lib/chat-widget.ts:wireRegionContext`).

**Absent:** headline list / "latest" feed, ticker, trending, "your area" block (planned in `docs/NEWS-PORTAL-DECISIONS.md` #8), per-disaster switcher on the home page, any dateline/edition marker on the home page (an `edition.ts` helper exists, `src/lib/edition.ts`, but is unused on `/`), weather/river-level widgets.

## 3. Content types published

### 3a. Articles (`DISPATCH`, public at `/articles`)

Fields (`src/lib/api.ts:1609-1634`, `src/articles/types.ts`): `title` and `body`/`excerpt` as string or `{en, ne?}`; `author.displayName`, `author.place` (no email); `tags` from a fixed list of 7 — climate, mountains, floods, landslides, glaciers, community, story (`src/lib/api.ts:1598`; up to 3 per article, `privacy.tsx:37`); `publishedAt`, `createdAt`; `cover {url, source (required credit), caption}`; `blocks[]` of paragraph / heading / quote / image / video, each media block with required `source` (`src/articles/types.ts:9-17`), limits 60 blocks, 5,000 chars per block, 200-char title (`:28`). Counters `views`, `likes`, `shares`.

Display:
- List (`src/pages/dispatches.tsx:140-180`): cover thumbnail (lazy), tag badges, title, 3-line excerpt, "By {name} · {place} · <time>", eye/heart/share counters, "Read article →". Tag filter buttons (`:121`). "Load more" cursor pagination.
- Detail (`src/pages/dispatch-detail.tsx:183-271`): "← Back to articles", eyebrow "Articles", h1, byline string "By {name} · {place} · {datetime}", tag badges, cover `<figure>` with caption and "Source: {source}" (`:202`), body blocks (`src/articles/render.tsx`), counters bar, Like button (anonymous like stored in `localStorage`, `:148-180`; "Sign in to keep your likes"), WhatsApp / Facebook / Copy link / Print (`:244-263`). Views counted once per `sessionStorage` (`:97-108`).
- Timestamp: `formatDateTime` → `Intl.DateTimeFormat('en-GB' | 'ne-NP', {day:'2-digit', month:'short', year, hour, minute, hour12:false, timeZone:'Asia/Kathmandu'}) + " NPT"` (`src/lib/format-date.ts:16-28`). Gregorian only; absolute, not relative. Example EN "06 Sept 2026, 18:29 NPT" (screenshot `article-dev-360x740.png`); NE renders Devanagari digits and month, e.g. "२०२६ अगस्ट ३०, ०१:१७ NPT".
- Share metadata: per-article OG title/description/image and `Article` JSON-LD (headline, datePublished, dateModified, image, author Person, publisher Organization, `inLanguage: "en"` hard-coded) injected by `functions/articles/[id].ts` via `src/lib/og-meta.ts:57-85`.
- Language: an article is stored in whichever language(s) it was written; `localizedText` falls back EN↔NE (`src/lib/format.ts:9-12`). No language chip on cards.
- Write path: "Write an article" → Google sign-in → `/me/articles` block editor (`src/articles/editor.tsx`); moderator approval before publish (`docs/FEATURES.md` §9).

Prod state: zero published articles; `/articles` shows "No articles match this filter. Try another tag or check back later." (screenshot `articles-1280x800.png`).

**Absent on articles:** comments, reactions other than like, related/next articles, author profile page, category beyond the 7 tags, corrections note or edit history (only `dateModified` in JSON-LD), reading time, update/"last edited" line in the UI, Nepali-specific date (BS), `inLanguage` reflecting Nepali content, series/collections, pull quotes with attribution fields (quote block is free text).

### 3b. Stories (`STORY`)

One photo or video + caption ≤ 500 chars, role badge (Received help / Helped someone / Organization), "By {displayName}" (`src/pages/home.tsx:384-403`, `src/i18n/articles-public.ts:31-33`). Eligibility-gated (`FEATURES.md` §10). No timestamp shown, no detail page, no share button, no tags. Home strip only. Prod: none.

### 3c. Local updates — **planned, not shipped**

`docs/NEWS-PORTAL-DECISIONS.md` (2026-10-14) settles a `kind: news` DISPATCH subtype with scope radios Ward→Nepal, locality, `happenedAt`/`expiresAt`, post-moderation with "Not yet checked / अझै जाँच भएको छैन" vs "Checked by volunteer / स्वयंसेवकले जाँचेको" labels, `/local/<municipality>` page, "Now" strip, home "Your area", a `reporter` role, two labelled ad slots. None of this exists in `src/` (no `kind`, `locality`, `reviewedAt` in `src/lib/api.ts`; no `/local` route in `src/lib/page-routing.ts`). Public naming decision: "Local updates" / "local correspondents", never "news portal"/"reporters" (decision #6).

### 3d. Incidents (`/incidents`, `src/pages/incidents.tsx:21-105`)

Card: name (NE variant if present), status badge (Active/Archived), kind badge, cover image, summary, affected-district badges, `startedAt` via `formatDateTime`, PNG share-card download/share (`ShareButton`), optional "View source" button from `sourceAttribution {label,url}` (`:74-80`), WhatsApp and Facebook share. Filters: text search, 77-district picker. No detail page, no timeline of updates per incident, no `updatedAt` shown. Prod: none.

### 3e. Climate (`/climate`)

Static dataset (Jones et al., Zenodo 10.5281/zenodo.16640595, CC-BY-4.0; `public/data/climate/meta.json`), `synced_at 2026-09-03`. Page shows title "Nepal didn't heat the planet. Nepal pays for it." (`src/i18n/climate.ts:7`), ranking panel, multi-line chart, donut, Zenodo and GitHub source links (`src/pages/climate.tsx:233,328-337`), "Data last refreshed: <datetime>" (`:347`), PNG share-card downloads. Numbers use `toLocaleString(undefined)` (browser locale, not the site language) in `climate.tsx:24-27`.

### 3f. Flood impact (`/flood-impact`)

Manifest-driven (`VITE_FLOOD_MANIFEST_URL` → `cdn.prod.verifiednepal.com/floods/trishuli-2026-08-26/published/manifest.json`), MapLibre map with Esri basemap and Vantor/Sentinel overlays, stop list, play/pause/speed, fullscreen, `?loc=` deep link kept in sync (`flood-impact.tsx:134`), Web Share / clipboard share (`:159`), media gallery with YouTube-nocookie embeds and Wikimedia items, credit line (`src/i18n/flood-impact.ts:imageryCredit`). Eyebrow "26 August 2026 · Langtang Lirung glacial lake outburst"; three fact rows (When / Trigger / Reach). Text content is ~3 sentences plus captions.

### 3g. Projects (`/projects`, `/projects/:id`)

Filters disaster / district / status / type; cards with status badge; detail shows committee "Verified"/"Not verified" badge (`project-detail.tsx:132`), photos, updates with `formatDateTime`, bank/eSewa/Khalti details, share (copy, WhatsApp, Facebook `:273-288`). Prod: none.

### 3h. Official updates on home

OPMCM `government-efforts` items: category badge, title, 3-line summary, "OPMCM · <datetime>", green "Verified" badge, "Read update →" to `rescue.opmcm.gov.np/government-efforts` (`home.tsx:468-505`). The "Verified" badge here denotes "official source", not moderation.

Cross-type **Absent:** comments/discussion anywhere; reactions beyond article likes; corrections/retraction notices; edit history; author pages; related-content modules; per-item RSS; BS (Bikram Sambat) dates anywhere in the UI (the only BS string is inside the relief-centres event title "(10 Bhadra 2083)", `src/data/relief-centers.json` meta).

## 4. Language

Mechanism: `language` React state initialised from `localStorage["verifiednepal:language"]` (default `en`), persisted on change, and mirrored to `<html lang>` (`src/App.tsx:181-197`). Toggle is a single header button showing the *other* language's name ("नेपाली" / "English", `src/components/site-header.tsx:71-81`). Strings are per-area TypeScript objects `{en:{…}, ne:{…}}` under `src/i18n/*.ts` (27 files); key parity is enforced by `satisfies Record<Language, …>` / `typeof en` typings, and a count of keys shows identical EN/NE totals in every file (e.g. `index.ts` 655/655, `community.ts` 287/287, `shell.ts` 96/96).

- URL does **not** change with language; there is no `/ne/` prefix, `?lang=`, or `hreflang`. `docs/SEO-ACTION-PLAN.md` 2.5 lists "Nepali as its own URL" as a future item.
- The pre-hydration HTML (`index.html`) is English-only (`<html lang="en">`, English `<nav>` and `<noscript>` text).
- `document.title` is bilingual via `pageTitle()` (`src/App.tsx:108-150`); the server-side title/description/OG rewrites are English-only (`src/lib/og-meta.ts:97-210`).
- Untranslated in the UI: external-source labels such as "OPMCM", "NDRRMA", "CWIN", "WhatsApp", "Facebook", "GitHub ↗", "OnlyUtils", "NPT", domain strings; chat-widget disclaimer and greeting are English only (`src/lib/chat-widget.ts:181,224`); relief-centre names/addresses in `src/data/relief-centers.json` are as collected (mixed); OPMCM/NDRRMA feed content is shown in whichever language the API returns, with field-name fallbacks (`home.tsx:470-480`); article/story/incident body text is author-language; `docs/GOVERNANCE.md` and the five PDF guides are English only (guide labels are bilingual).
- Nepali copy sample (10 strings, all present):

| Key | EN | NE |
|---|---|---|
| `shell.findSomeone` | Find someone | व्यक्ति खोज्नुहोस् |
| `shell.needHelpDescription` | Request goods, shelter, transport or medical support. | सामान, आश्रय, यातायात वा स्वास्थ्य सहयोग माग्नुहोस्। |
| `shell.currentSituation` | Current situation | हालको स्थिति |
| `shell.peopleMissing` | People missing | हराएका व्यक्ति |
| `shell.storiesTitle` | Stories from the ground | भुइँतहका कथाहरू |
| `shell.emergencyIntro` | Call official emergency numbers first… | तत्काल उद्धार, स्वास्थ्य वा सुरक्षाका लागि पहिले आधिकारिक आपतकालीन नम्बरमा फोन गर्नुहोस्। |
| `articlesPublic.lead` | Moderated community writing on mountains and climate — editorial, not a forum. | हिमाल र जलवायुबारे सम्पादित सामुदायिक लेखन — फोरम होइन। |
| `disasters.incidentsPublicLead` | Community-reported emergencies that moderators have verified, current and past. | समुदायले रिपोर्ट गरेका, मोडरेटरद्वारा प्रमाणित वर्तमान तथा विगतका आपतकालहरू। |
| `climate.title` | Nepal didn't heat the planet. Nepal pays for it. | पृथ्वी नेपालले तताएको होइन। मूल्य भने नेपालले चुकाइरहेको छ। |
| `shell.notFoundBody` | The page you requested does not exist or may have moved. | तपाईंले खोज्नुभएको पृष्ठ छैन वा स्थान परिवर्तन भएको हुन सक्छ। |

- Fonts (`index.html:28-34`): Google Fonts CSS2 request for **Noto Sans** 400/500/600/700 and **Noto Sans Devanagari** 400/500/600/700, `display=swap`, with `preconnect` to googleapis/gstatic. Not self-hosted. Measured per-subset woff2 sizes from fonts.gstatic.com: Noto Sans latin 35.8 KB ×4 weights, Noto Sans devanagari subset 99.2 KB ×4; Noto Sans Devanagari devanagari subset 121.2 KB ×4 and its latin subset 25.4 KB ×4. A Nepali page that uses all four weights can pull roughly 0.5–0.9 MB of font data (Noto Sans's own Devanagari subset is listed first in the `font-family` stack, so it, not Noto Sans Devanagari, serves Devanagari glyphs: `src/styles.css:102-110`, `tailwind.config.ts:fontFamily`). Font files are not precached by the service worker (they are cross-origin). `docs/DESIGN-GUIDELINES.md` §2.2 fixes "one family … do not add families".
- Numbers/dates: `formatNumber` → `Intl.NumberFormat('ne-NP')` yields Devanagari digits ("६,६३३") (`src/lib/format-date.ts:41-43`); `formatDateTime` ne-NP yields Devanagari digits with a Gregorian calendar ("२०२६ अगस्ट ३०, ०१:१७ NPT"). No Bikram Sambat conversion anywhere (`grep -r "Bikram\|BS " src` → none). Phone numbers and codes stay Latin (`tabular-nums`). `html[lang="ne"] .uppercase` disables tracked uppercase (`src/styles.css:124-127`).

**Absent:** language in the URL, `hreflang`, server-rendered Nepali title/description/OG, Nepali `<noscript>`/raw nav, BS dates, self-hosted/subsetted fonts, Nepali versions of the PDF guides and GOVERNANCE, a per-item language chip (planned for local updates), transliterated search (`docs/CONTRIBUTOR-TODO.md` §2).

## 5. Performance and data cost

Build: Vite 6 + React 18 + Tailwind 3 + `vite-plugin-pwa` (`package.json`). `dist/` total 13 MB (of which `how-to/*.jpg` 4.9 MB, `data/` 2.1 MB, `guides/*.pdf` 368 KB, `brand/` 464 KB).

Main chunks (`dist/assets`, raw → gzip -9; live transfer is Brotli, measured 229 KB for the entry JS):

| Chunk | Raw | gzip | Loaded when |
|---|---|---|---|
| `index-*.js` (React, Radix, lucide, all i18n, home page, flood-impact page shell, API client) | 804 KB | 231 KB (br 229 KB live) | every page |
| `index-*.css` | 65 KB | 12 KB (br 12.3 KB) | every page |
| `leaflet-src-*.js` + `leaflet-*.css` | 150 KB + 15 KB | 43 KB | home (relief map), drop-centers, climate world map |
| `relief-map-*.js` | 9 KB | 4 KB | home |
| `flood-impact-map-*.js` + `maplibre-gl-shared.mjs` + worker + css | 1,048 KB + 513 KB + 19 KB + 83 KB | 285 KB + 146 KB | `/flood-impact` only |
| `climate-data-*.js` + `world-countries.geo-*.js` | 299 KB + 257 KB | 44 KB + 103 KB | `/climate`, `/our-message` |
| `municipality-select-*.js` (admin units) | 118 KB | 24 KB | forms |
| `privacy-*.js` | 57 KB | 15 KB | `/privacy` |
| `desk-*.js`, `org-dashboard-*.js` | 156 KB, 116 KB | — | signed-in only |
| route pages (`dispatches`, `dispatch-detail`, `find-person`, `our-message`, `poster`, `drop-centers`, …) | 4–24 KB each | 2–8 KB | lazy per route (`src/App.tsx:31-63`) |

Code splitting: every route except `/` and `/flood-impact` page shell is `React.lazy` (`src/App.tsx:31-63`); `FloodImpact` is imported eagerly (`:3`) but its map is lazy (`flood-impact.tsx:25`). The home page eagerly bundles `public/data/{meta,messages,country-counts,rescued-locations,rescued-statistics,stationed-locations,status-counts,statuses}.json` via `src/lib/data.ts`. `rescued-persons.json` (1.5 MB) is fetched only on `/search` (`find-person.tsx:34`) — but is also **precached by the service worker on first visit** (see below).

Home-page network on first visit (observed/derived): HTML 4.5 KB; entry JS ~229 KB br; CSS ~12 KB; Google Fonts CSS + 2–8 woff2 files (36–121 KB each); Leaflet chunk ~43 KB gz + Esri World_Imagery and Boundaries tiles (`src/components/relief-map.tsx:136-142`); six NDRRMA/OPMCM JSON calls (`src/lib/live.ts:149-156`), repeated every 5 min while visible; `GET /stories` and `POST /reach` to `api.prod.verifiednepal.com`; OnlyUtils chat widget script `onyutils-chat-widget.pages.dev/onyutils-chat.js` loaded on idle after 4 s unless `saveData` or 2G (`src/lib/chat-widget.ts:261-278`); then SW install precaches 124 entries including all route JS, 15 JSON data files (`rescued-persons.json` 1.5 MB, climate geo/time-series) and 13 PNGs — several MB of background download on first load (`vite.config.ts:53` `globPatterns: **/*.{js,css,html,svg,png,woff2,json}`; measured from live `sw.js`).

Measured live timings (curl, single sample, Cloudflare edge): `/` TTFB+download 0.60 s for 4.5 KB; `/articles` 0.38 s; `/drop-centers` 0.20 s; `/sitemap.xml` 1.9 s (fetches three API lists); `/sw.js` 1.0 s.

Images: article/story/incident media are user uploads via OnlyUtils presign (`src/lib/media.ts`), JPEG/PNG/WebP ≤10 MB, video MP4/WebM ≤100 MB (`src/articles/types.ts:30-33`); poster photos are downscaled client-side to 1,600 px (`src/lib/image.ts`). No responsive `srcset`, no server-side resizing (requirement noted in `docs/onlyutils-media-variants-requirement.md`). `loading="lazy"` on list covers, story images, article body images, incident covers; the article hero cover is not lazy (`dispatch-detail.tsx:192-197`). OG cards are 1200×630 PNGs 56–68 KB. `/how-to` embeds ~50 JPEG screenshots (4.9 MB total; only one `loading="lazy"` occurrence in `how-to.tsx`).

Maps/video on home: Leaflet + Esri raster tiles (grayscale filter via CSS `src/styles.css:170`), `scrollWheelZoom={false}`, dragging locked until "Tap to explore map" (`relief-map.tsx:131-133`). No video on home unless a story is a video (`preload="metadata"`). MapLibre is not loaded on home.

Service worker / offline: `vite-plugin-pwa` `registerType: autoUpdate`, `navigateFallback: index.html` (`vite-config.ts:54`), runtime caching: `NetworkFirst` 5 s timeout for `/needs`, `/offers`, `/projects`, `/dispatches`, `/stories`, `/missing`, `/centers` (5-min cache); `StaleWhileRevalidate` for `/data/*` (24 h) and for `/articles*`, `/projects*`, `/ledger`, `/audit`, `/status/*` (5 min); `NetworkOnly` for auth/me/admin. A page reload is forced on SW `controllerchange` after a deploy (`src/main.tsx:16-21`). Offline the app shell and previously cached lists render; NDRRMA live calls fail and the bundled snapshot is shown with the "Official data snapshot" badge (`src/lib/live.ts:130-160`). An outbox queues signed-in need submissions offline (`src/lib/outbox.ts`, `OutboxBadge`).

Caching headers (live): HTML and `manifest.webmanifest` `cache-control: public, max-age=0, must-revalidate`, `cf-cache-status: DYNAMIC`; hashed `/assets/*` `public, max-age=14400, must-revalidate` (4 h, not immutable); `/robots.txt`, `/sw.js` `max-age=14400`; `/sitemap.xml` `max-age=300`. All responses `x-content-type-options: nosniff`. Non-prod hosts add `X-Robots-Tag: noindex, nofollow` (`functions/_middleware.ts:5`).

Analytics: first-party page-view counter only (`src/lib/reach.ts`, `POST /reach` with page, path, lang, referrer host); no third-party analytics; `llms.txt` states "sets no cookies and runs no analytics" (`public/llms.txt`).

**Absent:** Lighthouse/CWV data (not run; Search Console has too little traffic per `docs/SEO-ACTION-PLAN.md` 3.3), immutable long-TTL asset caching, image CDN/variants, `srcset`, font self-hosting/subsetting, a text-only/lite mode, "save data" handling beyond the chat widget, SSR/prerendering (explicitly ruled out in `docs/SEO-ACTION-PLAN.md` "What not to do").

## 6. Mobile

- Viewport meta `width=device-width, initial-scale=1.0` (`index.html:5`); `body min-width: 320px` (`src/styles.css:100`); `color-scheme: only light` blocks Chrome auto-dark (`:51`).
- Navigation: top header 56 px (`h-14`, `site-header.tsx:59`) with logo, (account), language button, "Aa" accessibility toggle, hamburger (`lg:hidden`, `:85`) opening a right-side Radix `Sheet` list. No bottom tab bar. The desktop link strip in the status bar is `hidden … lg:flex` (`site-status-bar.tsx:38`), so on phones the status bar shows only the Live/Snapshot badge.
- Emergency bar: compact one-line variant on `<sm` ("In danger? 1234 · Police 100 · Ambulance 102", `emergency-bar.tsx:17-40`), full variant with drop-off and donate buttons from `sm`. Not sticky.
- Sticky/fixed: nothing in the public shell is sticky (header scrolls away); fixed elements are the Back-to-top button (bottom-left, appears near page end, `back-to-top.tsx:30`), the OnlyUtils chat launcher (bottom-right, 56 px, raised to 88 px from bottom on phones, `chat-widget.ts:92-95`), dialogs/sheets, the flood-impact pseudo-fullscreen (`flood-impact.tsx:206`). `lg:sticky` sidebars on `/how-to` TOC and poster preview.
- Touch targets: `Button` default `min-h-11` (44 px), `sm` `min-h-10`, `icon` 44×44 (`src/components/ui/button.tsx:19-23`); 56 `min-h-11` usages across `src`; hotline tiles `min-h-24`/`min-h-32`; a11y controls `min-h-11 min-w-11`. Tag-filter and share buttons use `size="sm"` (40 px).
- Horizontal scroll risks: intentional `overflow-x-auto` scrollers (stories strip `home.tsx:382`, tables); `break-all` on hotline numbers; `line-clamp` on titles/excerpts. The hero h1 at 36 px wraps to three lines at 360 px (screenshot `home-360x740.png`). Leaflet map on `/drop-centers` sits in a `min-w-0` wrapper. No `100vw` widths in public components except the fullscreen flood map.
- Phone screenshots: `home-360x740.png` (hero, first action card), `drop-centers-360x740.png` (title, filters, map top), `article-dev-360x740.png` (byline above title, cover, source line), `find-person-360x740.png`, `our-message-360x740.png`, `flood-impact-360x740.png`.

**Absent:** bottom navigation, sticky header or sticky emergency strip, pull-to-refresh, swipe between items, "back to list" affordance beyond browser back on most pages, install prompt UI for the PWA, AMP/lite pages.

## 7. Discovery and distribution

SEO:
- Titles: `document.title = "<page> · verifiedNepal"` client-side (`src/App.tsx:200`); server-side `<title>` per route from `STATIC_PAGE_META` and per-item functions (live `/articles` → "Articles · verifiedNepal", `/climate` → "Nepal caused 0.14% of global warming · verifiedNepal", `/flood-impact` → "Trishuli flood — before and after · verifiedNepal"). Home title "verifiedNepal | Community-verified disaster response for Nepal" (`index.html:35`).
- Canonicals: per route via Functions, always on the apex (`functions/_shared/meta.ts:27-29`); routes without a Function (`/search`, `/404`) keep the home canonical. `/search` and client Not Found get JS `noindex` (`src/App.tsx:256-268`); detail routes return real 404s.
- `robots.txt` (`public/robots.txt`): blocks AhrefsBot entirely, disallows `/search`, `/data/`, `/desk`, `/me`, `/org`; sitemap URL declared.
- Sitemap: `functions/sitemap.xml.ts` — 18 static URLs plus live `/dispatches`, `/projects`, `/centers` items with `lastmod`; live output today has only the 18 static entries (no dynamic items on prod). `changefreq` hourly for `/`, daily for articles/projects/drop-centers/incidents/poster/ledger/audit.
- JSON-LD: `WebSite` (`inLanguage: ["en","ne"]`) + `Organization` on every page (`index.html:36-61`); `Article` on article pages (`functions/articles/[id].ts:30`). No `NewsArticle`, `BreadcrumbList`, `Event`, `Dataset`.
- `hreflang`: none. `meta name="author"`, `article:published_time`, `article:author`, `article:section` OG tags: none (only `og:type=article` on article pages, `functions/articles/[id].ts:27`). Bing `msvalidate.01` meta present (`index.html:9`); `BingSiteAuth.xml` and a Google HTML verification file in `public/`.
- Raw HTML content: an English `<nav aria-label="Site pages">` of 15 links and a `<noscript>` line (`index.html:71-87`); otherwise the `#root` is empty until JS runs.
- `docs/SEO-ACTION-PLAN.md` records that as of 2026-10-13 Google had indexed only the home page and the sitemap had never been submitted (owner action). Memory note: www redirect was to be a Terraform Redirect Rule; live check today shows `www` still serving 200.

Share cards: per-route OG images — `og-card.png` (default), `og-poster`, `og-missing`, `og-get-help`, `og-give-help`, `og-drop-centers`, `og-projects` (`src/lib/og-meta.ts:97-210`, `public/brand/`); articles use the cover image; projects the first published photo; drop centres text-only; climate has a computed description. All `summary_large_image`.

In-page share: WhatsApp + Facebook + Copy link + Print on articles (`dispatch-detail.tsx:242-268`); WhatsApp + Facebook + PNG card on incidents; copy + WhatsApp + Facebook on project detail; Web Share API / clipboard on flood-impact stops; Web Share with file for posters (`poster.tsx:203-215`) and a four-format download menu (Instagram, Facebook, Twitter, A4 print, `:172-200`); PNG "Download for social media" cards on climate, our-message, incidents and drop-centres (`ShareButton`, `src/components/share-button.tsx`). Viber, X/Twitter intent, Telegram, email share: none.

QR/poster downloads: poster PNG downloads (above); PMDRF donation QR SVG on home and `/info`; moderator-only claim-sheet QR in the Desk (excluded).

PWA: `manifest.webmanifest` name "VerifiedNepal", `display: standalone`, `start_url: /`, 192/512/maskable icons, white theme colour (`vite.config.ts:34-48`); `<meta name="theme-color" content="#003893">` in HTML. Installable; no custom install prompt.

Social presence: footer links to GitHub (`github.com/onlyutils/verified-nepal`), OnlyUtils, `mailto:verifiednepal01@gmail.com` (`site-footer.tsx:38-71`). `Organization.sameAs` lists only GitHub.

`llms.txt` (`public/llms.txt`): plain-text site description for AI crawlers, still describing the site as a dashboard for the Rasuwa flood.

**Absent:** RSS/Atom/JSON feed (`/feed.xml`, `/rss.xml` return the SPA shell with 200), newsletter/email signup, Web Push or any notifications, Google News sitemap / `NewsArticle` schema / `article:published_time`, Facebook page / X / YouTube / Viber / Telegram links, Facebook Instant Articles, IndexNow (planned 2.7), author meta, breadcrumbs, open embed/oEmbed, a "share to Viber" option (Viber is common in Nepal; only WhatsApp/Facebook are offered).

## 8. Trust and transparency surfaces

- Who runs this: `/privacy` §1 "Who operates this site": "verifiedNepal is a non-commercial, volunteer project maintained by a single private individual (the 'Maintainer'). It is not a government website and is not affiliated with … NDRRMA…" (`src/pages/privacy.tsx:12-16`, Nepali `:181-185`). Footer "Independent status" links to the same page; "Powered by OnlyUtils" credit (`site-footer.tsx:50-71`). `/info` "What this site is" card repeats the hero lead (`info-help.tsx:27-29`). `/how-to` §"What VerifiedNepal is" (`src/i18n/how-to.ts:15-17`). No named people, no masthead, no editor, no address, no phone.
- Contact / report a problem: `mailto:verifiednepal01@gmail.com` in footer, missing guide (`missing-guide.tsx:70`), error strings (`src/i18n/index.ts errGeneric`); "Report a problem" flag dialog exists on needs cards (`src/i18n/index.ts flagReportProblem`); no contact form, no corrections address, no report button on articles/incidents.
- Governance / moderation guidelines: `docs/GOVERNANCE.md` and `docs/MODERATION-GUIDELINES.md` exist in the repo (English, GOVERNANCE carries a "Nepali translation planned" TODO) but no public route or link renders them (`grep -r "MODERATION-GUIDELINES\|GOVERNANCE" src` → none outside the Desk). The five PDF guides (seeking help, providing help, organizations, writing an article, moderators) are linked from the menu and footer.
- Audit log `/audit`: public, masked, monthly grouping (`audit.tsx:120-183`). Ledger `/ledger`: public masked rows, CSV "for journalists and researchers" (`src/i18n/index.ts ledgerDownloadHint`). Coverage `/coverage` with 3W CSV/GeoJSON (`coverage.tsx:91-102`).
- "Verified" mark semantics: the word appears in several distinct senses, each with text labels — (1) green "Verified" badge on OPMCM official updates = "from an official source" (`home.tsx:490`); (2) "Verified records" stat = NDRRMA's own individually verified rescued records (`shell.verifiedRecords`); (3) project committee "Verified"/"Not verified" badge = moderator phone-verified committee (`project-detail.tsx:131-132`); (4) "Verified incidents" = admin-approved community reports (`disasters.incidentsPublicLead`); (5) organisation trust tiers (`FEATURES.md` §6). The reader-facing explanation lives on `/how-to` under "The one rule: verification comes before visibility" (`src/i18n/how-to.ts:26`) and in `docs/DESIGN-GUIDELINES.md` §1.3 ("Anything that came from an official source or passed moderation shows it … Anything unverified says so"). Articles themselves carry no visible "verified"/"moderated" label on the page; the only signal is the list lead "Moderated community writing…". The planned local-updates labels ("Not yet checked" / "Checked by volunteer") are not built.
- Source attribution on live figures: home SituationBand shows "Source: NDRRMA — Government of Nepal · Updated <time>" and the disclaimer; status bar/footer `LiveStatusBadge` shows "Live · updated HH:MM" or "Official data snapshot · Updated HH:MM NPT, D Mon YYYY" with a tooltip "Live data is not available yet; showing the bundled snapshot, which may be stale." (`src/lib/live.ts:130-160`). `/info` has a Data source table with the snapshot sync time (`info-help.tsx:36-45`) and the note "The timestamp shown on each page is the mirror sync time, not a claim that the source updated at that moment." Climate: Zenodo DOI, licence and "Data last refreshed". Flood-impact: imagery credit line. Drop centres: "Last verified: 2026-09-08" (`drop-centers.tsx:60`) and the dataset disclaimer rendered on the page (`drop-centers.tsx:132`: "Independently compiled from Nepali government notices, news reporting and a social-media-organized citizen relief effort. Not an official government source…"). Articles: mandatory "Source:" line under cover and every media block (`render.tsx:17-26`). Incidents: optional "View source" button.
- Privacy policy: `/privacy`, 23 sections EN + NE, covers data collected per form, page-view counting, retention (needs expire 30 days), removal rights, children, governing law (Nepal, Individual Privacy Act 2075).
- DoIB / Press Council registration statement: **none** on the site. `docs/NEWS-PORTAL-DECISIONS.md` "DoIB note" records that the owner is to seek a Nepali media lawyer's opinion before any public copy says "news".
- Donation trust: PMDRF notice with police fake-QR warning and "VerifiedNepal never handles donations" (`shell.publicNoticeWarning`, `labels.donateWarning`), GOVERNANCE "No-money principle".

**Absent:** about/team page, editorial policy or corrections policy page, a public link to GOVERNANCE/MODERATION-GUIDELINES, DoIB/Press Council registration or disclaimer, ownership/funding disclosure beyond "single private individual", physical address, a per-article "how this was checked"/moderation label, fact-check methodology, visible version/changelog, data licence statement for the site's own content beyond `/privacy` §16.

## 9. Engagement features

- Search: person-name search only (`/search`: bundled NDRRMA rescued list + live NDRRMA missing list, diacritic-folded, order-independent, Devanagari or Latin, 50 results, `find-person.tsx:21-93`); text filter on `/incidents` (name/district) and `/drop-centers` place search on home. No site-wide content search, no article search.
- Filters: articles by 1 of 7 tags; projects by disaster/district/status/type; incidents by text + multi-district picker; needs board by district/category; ledger by district/ward; drop centres by district/category; coverage by disaster; home relief list by district (persisted `vn:region`).
- Save/bookmark: none for readers (signed-in users can save their own posters/drafts).
- Comments: none. Reactions: article Like only (anonymous via `localStorage`, or account-bound) with public like count; view and share counters.
- Follow a district / topic: none (district preference only filters the relief map and feeds the chat widget).
- Notifications: none public (in-app activity badges on `/me` sections for a signed-in user's own items, `me.tsx:95-137`).
- Chat assistant: OnlyUtils widget "Ask the desk" on every public page except Desk/login (`src/styles.css:131-136`, hidden via `html[data-page]`), greeting "I'm here to help. Ask about rescued or missing people, relief locations, or how to get help." (`chat-widget.ts:224`).
- Account value for a plain reader (`/me`): sections are Needs you registered, Registered-for-others needs, Handled needs, Groups, Offers, Posters, Projects you registered, Incidents, Donations, Story, Your work tally, Shortcuts, plus `/me/articles` drafts (`me.tsx` section titles via `src/i18n/me.ts`). Everything is about the user's own submissions; there is no reading history, saved articles, followed topics, or personalised feed. Signing in from an article only "keeps your likes" (`articlesPublic.signInToKeepLikes`).

**Absent:** content search, bookmarks/read-later, comments, reactions beyond like, follow/subscribe, personalised or locality feed, notifications, polls, reader submissions of tips on articles (tip form exists only on posters), reading history, dark mode (explicitly opted out, `styles.css:51`).

## 10. Accessibility

- `<html lang>` switched to `ne`/`en` with the toggle (`src/App.tsx:196`); inline `lang` on the opposite-language wordmark and toggle label (`logo.tsx:34-37`, `site-header.tsx:80`). Mixed-language strings inside Nepali UI (e.g. "OPMCM", "NPT") carry no `lang`.
- Skip link "Skip to main content" (English only), `sr-only` until focused (`src/App.tsx:285-291`); `<main id="main" tabIndex={-1}>` (`:324`) receives focus on route change (`focusMainAndScroll`, `:164-176`).
- Focus styles: `focus-visible:ring-2 focus-visible:ring-ring` on `Button` and 45 other usages; ring colour is brand blue (`--ring`), black in high contrast.
- Alt text: decorative logos/icons `alt=""`/`aria-hidden` (7 `alt=""`, lucide icons `aria-hidden="true"` throughout); content images use caption or title as alt (`dispatch-detail.tsx:194`, `render.tsx:57`, `home.tsx:391`); list covers use the generic "Article cover" (`dispatches.tsx:148`); incident covers use the incident name.
- Contrast tokens: ink `#1C1B1A` on white, secondary text `#5A5754`, warning pair chosen for AA (`docs/DESIGN-GUIDELINES.md` §2.1); high-contrast mode via OS `prefers-contrast: more` or the "Aa" bar (`src/styles.css:58-88`), thicker link underlines in HC.
- Accessibility bar (`src/components/accessibility-bar.tsx`): "Aa" button in the header opens A−/A/A+ (100–150 % root font size, 5 steps) and a High contrast toggle; settings persist in `localStorage` and are applied before first paint by an inline script (`index.html:63-69`).
- Reduced motion: global `prefers-reduced-motion: reduce` kill-switch for animations/transitions (`src/styles.css:253-261`); the live dot uses `motion-reduce:animate-none` (`home.tsx:87`).
- Semantics: `PageHeader` guarantees one `h1` per route (`page-header.tsx:18-21`); `<time dateTime>` on article list dates; status uses colour + text (`StatusBadge`); forms pair `Label`/`id`; `role="status"` on loaders; `aria-pressed` on like/contrast toggles; `aria-expanded/controls` on the a11y bar; native `<select>` everywhere (`NativeSelect`).
- Noted gaps: the skip link and chat disclaimer are English-only; `/climate` numbers ignore site language; map interactions (Leaflet/MapLibre) have no keyboard equivalent for selecting markers beyond the list; `color-scheme: only light` prevents OS dark mode.

**Absent:** dark mode, dyslexia/line-spacing controls, text-to-speech, keyboard shortcuts, an accessibility statement page, Nepali skip-link text.

## 11. Monetisation surfaces

- Ad slots: none in `src/` (`grep -ri "advert\|sponsor\|विज्ञापन" src` → no UI matches). Two labelled slots ("विज्ञापन / Sponsored") with an admin-only AD item are decided but unbuilt (`docs/NEWS-PORTAL-DECISIONS.md` #11, build order step 6); an ad-manager role is deferred (#12).
- Donation CTAs: all point off-site to the government PMDRF gateway (`pmdrf.nchl.com.np`) and the PMO appeal page — emergency bar button, home blue band link to `donate.gov.np`, `PublicNotice` on home and `/info` with QR (`home.tsx:602-642`, `info-help.tsx:112-147`). The site states it never handles money (`privacy.tsx` §12, `GOVERNANCE.md`). Project pages show committee bank/eSewa/Khalti details for direct payment.
- Sponsor mentions: "Powered by OnlyUtils" in footer and inside the chat widget (`site-footer.tsx:68-79`, `chat-widget.ts:188`). No other sponsor, grant or partner logos.

**Absent:** ad slots, ad labelling, paywall/membership, tip jar for the site itself, sponsored-content disclosure policy, affiliate links.

## 12. Known gaps the repo admits (public-site relevant)

From `docs/TODO.md`:
- Condolence messages on local updates — deferred 2026-10-14; when built: moderator-approved only, family-removal route, written policy first.
- No notification to a beneficiary when an org takes their request (status page only).

From `docs/NEWS-PORTAL-DECISIONS.md` (all unbuilt): local updates content type, `/local/<municipality>` page and picker, "Now" strip and home "Your area", reporter role and public profile, language chip per post, post-moderation labels, flags auto-hide, two ad slots, AI writer spec, ad-manager role, DoIB legal opinion before using the word "news".

From `docs/SEO-ACTION-PLAN.md`: sitemap never submitted (owner); `www` redirect (live check: still 200); crawlable text for `/flood-impact` (2.1); query-matching titles/H1s (2.2); Nepali as its own URL + `hreflang` (2.5); external links (2.6); IndexNow (2.7); CWV/Lighthouse once traffic exists (3.3). Open questions include whether `/ledger` and `/audit` should rank.

From `docs/CONTRIBUTOR-TODO.md`: romanized-Nepali ↔ Devanagari transliteration for person search (cross-script searches currently return nothing); beneficiary de-duplication; SMS intake deferred; automated matching is an explicit non-goal.

From `docs/GOVERNANCE.md` header: "Nepali translation — this document is English-only for now".

From code comments: `src/lib/helplines.ts:1-6` "Fire 101 … lacked a reachable primary source at verification time — recheck before production"; `public/llms.txt` still describes a single-flood dashboard; `src/data/relief-centers.json` last verified 2026-09-08; NDRRMA snapshot 2026-08-29.

`OWNER-TODO.md` referenced in memory notes is not present in this checkout (`find . -iname "OWNER-TODO*"` → none outside node_modules).

**Absent from the repo's own lists:** RSS/feeds, newsletter, push, comments, Viber share, BS dates, author pages, corrections policy — none of these appear as tracked TODOs; they are simply not mentioned.

---

## Summary

To a first-time visitor verifiednepal.com reads as a bilingual, mobile-first **disaster-response and mutual-aid utility**, not a news site: the header tagline says "Independent disaster information and mutual aid", a crimson emergency strip with hotline numbers sits above every page, the home page leads with five task cards (find a person, report/poster a missing person, get help, give help) and a drop-off-goods CTA, and the only "latest" content is a block of official NDRRMA counts and three OPMCM government notices linked off-site. Reading content exists in the code — tagged, bylined, sourced articles with Article JSON-LD and WhatsApp/Facebook sharing, incident cards, a satellite flood explorer, a climate data page — but on production the article, story, incident and project lists are all empty today, so the visitor sees empty-state cards. There is no feed, section navigation, locality page, RSS, newsletter, comments, Viber share, BS dates or Nepali URLs; language is a persisted toggle on a single English-canonical URL. Trust signalling is strong on the data/aid side (source lines, live/snapshot badge, public ledger and audit log, "never handles money", a long bilingual privacy/terms page) and thin on the editorial side (operator is "a single private individual", no masthead, no editorial or corrections policy, no DoIB statement, governance docs unlinked). The planned "local updates" layer — the thing that would make it a locality news surface — is fully specified in `docs/NEWS-PORTAL-DECISIONS.md` and not yet started in `src/`.
