# E2E test report, October 2026 public-site work

Plan: `docs/PUBLIC-SITE-ACTION-PLAN-2026-10.md`. Environment: `https://dev.verifiednepal.com` and `https://api.dev.verifiednepal.com`. Accounts: the dev fixture accounts in `docs/BETA-TESTING.md` (admin, moderator, helper, helper-01, helper-02). Scripts that produced these results are in `docs/e2e/2026-10/scripts/` (`cdp.mjs` is the raw-CDP driver; run with Node 22).

## W0-1 and W0-2 (pure code, merged 2026-10-14)

| Check | Result |
|---|---|
| `pnpm test` after merge | 113 pass (118 after the later date fix) |
| BS table against the `nepali-date-converter` library, BS 2070 to 2083, every day | 7,141 days, 0 mismatches |
| Same comparison from BS 2084 | Libraries disagree from Jestha 2084 (June 2027); action A-8 covers the yearly re-check |
| Public-copy guard | Passes; one existing string changed ("news clips" to "video clips") |

## W1-A chrome, W1-B home honesty (dev build of commit c567315 and the merges before it)

Browser checks, headless Chrome 153 over raw CDP, fresh profile.

| Check | Result |
|---|---|
| First visit language | `html lang="ne"`, hero in Nepali |
| Mobile menu (360 px) | Now, Get help, Give help, Find someone, Drop centres, Ledger, then "More" disclosure |
| Desktop menu (1280 px) | Same six plus "More"; status-bar link row removed (it repeated the menu), live badge and Sign in kept |
| Get help and Give help above the fold at 360x740 | Yes: buttons end at 493 px and 549 px (core-promise rule 6) |
| Hero | "Find help. Give help." / "सहयोग माग्नुहोस्। सहयोग गर्नुहोस्।"; no "explicit name search" |
| Masthead dateline | `बुधबार, असोज २८, २०८३ (१४ अक्टोबर २०२६)` / `Wednesday, Asoj 28, 2083 (14 Oct 2026)` |
| Situation band | Own line "Source: NDRRMA · updated just now" (live) with its own time, no global "Live" |
| `/search` lead | Says it searches NDRRMA rescued and missing lists by name, Nepali or English, then points to OPMCM |
| `/articles` signed out | No "Write an article" button; signed in as helper: button present |
| Service worker precache | `rescued-persons.json` no longer precached (three small climate JSON files remain) |
| Desk, signed in as admin | "Guides" tab in the Admin group; opens Governance and Moderation guidelines text (13,628 characters); `/desk/guides` opens directly after the last fix |

Findings during the run, all fixed before this report:

- The Chrome build used here has no Nepali `Intl` data, so weekday, month and "11 hours ago" fell back to English inside Nepali pages. Older Android WebViews can do the same. Fixed by giving Nepali its own small tables in `format-date.ts` (commit 54da268).
- Mobile: the Get help and Give help cards were the fourth and fifth card, below the fold. Fixed with a two-button row in the hero (below the `lg` breakpoint).
- Desktop: the status-bar link row duplicated the new menu. Removed.
- `pnpm format` run by Codex reformatted about 70 unrelated files in three lanes; those changes were reverted before merge. The repository is not Prettier-clean on `main`; do not run `pnpm format` across the tree in a lane.

Step 0 result for W1-B (the open question from the audit): on 2026-10-14 prod's home page shows live NDRRMA counters (7,514 rescued, 4,898 records) that differ from the bundled snapshot (6,633 and 2,189), and the OPMCM block lists items dated 13 and 14 October. So the "Live over a stale snapshot" claim in Report 3 was wrong for the counters. The relief-location count still comes from the bundled file, and is now labelled with its snapshot date.

Not covered: Nepali read-through of the new strings (action A-1, after prod), PNG share cards (Wave 2), 150% text zoom at 320 px.

## W1-C backend, `kind: news` (API, dev Lambda after commit d0bcaaf)

Script: `scripts/w1c-api.mjs`. Result 31 of 34; the three misses are my test article lacking an uploaded cover (the article route has always required one), confirmed separately: a draft article submit returns `missing: ["cover"]` and the 11 existing articles still list and read.

