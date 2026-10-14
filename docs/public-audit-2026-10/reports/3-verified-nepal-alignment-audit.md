# Report 3 — How far Verified Nepal's public site is aligned with the ideal Nepali public-information portal

Date: 2026-10-14 (असोज २८, २०८३). Scope: the signed-out public surfaces of verifiednepal.com. `/desk`, `/org`, `/me` internals and admin tabs are excluded except where they change what a reader sees. Repo state: `main` at `80b04f2`. Live checks: `https://verifiednepal.com` and `https://api.prod.verifiednepal.com`, 2026-10-14 morning NPT.

Primary source: `research_notes/Nepali online news audience/verified_nepal_public_site_inventory.md` (the inventory). Audience and publisher facts come from the other six research notes in the same folder. The "ideal" per layer follows the layer list agreed for this audit (Report 2 had not been written when this report was drafted, so layer definitions are stated inline). The council's position is taken from `council-verdict.md`; the owner's decisions from `docs/NEWS-PORTAL-DECISIONS.md` (2026-10-14).

Reports 1 and 2 did not exist in `reports/` at drafting time; persona names follow the brief.

---

## 1. Executive summary

Verified Nepal is a well-built bilingual, mobile-first **disaster-response and mutual-aid utility** whose trust skeleton (hotlines on every page, mandatory `Source:` lines, Live/Snapshot badge, public masked ledger, audit log and 3W export, "never handles money", a 23-section bilingual privacy page, an accessibility bar) is better than what the research found on any mainstream Nepali portal. It is **not yet** a public-information portal in the sense the research describes, for three reasons that compound. First, supply is zero: on 2026-10-14 the production API returns `{"items":[]}` for dispatches (articles), stories, projects, centres, incidents **and the ledger**, and the audit log is empty for August, September and October 2026; every reading and transparency surface renders an empty state. Second, although the NDRRMA counters are live (7,514 rescued and 4,898 records when checked on 2026-10-14) and the OPMCM block includes items dated 13 and 14 October, the home page also carries hard-wired August flood copy and a relief-location list bundled with a global `last_verified` date of 2026-09-08. The counters differ from the bundled snapshot (6,633 rescued and 2,189 records), so the stale snapshot does not describe those live figures. Third, the site is built as a destination for English-default readers of articles, whereas the Nepali audience discovers on Facebook, verifies on radio/TV, reads in Nepali with Bikram Sambat dates, shares on WhatsApp/Viber, and asks a local question ("does my palika have X?") rather than browsing a feed. None of the three is a design-system or code-quality problem; the code splits routes lazily, enforces EN/NE key parity and ships real 404s. They are positioning, freshness and distribution problems, and they are cheap to start fixing.

| # | Layer | Alignment | One-line reason |
|---|---|---|---|
| 1 | Home / "Now" surface | **Not aligned** | Task hub hard-wired to one August flood; no dated "latest" at all; "Live" label over a six-week-old snapshot |
| 2 | Item model | **Partly** | Articles have byline, place, sources, tags; no `happenedAt`, locality, language chip; article-shaped not item-shaped; zero published |
| 3 | Verification and moderation display | **Partly** | Badges exist and say what they mean in code, but "Verified" is used in five senses and articles carry no checked-label |
| 4 | Language, script and input | **Partly** | Full EN/NE key parity and `<html lang>`; but English default, English-only raw HTML/OG, no Nepali URL, cross-script search returns nothing |
| 5 | Dates, numbers, time | **Not aligned** | Devanagari digits yes; Gregorian only, absolute only, no BS, no relative time |
| 6 | Performance and data cost | **Partly** | Good code-splitting and offline shell; 229 KB entry JS, 0.5–0.9 MB Google Fonts, SW precaches 124 files incl. 1.5 MB JSON on first visit |
| 7 | Distribution | **Not aligned** | No RSS, no Viber, no owned Facebook page, no `article:published_time`, www not redirected, only home page indexed |
| 8 | Trust and transparency | **Partly** | Strong provenance on data; operator is "a single private individual", no masthead, no corrections policy, GOVERNANCE unlinked |
| 9 | Disaster-specific surfaces | **Partly** | Best-in-class hotlines, find-person, poster, drop centres, flood explorer; single-flood hard-wiring, stale centres, search contradiction |
| 10 | Quiet-months content | **Absent** | Nothing answers "why open this in Falgun"; `/articles` is empty and climate-framed |
| 11 | Governance, legal and monetisation | **Partly** | No ads, no money handling, privacy page; no DoIB statement, no corrections log, no public moderation rules, comments wisely absent |
| 12 | Accessibility and inclusion | **Aligned** (with gaps) | a11y bar, 44 px targets, focus rings, reduced motion, native selects; English skip link, no TTS/audio, Madhesh languages unaddressed |

---

## 2. Scorecard by layer

### 2.1 Home / "Now" surface

**Ideal requirement.** The first screen answers "what is confirmed right now, and what does it mean where I live?": Nepali by default, today's BS date, three to five short dated and sourced items, the hotline bar, one tap to share. The research's praised model is Routine of Nepal Banda (short, verified-before-posting, 6–7 lines) checked at the 6–11 pm peak (audience note Q7; traction note KQ3).

**What Verified Nepal does today.** `/` is a task hub (`src/pages/home.tsx:51-224`): hero eyebrow "Disaster response across Nepal", h1 "Community-verified disaster response for Nepal", lead "verifiedNepal is a community-verified disaster response coordination platform for Nepal. It is designed to make response information easy to scan while keeping individual records behind an explicit name search." (`src/i18n/shell.ts:11`, Nepali at `:109`: "नेपालका लागि समुदायबाट प्रमाणित विपद् प्रतिक्रिया"). Then five action cards, a blue band "Drop off flood relief goods" with a pulsing live dot and "16 relief centers" from bundled JSON (`:82-125`), a "Satellite view · Trishuli flash flood" CTA, the `SituationBand` of four NDRRMA counters with "Source: NDRRMA — Government of Nepal / Updated `<datetime>`", a district relief map (Leaflet), "Latest official update" (three OPMCM items linked off-site, green "Verified" badge, `:440-466`), a stories strip that renders nothing when empty (`:380`, the prod state), hotlines, PMDRF notice, chat CTA. At the 2026-10-14 check, the live NDRRMA counters were 7,514 rescued and 4,898 records, and the OPMCM block included items dated 13 and 14 October; these live values differ from the bundled 2026-08-29 snapshot (6,633 and 2,189). The stale parts are the hard-wired August flood copy and the relief-location list, whose 16 entries share a `last_verified` date of 2026-09-08. The status bar read "Live · updated 08:23" during the check, although the live counters and OPMCM items were available. The `edition.ts` dateline helper exists but is unused on `/`.

