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