| Id | Check | Result |
|---|---|---|
| 0a | Admin sets the correspondent flag on helper-01 by user id | 200 |
| 0b | helper-01 `/me` shows `reporter.approvedAt` | pass |
| 0c | helper-02 (no flag) creating news | 403 `reporter_required` |
| 0d | Moderator changing the flag | 403 |
| 0e to 0g | Correspondent creates, edits and submits a cited local update (Rasuwa, municipality scope, OPMCM notice of 14 October as source) | 201, 200, `pending` |
| 0h | Correspondent calling the moderation route | 403 |
| 1a to 1c | Admin creates a local update with only a typed source line and no link | 201, accepted, `pending` |
| 2 | Admin publishing their own news | 403 `own_item` |
| 3a to 3d | Moderator queue `?kind=news` lists both; default queue excludes them; moderator publishes both; public `?kind=news` lists both | pass |
| 3e | Public `/dispatches` without `kind` | Unchanged (11 articles, news excluded) |
| 3f, 3g | Detail shows `kind`, `locality`, `happenedAt`, `sourceUrls`, and `sourceNote` for the typed-source item | pass |
| 3h | Public detail leaks no email or raw sub | pass |
| 4 | Body over 1,200 characters; no `happenedAt`; no URL and no note | 400 with `missing` body, happenedAt, source |
| 7a to 7g | Daily limit setting: default on at 5; moderator 403; admin sets 1; correspondent blocked with 429 `daily_limit` and `resetsAt`; switch off lets them create; restore default; limit 0 rejected | all pass |

Design note for Wave 2: creation of a news item requires `happenedAt` and a source in the create request itself (drafts may otherwise be incomplete), so the authoring form must send them with the first save. The correspondent flag stores `localities` and `nationalScope`; the admin toggle sends an empty list and `false` until the correspondent rules gate opens.

Dev data created: two published local updates (ids `9100295f-6647-457a-8ffb-837e66b4b0a9` Rasuwa health response, `32506776-7ff7-4acc-9350-caf6d0a62164` Gorkha health response, typed source) and helper-01 flagged as a correspondent. Both items cite real OPMCM notices.

Not covered: Lambda concurrency under parallel load.

## Wave 2: W2-D Now strip, W2-E Desk and authoring, W2-F sharing (dev build of commit bf6b237)

Browser checks with headless Chrome over raw CDP (`scripts/` holds the earlier drivers; the Wave 2 drivers follow the same pattern) plus the API loop from the W1-C section. Codex also drove the authoring loop locally against the dev API before merge; its own record is summarised below.

| Check | Result |
|---|---|
| Home `/` at 360x740, Nepali: strip titled "अहिले" below the situation band and relief map | Present; hero and Get help / Give help still first, buttons end at 493 and 549 px |
| Requests added to `/` by the strip | Exactly two (`/dispatches?kind=news`, `/ledger`) |
| Row labels | Official notices carry "आधिकारिक स्रोत", checked local updates "जाँच गरिएको", ledger rows carry no trust word and no language chip |
| Relative times in Nepali | "३ घण्टा पहिले", "हिजो"; older ledger rows fall back to an absolute Nepali date |
| OPMCM rows | Title, agency, three-line body with expand, link to the OPMCM page |
| Share row on each strip row | WhatsApp, Viber (`viber://forward?text=`), copy; one line at 360 px, no overflow |
| Local update detail page (`/articles/<id>`) | Eyebrow "स्थानीय अपडेट", locality chip, language chip, "जाँच गरिएको" with tooltip, "घटना भएको मिति असोज २७, २०८३ (हिजो)", sources list including a typed source line, Viber link |
| Share preview (`curl -A facebookexternalhit`) | Nepali title, locality in the description, `inLanguage: ne`, `og:type website`, `datePublished` from `happenedAt`; article pages unchanged |
| Desk, admin: "Local updates" tab | Rule card shows the reject rule, "You cannot publish your own update. The correspondent writes, a moderator publishes.", the corrections line and the PCN 2083 checklist |
| Desk, admin page | "Local correspondent" email form and a "Local updates" settings card with the daily-limit switch and number (1 to 50) |
| `/me` for helper-01 (correspondent) and admin | "Write a local update" and "My local updates" present |
| `/me` for helper-02 (not approved) | Neither present; opening the form URL shows "an administrator must approve you as a local correspondent" |
| Authoring form at 360 px, Nepali | Fields: headline, body (1,200 character note), language, district, municipality, ward, scope, happened-at, up to three source links, typed source line, one tag, optional image |