**Gap.** No dated "Now" strip, no BS dateline, no disaster switcher (the multi-disaster model in `src/lib/incidents.ts` drives `/projects`, `/coverage`, `/get-help` but not `/`), English default, and a hero paragraph written for a product reviewer rather than a shopkeeper. The `NEWS-PORTAL-DECISIONS.md` "Now" strip and "Your area" block are decided but unbuilt.

**Severity for the Nepali reader: High.** The site competes for the verification role; a stale page labelled "Live" is the opposite of the provenance-and-timestamp trust marker the disaster note (KQ4) identifies as what actually persuades.

**Evidence.** `home-360x740.png`, `home-1280x800.png`; inventory §2; `src/lib/live.ts:130-160`; `public/data/meta.json`.

### 2.2 Item model

**Ideal requirement.** The unit of content is a short item with place (down to ward), `happenedAt`, source link, language, author/role, and status; permanent URL so a Facebook post or FM host can cite it (council verdict, "Nepali-first, dated, sourced, short, shareable").

**What Verified Nepal does today.** Articles (`DISPATCH`) carry `title`/`body` as string or `{en, ne}`, `author.displayName` and `author.place`, up to three of seven fixed tags (climate, mountains, floods, landslides, glaciers, community, story; `src/lib/api.ts:1598`), `publishedAt`, a cover with **required** `source`, and body blocks where every media block requires a `source` (`src/articles/types.ts:9-17`; rendered `src/articles/render.tsx:17-26` as "Source: …", visible in `article-dev-360x740.png`). Detail pages have real 404s (`functions/articles/[id].ts:20`) and `Article` JSON-LD. Stories are photo/video plus caption, no timestamp, no detail page, home strip only (inventory §3b). Incidents have `startedAt`, districts, optional source attribution and a PNG share card (`src/pages/incidents.tsx:21-105`).

**Gap.** No `kind`, `locality`, `happenedAt`, `expiresAt`, `sourceUrls[]` or language chip (all specified in `NEWS-PORTAL-DECISIONS.md` build-order step 1, none in `src/lib/api.ts`). The seven tags are a climate-magazine taxonomy, and `/articles` describes itself as "Moderated community writing on mountains and climate — editorial, not a forum." (Nepali: "हिमाल र जलवायुबारे सम्पादित सामुदायिक लेखन — फोरम होइन।"). `inLanguage` is hard-coded `"en"` in the JSON-LD. Zero items published on prod.

**Severity: High.** The pain-points note (KQ3) names "almost no local (palika) content" as a structural complaint; the article model has no place field finer than a free-text author place.

**Evidence.** inventory §3a–§3d; `src/lib/api.ts:1609-1634`; `src/pages/dispatches.tsx:140-180`; live `GET /dispatches → {"items":[]}`.

### 2.3 Verification and moderation display

**Ideal requirement.** One word for "from an official source", one word for "we checked it", shown on every item with a dated provenance line; a public description of how checking works; a corrections notice when something changes (PCN 2083; disaster note KQ4).

**What Verified Nepal does today.** Each badge is honest in isolation: the green "Verified" on OPMCM items means "official source" (`home.tsx:490`); "Verified records" is NDRRMA's own count; project committees show "Verified"/"Not verified" after a moderator phone call (`project-detail.tsx:131-132`); "Verified incidents" are admin-approved reports; organisations have trust tiers. The reader-facing explanation lives on `/how-to` ("The one rule: verification comes before visibility", `src/i18n/how-to.ts:26`). Articles themselves show no checked-label; the only signal is the list lead "Moderated community writing…".

**Gap.** Five senses of one word (inventory §8). No per-item "how this was checked" line, no corrections or edit-history line in the UI (only `dateModified` in JSON-LD), no visible link to `docs/MODERATION-GUIDELINES.md`. The owner has since decided pre-moderation with "Checked" semantics for local updates; nothing public reflects it yet.

**Severity: High.** With ~8% trust in online portals and 67% weekly misinformation exposure (audience note Q5), the brand's single promise must be legible on every item.

**Evidence.** inventory §8; `docs/DESIGN-GUIDELINES.md` §1.3.

### 2.4 Language, script and input

**Ideal requirement.** Nepali first for a 44.9%-Nepali-mother-tongue, 76% literate audience (women 69%); Roman-Nepali input accepted and normalised; language reflected in URL/metadata so shares and search engines see Nepali (UI/UX note §3; audience note Q3).

**What Verified Nepal does today.** 27 i18n files with enforced key parity (e.g. `src/i18n/index.ts` 655/655), `<html lang>` mirrored to the toggle (`src/App.tsx:181-197`), the header toggle shows the other language's name ("नेपाली"/"English"). Devanagari digits via `Intl.NumberFormat('ne-NP')`. Person search folds diacritics and accepts Devanagari or Latin (`find-person.tsx:21-93`).

**Gap.** Default language is `en` (`localStorage` default); pre-hydration HTML, server-side titles, descriptions and OG are English-only (`src/lib/og-meta.ts:97-210`); no `/ne/`, `?lang=` or `hreflang`; no Nepali language chip per item; cross-script search returns nothing ("ram bahadur" in Roman does not match a Devanagari record; `docs/CONTRIBUTOR-TODO.md` §2); GOVERNANCE and the five PDF guides are English only; chat widget greeting English only. Nothing addresses Maithili/Bhojpuri/Tharu readers or Madhesh (20% online-news use vs 70% Gandaki).

**Severity: High.** A Gulf worker typing a relative's name in Roman letters on the one page he needs gets zero results.

**Evidence.** inventory §4, §9; `src/App.tsx:181-197`; `index.html` `<html lang="en">`.

### 2.5 Dates, numbers, time

**Ideal requirement.** BS date in Devanagari digits in the masthead ("बुधबार, असोज २८, २०८३"), relative time on teasers ("११ घण्टा अगाडि"), Gregorian in machine metadata, lakh/crore grouping (UI/UX note §2).

**What Verified Nepal does today.** `formatDateTime` is a 42-line `Intl.DateTimeFormat('en-GB'|'ne-NP', …, timeZone:'Asia/Kathmandu') + " NPT"` (`src/lib/format-date.ts:16-28`). EN renders "06 Sept 2026, 18:29 NPT"; NE renders Devanagari digits on a Gregorian calendar ("२०२६ अगस्ट ३०, ०१:१७ NPT"). `formatNumber` yields "६,६३३". `<time dateTime>` is used on article lists.

**Gap.** No Bikram Sambat anywhere (`grep -r "Bikram\|BS " src` → none; the only BS string is inside a data title, "(10 Bhadra 2083)"); no relative time; "NPT" untranslated; `/climate` numbers use the browser locale rather than the site language (`climate.tsx:24-27`).

**Severity: Medium.** It does not block use, but a Nepali page with "२०२६ अगस्ट" reads as a translated English site, and every Nepali portal in the research leads with BS.

**Evidence.** inventory §3a, §4; `src/lib/format-date.ts`.

### 2.6 Performance and data cost