Codex's own browser loop against the dev API (local build, test-only CORS override), recorded in its report: blank form shows bilingual validation before any create; first request carries kind, language, happenedAt, sources, title, body, one tag, scope and locality (201, submit pending); queue shows body, scope, municipality, date, link and typed source inline; publish and reject both 200; `/me` shows the rejected item with its Nepali reason; with the limit at 1 a create returned 429 and the UI showed the filed count and a relative retry time; limit switched off allowed creates and was restored to on at 5; an admin's own items show no Publish button, only Reject; language switch keeps unsaved form input.

Dev data created by these runs (all cite real notices): published `89d8a726-a6c1-41b4-9eb9-c970f4801322` (Kathmandu park closure notice, link source), published `018b4da0-7ebd-40c1-9e14-9c3aba636c7e` (Kathmandu cooperatives notice, typed source), rejected `b7d69c37-61b4-4051-b15d-5261c0d9ae16`; plus the two from the W1-C section.

Findings:

- The Nepali name for local updates was "स्थानीय जानकारी" in the authoring and Desk lanes and "स्थानीय अपडेट" on the detail page. Unified to "स्थानीय अपडेट" in commit bf6b237. The owner's Nepali read-through (A-1) should confirm the term.
- Codex noted the existing signed-in header overflows at 320 px with 150% text. Pre-existing; not fixed in this wave.
- `og:image:alt` on share previews still says "community-verified disaster response for Nepal", the old wording. Not changed.
- Project detail page share row had no Viber; fixed separately (0966656).

Not covered: PNG share cards for local-update permalinks (not built; the text share and OG preview cover Viber, WhatsApp and Facebook), image upload in the authoring form, Lambda concurrency under parallel load, a human Nepali read-through.

## Ads: ADS-A backend and ADS-B frontend (dev build of commit a88d7cc)

Owner decision 2026-10-14: build the ad feature now; selling or running ads waits for the DoIB registration. With no ad item nothing renders. API script: `scripts/ads-api.mjs`.

| Id | Check | Result |
|---|---|---|
| 3, 4 | Helper cannot create an ad; moderator cannot list ads | 403, 403 |
| 5a to 5d | `javascript:` link, HTML in a label, end before start, image outside the media bucket | 400 each |
| 6, 7 | Admin creates a house ad for all of Nepal and a Gosaikunda-targeted ad | 201, 201 |
| 8a to 8e | Gosaikunda gets the municipality ad; Gorkha and no-place callers get the general ad; the other slot has none; response is `public, max-age=300` and carries no `note` or `createdBy` | pass |
| 9 | Admin list shows both with `active: true` | pass |
| 10a, 10b | Admin ends the municipality ad by moving its end date into the past; it stops being served | pass |
| UI | Detail page of a local update and of a plain article show the slot after the body and before the sources; label "विज्ञापन / Sponsored"; link has `rel="sponsored noopener noreferrer"`, opens a new tab; image loaded; alt text is the caption | pass |
| UI | Desk "Ads" tab (Admin group) opens for admin; shows the warning "Do not run paid ads until VerifiedNepal's registration is complete" and the create form (placement, audience area, image, URL, two captions, dates, internal note) | pass |
| Cleanup | Both test ads deleted; admin list empty; public endpoint returns `{"ad":null}` | pass |