**Ideal requirement.** First paint under a few hundred KB on a 360×800 Android over 4G; one or two Devanagari weights self-hosted (38–62 KB each); nothing heavy downloaded speculatively (UI/UX note §1, §4; pain-points KQ2 "speed").

**What Verified Nepal does today.** Vite + React 18, every route except `/` lazy (`src/App.tsx:31-63`); MapLibre loaded only on `/flood-impact`; images lazy on lists; no third-party analytics; chat widget deferred and skipped on `saveData`/2G (`chat-widget.ts:261-278`); offline shell with an outbox for need submissions. Measured: HTML 4.5 KB, entry JS 229 KB brotli on every page, CSS 12 KB, Leaflet ~43 KB gz plus Esri raster tiles on home.

**Gap.** Google Fonts: Noto Sans and Noto Sans Devanagari at four weights each, up to ~0.5–0.9 MB on a Nepali page, not self-hosted, not precached (`index.html:28-34`). Service worker precaches 124 entries on first visit, including the 1.5 MB `rescued-persons.json` and climate geo/time-series (`vite.config.ts:53` glob `**/*.{js,css,html,svg,png,woff2,json}`). Hashed assets cached only 4 h, not immutable. No `srcset`/image variants (`docs/onlyutils-media-variants-requirement.md`). No Lighthouse/CWV data exists.

**Severity: Medium.** Data is cheap by volume (1.1 GB/Rs 50) so cost bites less than latency; but a multi-MB background download on first visit, on a 4 GB-RAM phone, is exactly the "slow" complaint in the Onlinekhabar app threads.

**Evidence.** inventory §5; `dist/` chunk table; live `sw.js`.

### 2.7 Distribution

**Ideal requirement.** The site wins as the citation target, not the destination: share cards with the badge baked in, Viber and WhatsApp buttons, an owned Facebook page posting at 6–10 pm, RSS for aggregators and fact-checkers, `article:published_time`/`NewsArticle` for Google, `hreflang` for the Nepali edition (traction note KQ1–KQ2; council "Blind spots").

**What Verified Nepal does today.** Per-route OG images (`src/lib/og-meta.ts:97-210`), `Article` JSON-LD, WhatsApp + Facebook + Copy + Print on articles (`dispatch-detail.tsx:242-268`), PNG share cards on incidents, climate, our-message and drop centres (`src/components/share-button.tsx`), Web Share for posters with four download formats, canonicals on the apex, real 404s, a sitemap Function with `lastmod`, `robots.txt`, `llms.txt`.

**Gap.** `/feed.xml` and `/rss.xml` return the SPA shell with HTTP 200 (re-checked 2026-10-14). No Viber, Telegram, X or email share. No `article:published_time`, `article:author`, `NewsArticle`, breadcrumbs, `hreflang`. `Organization.sameAs` lists only GitHub; footer links are GitHub, OnlyUtils and `mailto:verifiednepal01@gmail.com`; no Facebook page, YouTube or Viber community. `www.verifiednepal.com` serves 200 without redirecting (re-checked). `docs/SEO-ACTION-PLAN.md` records only the home page indexed and the sitemap never submitted. `llms.txt` still describes a single-flood dashboard.

**Severity: High.** Facebook reaches ~90% of Nepali internet users and 69–83% of big-portal traffic is direct/dark social; a site with no feed, no page and no Viber button is invisible on the surfaces where Nepalis actually find news.

**Evidence.** inventory §7; `index.html:36-61`; `functions/sitemap.xml.ts`.

### 2.8 Trust and transparency

**Ideal requirement.** Provenance on every claim (original source, timestamp, bulletin number), a named responsible party or legal shell, public moderation rules, a corrections log, registration details where applicable (disaster note KQ4; publisher note KQ1; UI/UX note §8).

**What Verified Nepal does today.** This is the site's strongest layer on the data side: `SituationBand` "Source: NDRRMA — Government of Nepal · Updated `<time>`" plus "Figures may change as official records are updated."; `LiveStatusBadge` tooltip "Live data is not available yet; showing the bundled snapshot, which may be stale."; `/info` note "The timestamp shown on each page is the mirror sync time, not a claim that the source updated at that moment."; drop-centres disclaimer "Independently compiled from Nepali government notices, news reporting and a social-media-organized citizen relief effort. Not an official government source…" (`drop-centers.tsx:132`); climate page with Zenodo DOI and licence; mandatory `Source:` on every article media block; public masked `/ledger` with CSV "for journalists and researchers", `/audit` monthly moderator log, `/coverage` with CSV/GeoJSON 3W export; "VerifiedNepal never handles donations" plus the police fake-QR warning; a 23-section EN/NE `/privacy`.

**Gap.** `/privacy` §1: "verifiedNepal is a non-commercial, volunteer project maintained by a single private individual (the 'Maintainer')." No masthead, editor, address, phone or legal entity. `docs/GOVERNANCE.md` and `docs/MODERATION-GUIDELINES.md` are not linked or rendered anywhere public (`grep -r` → none outside the Desk). No corrections policy or log, no editorial policy page, no report button on articles/incidents, no DoIB/Press Council statement. And, as of 2026-10-14, the transparency surfaces are themselves empty on prod: `GET /ledger → {"items":[]}`; `GET /audit?month=2026-08|09|10 → {"items":[]}`; `/coverage` requires an incident id and `/incidents` returns none. The ledger is a real asset in code, not yet in public evidence.

**Severity: High.** "Verified by whom?" is the Outsider's question and the reader's; a Facebook page at least has a name and a comment thread.

**Evidence.** inventory §8; `src/pages/privacy.tsx:12-16`; live API checks above.

### 2.9 Disaster-specific surfaces

**Ideal requirement.** Hotlines always visible; missing-person search with consent and trauma safeguards (no faces of the dead, verified photos, pull resolved listings); relief-point directory with last-verified dates; needs → offers → delivery tracked by ward; multi-disaster from day one; switch disasters without a redeploy (disaster note KQ2–KQ3, KQ8; publisher note KQ2).

**What Verified Nepal does today.** Emergency bar on every page ("In danger? 1234 · Police 100 · Ambulance 102"), full hotline tiles on `/`, `/info` and `/missing`; `/search` over NDRRMA rescued and missing lists, deliberately `noindex` and robots-disallowed for privacy; `/missing` seven-step family guide; `/poster` builder with tip form; `/drop-centers` with map, filters, directions and "Last verified: 2026-09-08"; `/get-help` and `/give-help` with reference-code status; `/coverage` ward table; `/drones` tasking board; `/flood-impact` MapLibre before/after corridor drive with `?loc=` deep links and imagery credit. This is more than any Nepali portal or the state offered in August (disaster note KQ2: "no centralised missing-persons database at the outset").

**Gap.** Home is hard-wired to one flood (NDRRMA rescues API, bundled centres event string, flood CTA). Drop-centre API items are empty on prod, so only the 16 bundled centres from 2026-09-08 show. `/search` lead says "verifiedNepal shows aggregate rescue and missing-person status only. To search for a specific person by name, use the official OPMCM lost & found portal…" directly above a "Search by name" box (`find-person-360x740.png`). Cross-script search returns nothing. `src/lib/helplines.ts:1-6` admits Fire 101 "lacked a reachable primary source at verification time".

**Severity: High during an event, Medium now.** These are the pages a disaster-affected reader opens; a contradiction on the search page and five-week-old centres cost trust at exactly the moment it matters.

**Evidence.** inventory §1, §3f, §9; `src/pages/find-person.tsx`; `src/data/relief-centers.json`.

### 2.10 Quiet-months content

**Ideal requirement.** A reason to open the site in Falgun: evergreen explainers (how relief works, how to read an NDRRMA bulletin, how to use the ledger), the standing status of past disasters' recovery, and a daily or weekly cadence that does not depend on a flood (council "Blind spots"; Review 4).

**What Verified Nepal does today.** `/how-to` (long illustrated guide), `/missing` guide, `/info`, `/climate` (static dataset, "Nepal didn't heat the planet. Nepal pays for it." / "पृथ्वी नेपालले तताएको होइन। मूल्य भने नेपालले चुकाइरहेको छ।"), `/our-message` (English word cloud of pre-set slogans sent to a chosen country), `/flood-impact` (the only unique, non-empty reading surface).

**Gap.** Nothing dated, nothing recurring. `/articles` is empty and framed as a climate magazine; `/our-message` has no explanation of why it is on a disaster site and its word cloud is English even in Nepali mode; only ~49% of households had heard of "climate change" as a concept (2016), so the loss-and-damage framing is an elite register (disaster note KQ6). No "what happened to Rasuwa since" page, no recovery tracker, no archive by date.

**Severity: Medium.** Not fatal today, but it is the difference between a bookmark and a one-time visit; RONB's moat is a daily habit.

**Evidence.** inventory §3e–§3f; `our-message-360x740.png`; `src/i18n/climate.ts:7`.

### 2.11 Governance, legal and monetisation

**Ideal requirement.** A clear legal posture (registered outlet with editor and staff, or explicitly non-journalistic mutual aid), public moderation rules, corrections, no comments without moderator capacity (2017 directive makes the operator liable), labelled ads only after registration, no money handled (publisher note KQ1, KQ6; traction note KQ5, KQ8).

**What Verified Nepal does today.** No ad slots (`grep -ri "advert\|sponsor\|विज्ञापन" src` → no UI matches); no comments anywhere; all donate CTAs go off-site to the PMDRF gateway; project pages show committee bank/eSewa/Khalti details for direct payment; "Powered by OnlyUtils" is the only sponsor credit; `/privacy` names governing law (Nepal, Individual Privacy Act 2075). The owner has decided (2026-10-14) that VerifiedNepal itself will register with DoIB, that local updates will be pre-moderated, and that ad slots are build-order step 4.

**Gap.** No DoIB or Press Council statement on the site, no registration number, no editor name (the 2025 rules require these to be displayed once registered). No corrections policy or log, which PCN 2083 and the DoIB display rules both expect. GOVERNANCE and MODERATION-GUIDELINES unlinked. Note that the inventory (§3c, §8) still describes post-moderation labels and "a Nepali media lawyer's opinion"; both are superseded by the decisions doc and should not be relied on.

**Severity: Medium today, High once anything called "news" or any ad ships.** The current posture (pre-moderated, non-commercial, "local updates", no comments, no money) is the defensible one until the entity exists.

**Evidence.** inventory §8, §11; `docs/NEWS-PORTAL-DECISIONS.md` "DoIB note"; publisher note KQ1.

### 2.12 Accessibility and inclusion

**Ideal requirement.** MoCIT 2021 directive (responsive, disability-friendly, Nepali Unicode + English), WCAG 2.2 AA as referenced in the 2026 DoIT audit, TalkBack-friendly markup now that Dina Nepali TTS exists, plain language and audio for low-literacy readers (UI/UX note §6).

**What Verified Nepal does today.** "Aa" accessibility bar with five font-size steps and high contrast, applied before first paint (`index.html:63-69`); `prefers-contrast` and `prefers-reduced-motion` honoured; `Button` default `min-h-11` (44 px), icon buttons 44×44, hotline tiles 96–128 px; focus-visible rings everywhere; one `h1` per route; `<main>` focused on route change; native `<select>`; status conveyed by colour plus text; AA-checked ink/secondary tokens; `alt=""` on decorative images.

**Gap.** Skip link is English only; chat disclaimer English only; mixed-language tokens ("OPMCM", "NPT") have no `lang`; map markers have no keyboard path beyond the list; `color-scheme: only light` blocks OS dark mode (a top app complaint, though the council says do not build it now); no accessibility statement page; nothing for non-Nepali mother tongues; no audio.