Finding (environment, not code): image upload on dev returns 502 `media_upstream: client authentication failed`. This is the dev media-client secret that was removed from the Lambda on 2026-09-07 (see `docs/e2e/2026-09-07/E2E-TEST-REPORT.md`, finding 1); it needs a free secret slot in the OnlyUtils console and an infra-repo Terraform apply. It also blocks image uploads in the article editor and the ad form on dev. The ad checks above reused an image already in the media bucket. Prod was not tested for this.

Not covered: uploading a new image from the ad form, editing an ad from the Desk form (API edit covered), the `localTop` slot (no page yet).

## Leftover fixes: header overflow, share preview, PNG cards for local updates (dev build of commit 1304533)

Owner asked to fix the three leftovers from the Wave 2 report. Script: `scripts/overflow-sweep.mjs` (set `WARM=1` so each page is loaded once before measuring; `MODES`, `PAGES` narrow the run).

| Check | Result |
|---|---|
| Overflow sweep, 320x640 mobile emulation, text scale 150% (`vn:text-scale`), ne and en, signed out and signed in (helper-01), 19 pages (`/`, `/me`, `/get-help`, `/give-help`, `/search`, `/articles`, a local update page, `/ledger`, `/drop-centers`, `/incidents`, `/projects`, `/climate`, `/missing`, `/poster`, `/report-incident`, `/register-organization`, `/our-message`, `/info`, and `/desk` signed in) | No page has `scrollWidth > clientWidth`; no header element past the right edge |
| Header, signed in, 320 px / 150% | Controls wrap onto a second line, Menu reachable, every control at least 44 px |
| Home at 360x740 after all changes | Nepali by default; Get help and Give help buttons end at 493 and 549 px; Now strip below the situation band; Viber links present |
| Default share preview (`curl -A facebookexternalhit /`) | Title "verifiedNepal \| Find help. Give help."; new description; `og:image:alt` updated; `og-card.png` 1200x630, 53 KB, no "community-verified", no flood eyebrow |
| `scripts/render-og-card.mjs` | Rebuilds `public/brand/og-card.png` from `scripts/og-card.html` with headless Chrome |
| PNG card, local update detail page | Button "तस्बिर डाउनलोड गर्नुहोस्" present; click produces a blob download named `verifiednepal-local-update-<id>.png`; share counter fires after download or share |
| PNG card on the Now strip | Present on every local-update row, absent on official notices and ledger rows |
| Card content, Nepali | Title, place and Bikram Sambat date, excerpt (two-line limit of the existing renderer), "जाँच गरिएको · verifiednepal.com/articles/<id>"; conjuncts (स्वास्थ्य, क्षेत्रको, प्रतिकार्य, अद्यावधि) render correctly |

Causes found and fixed along the way:

- The Now strip's compact share row (my earlier change) could not wrap at 320 px / 150%; made wrapping.
- Cloudflare verification widget: fixed 300 px iframe inside a 272 px card widened `/get-help` and every other anonymous form; it now renders compact when its container is under 300 px.
- Long Nepali words in a local update title did not break; the heading now wraps.
- Hotline rows, the missing-person link list, the incidents district filter, the climate legends, the signed-out sign-in prompt and the poster preview needed wrapping or stacking.
- First-mode readings in a fresh browser sometimes showed old overflow after a deploy; a cold load measured over time was clean, so these were a test-order artefact. The sweep script's warm-up option avoids it.

Not covered: real-device checks (iPhone Safari, older Android WebView), the signed-in Desk header below 320 px, completing a verification widget (headless Chrome cannot).

Final header measurements on dev (commit ff0ba12; `scripts/header-heights.mjs`): at 360 px normal text the public header is 57 px tall signed out and signed in, in both languages, with the wordmark fully visible on two lines (no ellipsis); the Desk header is 57 px (it was 177 px in Nepali and 105 px in English after the first overflow fix, so the Desk now shows only the logo mark below the `sm` breakpoint, with the name kept for screen readers). At 320 px with 150% text no layout overflows horizontally; the header wraps to 157 px signed out, 229 px signed in and 235 px on the Desk.

Regression caught while testing: the first overflow fix truncated the wordmark to "भेरिफाइड ..." and made the Desk header very tall at 360 px; both were fixed before this deploy.