**Severity: Low** for what exists (it is ahead of the state's own portals), **Medium** for the inclusion gaps given women's literacy and Madhesh.

**Evidence.** inventory §6, §10; `src/components/accessibility-bar.tsx`; `src/components/ui/button.tsx:19-23`.

---

## 3. What is already right and should be protected

The research found each of these to be rare on Nepali portals. They are the parts of the site that should survive any pivot.

1. **Hotlines on every page**, compact on phones, full tiles on home, `/info` and `/missing` (`emergency-bar.tsx`, `src/lib/helplines.ts`).
2. **No ads, no login to read, no comments.** Ads are the single most-complained-about feature in r/Nepal; comments would make the operator liable under the 2017 directive.
3. **Mandatory `Source:` lines** on every article cover and media block, enforced in the type (`src/articles/types.ts:9-17`), not by policy.
4. **Honest provenance on data**: the Live/Snapshot badge and tooltip, the `/info` mirror-sync note, the drop-centres disclaimer, the Zenodo DOI and licence on `/climate`.
5. **"VerifiedNepal never handles donations"** plus the police fake-QR warning; donate CTAs only to NRB/OPMCM-listed channels, which is exactly the revealed donor behaviour in 2026 (disaster note KQ7).
6. **Public, masked `/ledger`, `/audit` and `/coverage` with CSV/GeoJSON 3W export.** Nobody else in Nepal publishes ward-level needs → delivery; it cannot be forged with a logo.
7. **Real 404s, per-route canonicals on the apex, `Article` JSON-LD, sitemap with `lastmod`, `robots.txt` that protects `/search` and `/data/`.**
8. **`/search` kept `noindex` and robots-disallowed** on purpose: individual records stay behind an explicit name search, consistent with PCN 2083 and consent concerns.
9. **EN/NE key parity enforced by types** across 27 i18n files; `<html lang>` switches; Devanagari digits; tracked-uppercase disabled for Nepali.
10. **Accessibility bar, 44 px targets, focus rings, reduced motion, native selects, one h1 per route**, applied before first paint.
11. **A 23-section bilingual privacy and terms page** naming retention periods, removal rights, children and governing law.
12. **`/flood-impact`**: a unique, non-empty, credited reading surface with deep links and Web Share.
13. **Performance discipline that exists**: lazy routes, MapLibre only where needed, no third-party analytics, chat widget skipped on save-data/2G, offline shell and outbox.
14. **A hand-rolled design system that is boring in the right way**: crimson/blue flag-derived palette (a documented Nepali trust cue), one font family, no autoplay, no hover gimmicks.

---

## 4. The reader's-eye walkthrough (360 px Android, first visit)

She opens the link a cousin forwarded. The header reads "Verified Nepal" with a button "नेपाली" (why is it not already Nepali?), a blue bar "Live · updated 08:23", and a crimson strip "In danger? 1234 · Police 100 · Ambulance 102" (`home-360x740.png`). Good: the numbers are the first useful thing. Below, a small blue eyebrow "DISASTER RESPONSE ACROSS NEPAL" and a three-line headline "Community-verified disaster response for Nepal", then a paragraph about "individual records behind an explicit name search". She does not know what an individual record is. A blue card "Find someone — Search official rescued and missing-person records" fills the bottom of the screen; a round chat bubble overlaps its corner.

She taps नेपाली. The chrome changes; the paragraph is now "व्यक्तिगत अभिलेखलाई स्पष्ट नाम खोजी पछाडि राख्छ।", which is the same sentence. She scrolls: a blue band about dropping off flood relief goods with "16 relief centers", a satellite-view card about the Trishuli flood, four big numbers "Source: NDRRMA — Government of Nepal", a map she has to tap to move, three official notices with green "Verified" badges that open a government site. It is 14 October; everything is about 26 August. Nothing says what is happening today or in her district.

She opens the menu: thirteen items. "Articles" shows "ARTICLES / Articles / Moderated community writing on mountains and climate — editorial, not a forum.", a solid blue "Write an article" button, eight tag chips, and a dashed empty box "No articles match this filter. Try another tag or check back later." (`articles-360x740.png`, `articles-1280x800.png`). She did not want to write one. She guesses `/stories` from the "Stories from the ground" heading she saw earlier: "Page not found. The page you requested does not exist or may have moved." (`stories-404-360x740.png`).

Back to the task that brought her. "Find someone": the page says "verifiedNepal shows aggregate rescue and missing-person status only. To search for a specific person by name, use the official OPMCM lost & found portal…", and then shows "Search by name — Enter a name in English or Nepali" (`find-person-360x740.png`). She types "ram bahadur" in Roman letters, the only way she types. Nothing. "Drop centres" shows the right header, a clear "Call before travelling" line, "Last verified: 2026-09-08", two filters and a Leaflet map with a verifiednepal.com watermark (`drop-centers-360x740.png`). Five weeks old; she would phone first, as the page itself suggests. "Our message" is an English word cloud ("Don't Melt Us", "Justice, Not Charity") under "What Nepal is telling the world", even in Nepali mode (`our-message-360x740.png`). She does not know why it is here.

What she would say afterwards: the numbers were there, it was not full of ads, it did not ask her to log in, and it looked serious; but she could not tell who runs it, it was about August, and the one search she needed did not understand how she spells. She goes back to Facebook. The `/flood-impact` page, which she never reached, is the one thing on the site she would have shown a friend (`flood-impact-360x740.png`: a credited satellite image with the eyebrow "26 AUGUST 2026 · LANGTANG LIRUNG GLACIAL LAKE OUTBURST").

---

## 5. Persona-by-persona alignment

| Persona | Top need (from research) | Met? | Where it is met or fails |
|---|---|---|---|
| Consumer (general Nepali reader) | Short, Nepali, dated, sourced items she can check at 6–11 pm | **Not met** | No dated items anywhere; English default; `/articles` empty; no BS date |
| Diaspora (Gulf/Malaysia, Roman-Nepali typist, Nepal-midnight evening) | Find a relative; a shareable "is this true?" card; English summary | **Partly** | `/search` exists and is private; cross-script search fails; share cards exist for incidents/climate but not for anything dated; no Viber |
| Disaster-affected household | Hotlines, nearest open relief point, register a need, status by code | **Mostly met** | Emergency bar; `/get-help` + `/status/:ref`; `/drop-centers` (but 16 bundled centres, last verified 2026-09-08); no SMS intake (deferred) |
| Volunteer / donor | Where is help needed, proof it arrived, safe channel to give | **Partly** | `/give-help`, `/ledger`, `/coverage` exist and PMDRF-only donation guidance is right; ledger/coverage empty on prod so no proof is visible yet |
| NGO / local government | 3W data by ward; a record of delivery vs non-delivery | **Partly** | `/coverage` CSV/GeoJSON export is exactly the 3W format; no data in it; no palika author role; ward-chair adoption is a hypothesis, not evidence |
| Publisher / maintainer (the owner) | A pipeline that produces items without the owner writing them | **Not met** | Articles produced zero items at peak demand; local-updates pipeline decided but unbuilt |
| Journalist / correspondent | Citable permalink, source link, corrections log, CSV | **Partly** | Real 404s, JSON-LD, ledger CSV "for journalists"; no RSS, no `published_time`, no corrections log, no embed |
| Moderator / fact-checker | Queue with inline sources, rule card, PCN 2083 checklist, public audit trail | **Partly** (public side) | `/audit` is public and masked (empty on prod); moderation rules not public; PCN checklist not in the rule card yet |
| Regulator (DoIB / PCN) | Registration number, editor name, address, privacy policy, corrections, humane-reporting compliance | **Partly** | Privacy policy and no-money principle present; no registration, editor, address or corrections; "local updates" wording keeps the site outside "online media" for now |

---

## 6. The council's recommended sequence, and where it differs from the owner's build order

The council (five advisors, five peer reviews, chairman's synthesis in `council-verdict.md`) agreed on seven points: supply is zero and the empty room falsifies the brand; the home page is frozen on August; the defensible asset is the aid/transparency stack, not prose; "Verified" must collapse to one meaning; do not build the full local-updates spec first; do not build comments, push, dark mode, AI writer, condolences or the ad-manager role now; the ideal item is Nepali-first, dated, sourced, short, shareable. It clashed on magazine-vs-ledger (resolved toward "the unit is the item, articles survive as evergreen explainers"), stop-vs-ship (resolved toward "ship the honest minimum"), and DoIB posture (resolved: the owner's registration path is lawful if the entity and staffing exist; until then the pre-moderated non-commercial posture is the defence, so ads must wait).

Its recommendation: Verified Nepal's public side should become **"Nepal's checked record"**: a Nepali-first status board of short, dated, located, sourced items, backed by the ward ledger, distributed as cards into Facebook/WhatsApp/Viber, with local updates as the pre-moderated human layer feeding the same strip. Not a magazine, not a portal.

**Sequence as the council stated it:**

- **Phase 0, honesty (this week, no new feature).** Un-hardwire `/` from the August flood; show every date as relative time plus BS; label the snapshot as a snapshot. Hide `/articles`, `/projects`, `/incidents` from nav while their API returns zero (keep routes; move "Write an article" behind sign-in). Remove the `/stories` link. Cut the hamburger to six: Now, Get help, Give help, Find someone, Drop centres, Ledger. Default to Nepali on first visit. Rewrite the hero in shopkeeper words; delete the "explicit name search" sentence; fix the `/search` contradiction. Two words only: "Official source / आधिकारिक स्रोत" for OPMCM/NDRRMA items, "Checked / जाँच गरिएको" for anything that passed moderation. Link GOVERNANCE and MODERATION-GUIDELINES; add a corrections line and PCN 2083 checklist to the Desk rule card. Drop `rescued-persons.json` from the SW precache; self-host two Devanagari weights.
- **Phase 1 = build-order step 1 plus its public face.** `kind: news` + validator + Desk queue as decided, **and** a home "Now" strip fed from four sources the site already has: OPMCM items, drop-centre verifications, ledger deliveries, published `kind: news` items. Every row: place, `happenedAt`, source link, relative time, EN/ने chip. Each row renders as a PNG share card via the existing `ShareButton` pipeline, with Viber added. Open an owned Facebook page and post the cards 6–10 pm daily. Promote `/flood-impact` and `/ledger` into the strip as standing entries.
- **Phase 2 = build-order step 2**, gated on one municipality holding ten published items. The picker is where Roman-Nepali input lands.
- **Phase 3 = step 3** (reporter role) as decided.
- **Step 4 (ads) waits for the DoIB certificate.** In parallel, starting now: confirm fees, editor and staffing rules with DoIB directly, and form the entity.
- **Keep:** hotlines, privacy page, no-money principle, `/ledger` `/coverage` `/audit`, `/flood-impact`. **Demote:** `/climate` and `/our-message` out of primary nav (owner to decide retire-or-keep explicitly). **Stop:** volunteer hours on climate-magazine articles; AI writer, condolences, ad manager, comments, push, dark mode, Nepali URLs/hreflang, SSR.
- **The one thing to do first:** replace the hard-wired August block on `/` with a dated, sourced "Now" strip fed from what the site already ingests, one row per item with place, source link and relative time.

**Where this differs from `NEWS-PORTAL-DECISIONS.md`, stated neutrally:**

| Topic | Owner's decisions doc | Council verdict | Nature of the difference |
|---|---|---|---|
| First thing to ship | Build order step 1: `kind: news` + Desk queue (data model and moderation first) | Phase 0 honesty fixes, then step 1 **plus** a public "Now" strip fed from existing data | Council front-loads a public, visible change and a de-staling pass; owner's order starts with the back end. Both end at step 1. |
| "Now" strip timing | Part of step 2 (with `/local/<municipality>`, picker, GSI) | Pulled forward into Phase 1, fed from OPMCM/centres/ledger before any reporter exists | Sequencing only; the owner's step 2 strip is scoped to local updates, the council's is scoped to all dated items |
| Step 2 trigger | All 753 local levels available day one; only localities with items are listed | Gate step 2 on one municipality holding ten published items | Owner's rule already avoids empty pages; council adds a go/no-go threshold before building the locality layer |
| Ads (step 4) | Two labelled slots, after reporter role | Only after the DoIB certificate is issued; entity formation starts now in parallel | Council adds a legal gate, not a different design |
| Articles / climate / our-message | Not addressed in the decisions doc | Hide empty surfaces from nav; demote climate and our-message; stop volunteer hours on climate articles; keep articles as evergreen explainers | New recommendation for the owner to accept or reject |
| Distribution (Facebook page, Viber, share cards) | Not addressed | Owned Facebook page with a daily 6–10 pm card; Viber share; cards from the strip | New recommendation |
| Deferred items (AI writer, condolences, ad manager) | Deferred to step 5 | Stop, plus also stop comments, push, dark mode, Nepali URLs/hreflang, SSR | Agreement on deferral; council widens the stop list |
| DoIB posture | VerifiedNepal registers; confirm fees/editor/renewal with DoIB directly | Same, with the added point that the 2025 rules need a company/firm with PAN, a named editor, three employees and bank-paid salaries, so registration is an entity and a payroll | Council sharpens the owner's own caveat; no disagreement on direction |

Nothing in the council's sequence requires reversing a settled owner decision. The two substantive asks are: do Phase 0 before step 1, and do not let step 4 run ahead of the certificate.

---

## 7. Quick wins

Effort estimates assume one developer who knows the codebase; "d" = working day. No code was written for this report.

| # | Change | Files touched | Effort | Gap closed |
|---|---|---|---|---|
| 1 | Replace "Live · updated HH:MM" with "Official data snapshot · `<date>`" whenever the live fetch falls back; add a BS/relative dateline to `/` using the unused `edition.ts` | `src/lib/live.ts`, `src/components/site-status-bar.tsx`, `src/pages/home.tsx`, `src/lib/edition.ts` | 0.5 d | 2.1, 2.5 |
| 2 | Hide `/articles`, `/projects`, `/incidents` from header/status-bar nav when their list is empty; drop the dead `/stories` heading link; move "Write an article" behind sign-in | `src/components/site-header.tsx:28-42`, `site-status-bar.tsx:22-31`, `src/pages/dispatches.tsx` | 0.5 d | 2.1, 2.10 |
| 3 | Cut the hamburger to six primary items, move the rest under "More" | `src/components/site-header.tsx` | 0.25 d | 2.1 |
| 4 | Default language to `ne` on first visit (keep persisted choice) | `src/App.tsx:181-197` | 0.1 d | 2.4 |
| 5 | Rewrite hero lead and `/search` lead; delete the "explicit name search" sentence; make the `/search` lead say what the box does | `src/i18n/shell.ts`, `src/i18n/index.ts`, `src/pages/find-person.tsx` | 0.25 d | 2.1, 2.9 |
| 6 | One vocabulary: "Official source / आधिकारिक स्रोत" vs "Checked / जाँच गरिएको"; apply to OPMCM badge, incidents lead, project badge | `src/i18n/*.ts`, `src/pages/home.tsx:490`, `project-detail.tsx:131` | 0.5 d | 2.3 |
| 7 | Relative time ("११ घण्टा अगाडि") helper and BS date in bylines; keep Gregorian in metadata | `src/lib/format-date.ts`, `dispatch-detail.tsx`, `dispatches.tsx`, `incidents.tsx` | 1 d | 2.5 |
| 8 | Self-host two Devanagari weights (400/600) and two Latin, drop the Google Fonts request | `index.html:28-34`, `src/styles.css:102-110`, `public/fonts/` | 1 d | 2.6 |
| 9 | Remove `rescued-persons.json` and climate geo files from the SW precache glob (runtime-cache them instead) | `vite.config.ts:53` | 0.25 d | 2.6 |
| 10 | Add Viber (`viber://forward?text=`) to the share rows; add `article:published_time`/`article:author` OG tags | `dispatch-detail.tsx:242-268`, `incidents.tsx`, `src/lib/og-meta.ts`, `functions/articles/[id].ts` | 0.5 d | 2.7 |
| 11 | `/feed.xml` Function cloned from the sitemap fetch loop | `functions/feed.xml.ts` (new), reuse `functions/sitemap.xml.ts:31` pattern | 0.5 d | 2.7 |
| 12 | Render GOVERNANCE and MODERATION-GUIDELINES as public routes; footer links; one-paragraph "how an item gets checked" on `/articles` | `src/App.tsx`, `src/components/site-footer.tsx`, new page(s) | 0.5 d | 2.8, 2.11 |
| 13 | www → apex Redirect Rule (infra repo, Terraform `-target` per memory note) and submit the sitemap in Search Console (owner) | `verified-nepal-infra` (not this repo) | 0.25 d + owner | 2.7 |
| 14 | `llms.txt` and `/info` copy un-hardwired from the August flood | `public/llms.txt`, `src/pages/info-help.tsx` | 0.25 d | 2.1, 2.8 |
| 15 | Add `Organization.sameAs` and footer link for an owned Facebook page once created | `index.html:36-61`, `site-footer.tsx` | 0.1 d + owner | 2.7 |
| 16 | Roman-Nepali → Devanagari transliteration for `/search` (table-driven, no library) | `src/pages/find-person.tsx`, new `src/lib/transliterate.ts` | 2 d | 2.4, 2.9 |
| 17 | Nepali skip link and chat greeting/disclaimer | `src/App.tsx:285-291`, `src/lib/chat-widget.ts:181,224` | 0.1 d | 2.12 |

Items 1–6, 9, 14 and 17 together are the council's Phase 0 and total roughly three working days. The "Now" strip (council's "one thing to do first") is not a quick win; it is build-order step 1's public face and is estimated at 2–3 days on top of the step-1 data model.

---

## 8. Risks, legal notes and evidence caveats

**DoIB 2025 rules.** Per the publisher note (KQ1), the November 2025 amendment to the Press and Publication Rules sets registration at Rs 5,000 plus Rs 2,500 per year, and requires operating as a company/firm with PAN, a named qualified editor, at least three staff with a written commitment to bank-paid salaries, display of the registration number, addresses, editor/journalist names and a privacy policy, and public corrections. The decisions doc itself says its sources were law-firm summaries and news reports, not the official text, and that fees, editor requirements and renewal must be confirmed with DoIB directly. Until the entity exists, the words "news" and "reporter" in public copy, and any ad slot, are the exposure. The current public naming ("local updates", "local correspondents") is the right interim.

**Operator liability for comments.** The 2017 Online Media Operation Directive makes the operator responsible for user content including comments (publisher note KQ6). The site has no comments; the council says keep it that way. Public flagging via the existing FLAGGED queue is the safe substitute.

**PCN "Humane and Responsible Disaster Reporting Guidelines 2083" (4 Sept 2026).** Verify deaths/missing with official sources; verify social-media material on source, location, time and context; no faces of the dead, grieving families or children; no gruesome thumbnails or autoplay; label AI imagery; seek consent; correct immediately with an explanation. The site's mandatory `Source:` line, `noindex` person search and no-autoplay policy already fit; a corrections line and an AI-image label are the missing pieces, and the Desk rule card should carry the checklist.

**Penal Code 2074 (ss. 295–296, privacy and photographs) and consent.** The research notes raise these in the context of publishing images of identifiable people and of the dead, and of missing-person listings. Keeping `/search` de-indexed, pulling resolved listings, and requiring consent for poster photos of minors (Child-Friendly Communication Directive 2073) are the controls. This report has not read the statute text; it relies on the research notes' reading.

**ETA s. 47.** Used repeatedly against journalists and online critics 2024–2026 (publisher note KQ1; traction note KQ8). It is the reason Review 5 warned against simply "putting a named person and phone in the footer": the fix for "verified by whom?" is a legal shell (the registered entity the owner has chosen) or syndication to a registered outlet, not a personal name on an unregistered site.

**The ledger's own exposure.** A public row that says Ward 3 was *not* reached names, by implication, a CDO or ward chair. PCN now reaches non-media accounts via the Cyber Bureau (72 takedown orders cited for Aug 2026). Record deliveries as facts with source and date; never editorialise absence; keep the 3W export as data, not commentary.

**Evidence caveats.**
- The ward-chair "public record proving relief had not arrived" hook rests on one Kathmandu Post report (18 Sept 2026) and the disaster note marks the tool idea as inference. Treat it as a hypothesis to test with one palika, not as demand evidence.
- The inventory did not count ledger, coverage or audit rows. This report checked them on 2026-10-14: `/ledger → {"items":[]}`; `/audit?month=2026-08|09|10 → {"items":[]}`; `/coverage` cannot render because it needs an incident id and `/incidents` is empty. Review 4's claim that these surfaces are as empty as `/articles` is therefore confirmed for prod, not just for centres. The code and the exports are real; the public evidence of them is not yet.
- The inventory's §3c and §8 predate the owner's 2026-10-14 decisions and still describe post-moderation labels and a lawyer's opinion; both are superseded.
- No Lighthouse/CWV run exists; performance figures are build-size and single-sample curl measurements.
- The `article-dev-*.png` screenshots are from `dev.verifiednepal.com` with seeded content; prod has no article page to capture.
- Audience percentages are national survey figures (NMS 2020/2022/2024, DataReportal 2026, CMR Nepal 2024); none measures Verified Nepal's own readers, of whom Search Console sees too few to report.
- Claims the council explicitly corrected are not repeated here: "100 outlets closing per year" (it was one year, all media); "The Record died" (hiatus, archive live); "a volunteer operation cannot legally be a news portal, full stop" (overstated); "spend the Rs 5,000" (registration is an entity and a payroll); "/search beats the state" (it searches NDRRMA's own lists).

---

## 9. Appendix

### 9.1 Inventory cross-reference: public routes and status on 2026-10-14

| Route | Purpose | Prod status | In nav? |
|---|---|---|---|
| `/` | Task hub + situation band | Live; content frozen on Aug 2026 flood | — |
| `/articles`, `/articles/:id` | Moderated articles | List empty (`{"items":[]}`); detail 404s correctly | Hamburger + status bar |
| `/stories` | (no route) | "Page not found", HTTP 200 | Heading only, no link target |
| `/incidents` | Admin-approved disasters | Empty | Hamburger |
| `/flood-impact` | Satellite before/after drive | Live, non-empty | Home CTA only |
| `/climate` | Static climate dataset | Live, non-empty | Hamburger + status bar |
| `/our-message` | Word cloud + send form | Live; English cloud | Hamburger + status bar |
| `/projects`, `/projects/:id`, `/register`, `/update` | Rebuild projects | Empty | Hamburger + status bar |
| `/drop-centers`, `/:id` | Relief drop-off points | 16 bundled (2026-09-08); API centres empty | Hamburger + status bar + emergency bar |
| `/coverage` | Ward coverage + 3W export | Cannot render (no incidents) | Home/footer only |
| `/ledger` | Masked aid ledger + CSV | Empty | Hamburger + status bar |
| `/audit` | Masked moderator log | Empty Aug–Oct 2026 | Footer only |
| `/drones` | Drone tasking board | Not checked for rows | Hamburger |
| `/search` | Person-name search | Live; `noindex`; cross-script fails | Hamburger |
| `/missing` | Family guide | Live | Footer/raw nav |
| `/poster`, `/poster/:id` | Poster builder/board | Live | Hamburger + status bar |
| `/get-help`, `/status/:ref` | Need form + status | Live | Hamburger |
| `/give-help` | Needs board + offers | Not checked for rows (`/needs` requires incident id) | Hamburger |
| `/report-incident` | Report a disaster | Live (Google sign-in) | Hamburger (via incidents) |
| `/register-organization` | Org sign-up | Live | Hamburger |
| `/donation/:ref` | Donation receipt lookup | Live | Deep link only |
| `/info` | Hotlines, about, data source | Live; single-flood copy | Hamburger |
| `/how-to` | Illustrated guide | Live; 4.9 MB images | Footer/raw nav |
| `/privacy` | Privacy & Terms EN/NE | Live | Footer |
| `/feed.xml`, `/rss.xml` | — | SPA shell, HTTP 200 | — |
| `www.` host | — | HTTP 200, no redirect | — |

### 9.2 References

Internal (paths relative to `/home/lxu/workspace/laxman/verifiednepal/`):

1. `docs/public-audit-2026-10/research_notes/Nepali online news audience/verified_nepal_public_site_inventory.md` — primary inventory, §1–§12, with `file:line` citations.
2. `docs/public-audit-2026-10/research_notes/Nepali online news audience/screenshots/*.png` — `home-360x740`, `home-1280x800`, `articles-360x740`, `articles-1280x800`, `stories-404-360x740`, `find-person-360x740`, `find-person-1280x800`, `drop-centers-360x740`, `our-message-360x740`, `flood-impact-360x740`, `article-dev-360x740` (dev host).
3. `docs/public-audit-2026-10/council-question.md`, `council-advisors.md`, `council-reviews.md`, `council-verdict.md` — council rounds and chairman's synthesis, including "Factual corrections to carry into the reports".
4. `docs/NEWS-PORTAL-DECISIONS.md` (2026-10-14) — owner decisions: pre-moderation, VerifiedNepal registers with DoIB, build order, deferred items.
5. `docs/SEO-ACTION-PLAN.md`, `docs/CONTRIBUTOR-TODO.md`, `docs/TODO.md`, `docs/GOVERNANCE.md`, `docs/MODERATION-GUIDELINES.md`, `docs/DESIGN-GUIDELINES.md`, `docs/onlyutils-media-variants-requirement.md`.
6. Code cited: `src/pages/home.tsx`, `src/pages/find-person.tsx`, `src/pages/dispatches.tsx`, `src/pages/dispatch-detail.tsx`, `src/pages/incidents.tsx`, `src/pages/privacy.tsx`, `src/pages/coverage.tsx`, `src/pages/ledger.tsx`, `src/lib/api.ts`, `src/lib/format-date.ts`, `src/lib/live.ts`, `src/lib/og-meta.ts`, `src/lib/edition.ts`, `src/lib/helplines.ts`, `src/lib/chat-widget.ts`, `src/articles/types.ts`, `src/articles/render.tsx`, `src/components/site-header.tsx`, `src/components/site-status-bar.tsx`, `src/components/accessibility-bar.tsx`, `src/components/ui/button.tsx`, `src/i18n/shell.ts`, `src/i18n/index.ts`, `src/i18n/climate.ts`, `src/i18n/how-to.ts`, `index.html`, `vite.config.ts`, `public/robots.txt`, `public/llms.txt`, `public/data/meta.json`, `src/data/relief-centers.json`, `functions/articles/[id].ts`, `functions/sitemap.xml.ts`, `functions/_shared/meta.ts`.

Live checks (2026-10-14, by this report unless noted):

7. `https://api.prod.verifiednepal.com/dispatches`, `/stories`, `/centers`, `/incidents`, `/projects`, `/ledger` → `{"items":[]}`; `/audit?month=2026-08|2026-09|2026-10` → `{"items":[]}`; `/needs` and `/coverage` → `incidentId required`.
8. `https://verifiednepal.com/feed.xml` → SPA shell; `https://verifiednepal.com/stories` → 200 (client Not Found); `https://verifiednepal.com/articles/nope` → 404; `https://www.verifiednepal.com/` → 200, no redirect.

Research notes (same folder) and the external sources they cite:

9. `audience_habits_and_demographics.md` — Q1–Q7; DataReportal Digital 2026: Nepal, https://datareportal.com/reports/digital-2026-nepal; Nepal Media Survey 2020/2022/2024 (Sharecast Initiative); CMR Nepal 2024 misinformation survey.
10. `audience_pain_points_reddit_forums.md` — KQ1–KQ7; r/Nepal and r/technepal threads 2020–2024; Hamro Patro Play Store reviews; academic clickbait study cited therein.
11. `disaster_civic_information_seeking.md` — KQ1–KQ8; Kathmandu Post, 18 Sept 2026 (Rasuwa ward chairs vs CDO; the "public record" hook, marked inference at the note's line 320); NDRRMA and Nepal Police Facebook pages; BIPAD portal.
12. `nepali_ui_ux_conventions.md` — §1–§8; Setopati/eKantipur/Onlinekhabar mastheads; Google Fonts subset sizes; MoCIT 2021 website directive; Dina TTS (UNICEF/ATscale, 3 Dec 2024).
13. `portal_traction_and_business_models.md` — KQ1–KQ9; Similarweb/Ahrefs estimates; RONB and Hamro Patro case studies; Kantipur digital subscription Aug 2026.
14. `publisher_journalist_moderator_side.md` — KQ1–KQ7; Online Media Operation Directive 2017; Press and Publication Rules amendment Nov 2025; PCN "Editorial Guidelines for Humane and Responsible Disaster Reporting, 2083" (4 Sept 2026); ETA 2063 s. 47; Freedom Forum 2025/2026 reports.

Where this report states a legal rule, it is restating the research notes' reading of secondary sources; the owner's decisions doc already records that official texts, fees and staffing rules must be confirmed with DoIB directly.
