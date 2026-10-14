# Public-site action plan, October 2026

One prioritised queue that merges the public-site audit (`docs/public-audit-2026-10/`), the owner's local-updates decisions (`docs/NEWS-PORTAL-DECISIONS.md`) and the 20-task implementation plan (`docs/superpowers/plans/2026-10-14-local-updates.md`). Agents work the queue top to bottom. Items in the same wave run in parallel; a wave starts only when the previous wave is merged on `main` and verified on dev.

Written 2026-10-14 (all twelve owner questions in section 7 answered the same day) after an LLM council round on the reconciliation question (transcript: `docs/public-audit-2026-10/council-action-plan-2026-10-14.md`) and two alignment checks (section 1). Authoritative order of precedence when documents disagree: `NEWS-PORTAL-DECISIONS.md` > this plan > the 20-task plan > the audit reports > council transcripts.

**Status key.** Each item has a checkbox. Tick it only when the e2e section in `docs/e2e/2026-10/E2E-TEST-REPORT.md` for that item is written and the dev deploy is green.

---

## 1. How the three bodies of work align

### 1.1 Research notes vs the three reports vs the PDF

A checker read all seven notes, the three reports and the PDF text. Alignment is high. Every numeric token in Reports 1 and 2 appears in the PDF; 69 of 70 headings match; the 68-page PDF carries all four documents. Discrepancies, all small, two of them worth acting on:

| # | Finding | Action in this plan |
|---|---|---|
| 1 | Report 3's headline claim that the home page shows "Live · updated HH:MM" over the 2026-08-29 snapshot is **not supported by the inventory**. The inventory says the NDRRMA counters poll every five minutes and the badge already says "Snapshot" on fallback (`src/lib/live.ts:143-146`). The OPMCM feed is live (100 items, newest 2026-10-13, checked today). | Item W1-B starts by verifying what prod shows before changing it. Each home block gets its own source and time label regardless. |
| 2 | Report 3 never scores the PMDRF QR SVG rendered on `/` and `/info`, or bank/eSewa/Khalti details on project pages, while Report 2 says the ideal site "never renders a QR code or wallet number". | Owner question Q10. No code change until answered. |
| 3 | "62% primary news source" (Report 2) should be "62% use Facebook for news"; only 16-24s have it as primary (82.6%). | Docs item D-1. |
| 4 | Posting window: notes say 6-10 pm (NTA), 8-11 pm (ISP peak), 6-11 pm (prime). Reports and verdict say 6-9 pm. | Use "evening, 6-10 pm" in copy; D-1 aligns the reports. |
| 5 | Notes carry a **provincial registration track** (Bagmati Province Communication Registrar's Office, 327 online media) that no report mentions. | Owner action A-3 (DoIB check) includes the provincial office. |
| 6 | Notes: 64% rely on family, friends and neighbours for local news; Viber user counts; radio reach by province. Not carried into the reports. | Informational. Supports Viber share (W2-F) and WhatsApp/Viber over RSS. |
| 7 | Stale text: `NEWS-PORTAL-DECISIONS.md` row 5 still says "Works with post-moderation"; inventory §11 says ads are "step 6"; inventory §12 still lists post-moderation labels and a "legal opinion". | D-1. |
| 8 | PDF defect: three placeholders (`<datetime>`, `<time>`, `<date>`) were swallowed as HTML tags in Report 3 §2.1, §2.8 and quick win 1. The verdict on p.68 says Review 4's claim is "unverified" while Report 3 §8 says "confirmed for prod". | D-1 regenerates the PDF after fixing the markdown. |
| 9 | Minor: "Media Council Act replaces PCN" is unconfirmed; 5,126 vs 5,135 outlets; "almost no local (palika) content" is a paraphrase, the note says "weak local coverage"; Langtang eyebrow says "glacial lake outburst", the disaster note says glacier collapse in the Lhende valley. | D-1 where one line fixes it. |

### 1.2 Audit and council vs the owner's decisions vs the 20-task plan

Nothing in the audit reverses a settled owner decision. The two substantive asks are: do the honesty fixes before build-order step 1, and gate ads on the DoIB certificate. A checker then read the 20-task plan against the decisions doc and the code. The plan under-implements the decisions in six places, over-implements in six, and lacks every council item that touches code:

| Area | Gap | Resolution |
|---|---|---|
| "Now" strip | The plan has no Now strip at all; T10 is a "Your area" block that needs a saved locality and shows only local updates. | T10 is **replaced** by item W2-D: a four-source strip on `/` that needs no locality. "Your area" moves to the gated locality layer. |
| Relative time, Bikram Sambat dates | Absent from the plan. `src/lib/format-date.ts` and `src/lib/edition.ts` already exist (quick win 7 wrongly calls the helper "new"). | Item W0-1 adds them as additive exports; every later row imports them. |
| Trust vocabulary | Absent. T20 mentions a "review mark" no task builds. | Item W0-2 creates `src/i18n/now.ts` with the two words; W1-B applies them. |
| Share cards, Viber, `feed.xml` | T12 does OG meta and sitemap only. | Viber and news share meta in W2-F. `feed.xml` deferred (G-4). |
| Nav | T9 adds an always-visible nav item while the council cuts the menu to six. | W1-A cuts the menu; the local-updates entry is added under "More" only when G-1 opens. |
| Ads | T18/T19 ship with no gate. | G-3: not written until the DoIB certificate exists. |
| Queue language filter | Decision 4 filters the queue by the moderator's languages; T14 only hides the Publish button. | Acceptable for one or two moderators; full filter moves to G-2 with T13. |
| Three rejections in 90 days flag | Missing everywhere. | Added to G-2 (T15). |
| Public flagging of local updates | Decisions say "existing FLAGGED queue", but dispatches have no flag route (`/needs/:id/flag` only). | New task in G-2. |
| Edit after publish returns to pending | The plan's self-review says this is already the behaviour. It is not: `dispatchController.js:108` returns 409 unless draft or rejected. | New task in G-2. |
| Reviewer rule scope | T6 extends `own_item` to articles too; a lone admin could no longer publish their own article. | W1-C applies author ≠ reviewer to `kind: "news"` only. Articles unchanged. |
| 7-day `expiresAt` exclusion | The plan excludes expired news from tiers; the owner dropped the staleness rule. | `expiresAt` stays optional, nothing filters on it. |
| Tier collapse | Plan folds tiers with fewer than three items; decision says empty tiers collapse. | G-1 uses "empty". |
| Body 1200 chars, exactly one tag, max 3 sources | Plan's own limits, not in the decisions. | Kept as defaults; owner question Q11 can change them before G-1. |
| Correspondent profile URL | T17 exposes the raw auth `sub`. | G-2 uses a handle or the request id. |
| Desk nav shape | T14 predates today's `group:` field (commit 180f903). | W2-E uses `group: deskGroupPublish`. |
| Workflow | Plan says "PR per phase, main is protected"; `CONTRIBUTING.md:55` agrees. Branch protection has `enforce_admins: false`, so the owner merges directly. | Section 2 is the workflow. The plan's TDD steps remain the per-task detail for tasks kept as written. |

### 1.3 Quick wins, verified against the code

| # | Quick win | Code check (2026-10-14) | Where it lands |
|---|---|---|---|
| 1 | Snapshot label + dateline on `/` | Fallback label already exists in `live.ts:143-146`; `edition.ts` helpers have no callers; `home.tsx` does not import it | W1-B (dateline), W1-A (status bar) |
| 2 | Hide empty surfaces from nav; Write button behind sign-in | 13-item nav `site-header.tsx:28-42`; status bar `:22-31`; Write button unconditional `dispatches.tsx:111`. **No `/stories` link exists** (home heading hides when empty), so that part is void | W1-A |
| 3 | Six-item menu + "More" | Confirmed | W1-A |
| 4 | Nepali default on first visit | `App.tsx:182-185` returns `"en"` | W1-A |
| 5 | Hero and `/search` lead rewrite | `i18n/index.ts:68`, `:58`; `find-person.tsx:99-105` | W1-B |
| 6 | Two-word vocabulary | `home.tsx:490`, `project-detail.tsx:130-132` | W0-2, W1-B |
| 7 | Relative time + BS date | Absolute only in `dispatch-detail.tsx:183`, `dispatches.tsx:168`, `incidents.tsx:26` | W0-1, W2-F |
| 8 | Self-host fonts | `index.html:29-33` Google Fonts; `public/fonts` absent | G-5 (conditional) |
| 9 | Drop 1.5 MB JSON from SW precache | `vite.config.ts:53` glob includes `json` | W1-A |
| 10 | Viber + article OG tags | No Viber in `dispatch-detail.tsx:242-268` | W2-F (Viber); article OG tags dropped until articles exist |
| 11 | `feed.xml` | Absent | G-4 |
| 12 | Public GOVERNANCE / MODERATION-GUIDELINES | Not linked anywhere (`site-footer.tsx:33-62`) | W1-A (two footer links) |
| 13 | www redirect + sitemap submission | **www already 301s to the apex.** Sitemap submission is owner-only | Done / A-4 |
| 14 | `llms.txt` and `/info` un-hardwired | `llms.txt:3,5`; flood text in `i18n/index.ts:28,82,117` | W1-B |
| 15 | `Organization.sameAs` Facebook | `index.html:53` lists GitHub only | G-6 (needs page URL) |
| 16 | Roman-Nepali transliteration | `transliterate.ts` absent | G-1 |
| 17 | Nepali skip link + chat strings | `App.tsx:285-291`; chat strings at `chat-widget.ts:128,216` | W1-A |

---
## 1.4 The core promise (every item is checked against this)

VerifiedNepal is first a place where people register for help and people who can help find those needs and act. The local-updates work, the Now strip and everything in the gated sections are **additions** to that, never a replacement (owner, 2026-10-14). Concrete rules every lane and every e2e section applies:

1. On `/` at 360x740 the hero and the five action cards (Find someone, Missing, Poster, Get help, Give help) stay first. The Now strip sits where the OPMCM block sits today, below the situation band and the relief map, never above the action cards.
2. The primary nav keeps "Get help" and "Give help" in positions 2 and 3. The hero's two sentences end in those two actions and never mention local updates.
3. Every page keeps one clear next action (a primary `Button`), and nothing new is added to the public site in Waves 0 to 2 except the strip rows and the local-update detail fields. No new public page before G-1.
4. The Desk needs, offers, missing and centre queues are not touched by W2-E; the local-updates queue is one more tab.
5. Minimal and trustworthy beats complete: if a deliverable makes a public page longer without giving a reader a next action, cut it and say so in the summary.
6. Each public-facing item's e2e report carries one 360x740 screenshot of `/` with "Get help" and "Give help" above the fold, taken after the change.

## 2. How every item is executed (read once, apply to all)

The same loop for every item. An agent that skips a step has not finished the item.

### 2.1 Worktree

```bash
cd /home/lxu/workspace/laxman/verifiednepal
git fetch origin && git worktree add -b <item-id>-<slug> ../vn-wt/<item-id> origin/main
cd ../vn-wt/<item-id> && pnpm install --frozen-lockfile && (cd server && pnpm install --frozen-lockfile)
```

One worktree per item. Never two agents in one worktree unless the item says "shared lane" and lists disjoint files. If the session itself is inside an `EnterWorktree` worktree, the harness blocks compound shell lines; put logic in a script under the scratchpad and call it as one plain command.

### 2.2 Codex does the code

All code changes are made by Codex, never by hand in the session. Write the brief to a file, then:

```bash
codex exec --dangerously-bypass-approvals-and-sandbox \
  -m <model> -c 'model_reasoning_effort="<effort>"' \
  -c 'mcp_servers.notion.enabled=false' -c 'mcp_servers.temporal.enabled=false' -c 'mcp_servers.figma.enabled=false' \
  -C ../vn-wt/<item-id> "$(cat brief.md)" </dev/null > codex-<item-id>.log 2>&1
```

`</dev/null` is mandatory (Codex blocks on stdin otherwise). Run one background Bash per Codex run. Every brief carries the same header block (section 2.6) plus the item's deliverables, file list and test list. Review the diff against the brief before any gate; Codex has in the past invented API fields when writing docs, recoloured brand marks, and mutated auth state in place. Spot-check those three things.

**Model guide** (Codex models on this account, checked 2026-10-14):

| Model | Use for | Effort |
|---|---|---|
| `gpt-6-luna` | Copy, i18n strings, nav lists, one-file config edits, docs | `medium` |
| `gpt-6.1-sol` | Ordinary feature work: a component, a controller, a view, tests | `high` |
| `gpt-6-astra` | Cross-cutting logic with a correctness ceiling: date maths, tiering, reviewer rules, data-model changes that touch GSI keys, service-worker caching | `high` (`xhigh` for the BS calendar) |
| `gpt-reserve` | Mechanical sweeps across many files with an explicit table of edits | `low` |

### 2.3 Gates before merge

```bash
pnpm format && pnpm typecheck && pnpm test && pnpm build && (cd server && pnpm test)
```

`pnpm typecheck` is incremental (`tsc -b`); delete `node_modules/.tmp/*.tsbuildinfo` before trusting green after large moves. Frontend tests run with `node --test` and strip-types, so intra-`src` imports in tests need explicit `.ts` extensions.

### 2.4 Merge and deploy

```bash
git -C ../vn-wt/<item-id> commit -am "<type>: <imperative summary>"   # plain, no trailers
cd /home/lxu/workspace/laxman/verifiednepal && git pull --ff-only origin main
git merge --ff-only <item-id>-<slug> || git merge --no-edit <item-id>-<slug>
git push origin main
git worktree remove ../vn-wt/<item-id> && git branch -d <item-id>-<slug>
```

Push to `main` deploys the frontend to `dev.verifiednepal.com` (`deploy-dev.yml`) and, when `server/**` changed, the Lambda (`deploy-backend-dev.yml`). Watch with `gh run list --limit 3` then `gh run watch <id>`. Branch protection has `enforce_admins: false`, so the owner's credentials push directly; the `check` job is required only on PRs, so run the same gates locally (section 2.3) instead. Prod is a `workflow_dispatch` (`deploy-prod.yml` and `deploy-backend-prod.yml`). The owner authorised agents on 2026-10-14 to run both **immediately after a wave's e2e report is green on dev** (Q12); single items never deploy prod on their own. Run `gh workflow run deploy-prod.yml --ref main` and, when `server/**` changed in the wave, `gh workflow run deploy-backend-prod.yml --ref main`, watch both, then `curl -s https://verifiednepal.com | grep -o 'index-[^"]*\.js'` and record the prod SHA in the e2e report. A dev deploy that breaks the home page is reverted with `git revert` on main, not fixed forward.

### 2.5 E2E on dev

Dev has data (on 2026-10-14: 11 articles, 11 centres, 27 ledger rows, 7 incidents, 11 stories) and fixture accounts; prod has none. Every item's e2e runs on dev only.

- **Accounts** (`docs/BETA-TESTING.md`): `helper-beta-tester@`, `moderator-beta-tester@`, `admin-beta-tester@verifiednepal.com`, password `E2eTest!2026Pass`, plus `helper-01..25-beta-tester@`. Token:
  ```bash
  curl -s -X POST https://auth.onlyutils.com/login -H 'Content-Type: application/json' \
    -d '{"email":"admin-beta-tester@verifiednepal.com","password":"E2eTest!2026Pass","client_id":"ou_client_34HIKupJ5afWl0DIoh7zi"}'
  ```
  Then `curl -H "Authorization: Bearer $TOKEN" https://api.dev.verifiednepal.com/me`.
- **Browser**: headless Chrome over raw CDP (Node 22 `WebSocket`, no Puppeteer installed): launch `google-chrome --headless=new --remote-debugging-port=9333 --remote-allow-origins=*`, then `Page.navigate`, `Runtime.evaluate`, `Page.reload`, `Page.captureScreenshot`, `Emulation.setDeviceMetricsOverride` (360x740 and 1280x800). Set `localStorage` in one evaluate and reload with a separate `Page.reload`. Radix controls need real CDP mouse events, not `.click()`. Sign in via the dev-only test form on `/desk/login`.
- **Turnstile** blocks anonymous writes from headless browsers: verify anonymous forms by API (expect 400 without a token) and do writes as a signed-in fixture account.
- **Lambda concurrency is 10 per account** (increase request pending): run one browser driver at a time, and not while a human has the Desk open, or you will see 503 "server unreachable".
- **Data must look real**: no "test", "seed", "E2E" markers in anything an agent creates on dev. Realistic Nepali names and places; identify test rows by id in the report, never by visible markers.
- **Report**: append to `docs/e2e/2026-10/E2E-TEST-REPORT.md` (create on first use, same shape as `docs/e2e/2026-09-08/E2E-TEST-REPORT.md`): build SHA, accounts used, an API-check table, a browser-check table with screenshot paths under `docs/e2e/2026-10/screenshots/`, findings, not covered. One section per item, headed by the item id.

### 2.6 Brief header every Codex run gets

```
Repo: verifiednepal (React 18 + Vite + Tailwind + shadcn in src/; Node 22 Lambda in server/; Cloudflare Pages Functions in functions/).
Read first: CONTRIBUTING.md, docs/DESIGN-GUIDELINES.md, docs/NEWS-PORTAL-DECISIONS.md.
Core promise: VerifiedNepal is first a place where people ask for help and people who can help find those needs; local updates are an addition. Never move, shrink or push below the fold the Get help / Give help actions on `/`; every page keeps one clear next action; add nothing a reader does not need.
Rules: no new runtime dependencies. Every user-visible string has en and ne entries in the per-area src/i18n/<area>.ts file named in this brief; natural Nepali. Public copy never says "news", "reporter" or "news portal"; say "Local updates" / "local correspondent". Only two trust words: "Official source / आधिकारिक स्रोत" (items relayed from OPMCM, NDRRMA, DHM, Nepal Police) and "Checked / जाँच गरिएको" (passed a moderator). Native <select> via NativeSelect; PageHeader/Card/Button/StatusBadge/EmptyState/Alert as in docs/DESIGN-GUIDELINES.md; 44 px targets; works at 320 px and 150% text in Nepali. src/App.tsx is a routing shell only. Backend calls only in src/lib/api.ts. Third-party brand marks keep their own colours. Mark deliberate simplifications with a `// ponytail:` comment naming the upgrade path.
Do not: run git commands that change state; edit files outside the list below; touch Terraform, workflows or .env.
Finish with: pnpm format, pnpm typecheck, pnpm test, pnpm build (and cd server && pnpm test when server/ changed), all green, then a summary of files changed and anything you were unsure about.
```

---

## 3. The queue

Concurrency cap: **three Codex runs at once** (rate limits were hit before) and **one browser driver at a time** against dev (Lambda concurrency 10). Lanes in a wave own disjoint files; an agent that needs a file it does not own stops and reports.

### Wave 0, shared foundations (two lanes, parallel, about half a day)

Everything later imports these. Merge both before Wave 1 starts.

#### [x] W0-1 Date helpers: relative time and Bikram Sambat

- **Codex:** `gpt-6-astra`, effort `high`. Calendar maths has a correctness ceiling; a wrong BS date is the worst bug a "checked record" can ship.
- **Owns:** `src/lib/format-date.ts` (additive exports only; ~20 importers must keep compiling), `src/lib/format-date.test.ts` (create), `src/lib/bs-calendar.ts` (create).
- **Deliverables:**
  - `formatRelativeTime(iso, language, now?)` using the native `Intl.RelativeTimeFormat` (`ne` is supported: `११ घण्टा पहिले`); falls back to the absolute date after 30 days.
  - `toBikramSambat(date) → { year, month, day }` and `formatBsDate(date, language)` → `असोज २८, २०८३` / `Asoj 28, 2083`, table-driven month lengths for BS 2070-2095, no dependency.
  - `formatDateline(date, language)` → weekday + BS date + Gregorian in brackets, for mastheads.
  - Existing exports untouched.
- **Tests (must fail first, then pass):** 2026-10-14 → असोज २८ २०८३; 2026-08-26 → भदौ १० २०८३; 2024-04-13 → वैशाख १ २०८१; 2025-04-14 → वैशाख १ २०८२; day before and after each new year in the table; a date outside the table throws. Relative: 11 h ago in `ne` and `en`; 40 days ago falls back to absolute.
- **E2E on dev:** none beyond `pnpm test` (pure functions). Consumers verify in W1-B and W2-F.
- **Result (2026-10-14, merged as 7998d18):** 112 tests green. The BS table (nepali-datetime data) was compared day by day against the `nepali-date-converter` library for BS 2070 to 2083 (7,141 days, zero mismatches). The two sources disagree from Jestha 2084 (June 2027), where calendars are still projections. Owner action A-8 below covers the yearly re-check.

#### [x] W0-2 Vocabulary, shared types, public-copy guard

- **Codex:** `gpt-6.1-sol`, effort `medium`.
- **Owns:** `src/i18n/now.ts` (create), `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/auth.tsx` (`DeskProfile` only), `src/i18n/public-copy.test.ts` (create).
- **Deliverables:**
  - `nowStrings` with exactly two trust labels: `officialSource` ("Official source" / "आधिकारिक स्रोत") and `checked` ("Checked" / "जाँच गरिएको"), plus `checkedTooltip` ("A moderator other than the author confirmed this item names a source, a place and a date." / Nepali), `delivered`, `standingFloodImpact`, `standingLedger`, `nowTitle` ("Now" / "अहिले"), `nowEmpty`, `nowSeeAll`.
  - Types: `DispatchKind = "article" | "news"`, `NewsScope`, `Locality { district; municipalityId; ward? }`, optional `kind`, `scope`, `locality`, `happenedAt`, `sourceUrls`, `sourceNote`, `language` on the dispatch item types; `LocalUpdateSettings { dailyLimitEnabled: boolean; dailyLimit: number }` with `getLocalUpdateSettings()` and `putLocalUpdateSettings()` in `api.ts` (admin routes from W1-C); `listDispatches({ kind })` and `listPendingDispatches({ kind })` params; `getLedger` already exists (`api.ts:1077`); reuse it; `DeskProfile` gains `languages?: string[]`, `national?: boolean`, `reporter?`. No behaviour change: all optional, defaults preserve article callers.
  - A `node --test` that loads every `src/i18n/*.ts` public strings file (not `desk.ts`) and fails if any `en` value contains the words "news", "reporter" or "news portal" (case-insensitive, word boundary). Existing strings must pass; if one fails, fix the string in the same run and list it in the summary.
- **E2E on dev:** none (types and strings). `pnpm typecheck` green is the gate.

### Wave 1, honesty fixes and the news kind (three lanes, parallel)

Start after Wave 0 is on `main`. Expected one to two days wall-clock.

#### [x] W1-A Chrome: nav, defaults, precache, footer links

- **Codex:** `gpt-6-luna`, effort `medium`.
- **Owns:** `src/components/site-header.tsx`, `src/components/site-status-bar.tsx`, `src/desk/guides.tsx` (create), `src/desk/desk.tsx` (one nav entry), `src/App.tsx`, `src/pages/dispatches.tsx`, `src/lib/chat-widget.ts`, `vite.config.ts`, `src/i18n/nav.ts` (create for new strings), `src/lib/page-routing.test.ts`.
- **Deliverables:**
  1. Primary nav is six items: Now (`/`), Get help, Give help, Find someone, Drop centres, Ledger. Everything else (Posters, Incidents, Projects, Articles, Climate, Our message, Info, Drones) under a "More" disclosure in the sheet and the desktop menu. Routes unchanged. Static lists, no runtime emptiness checks (they flicker and add load).
  2. Status-bar quick links drop Articles, Projects, Incidents.
  3. `dispatches.tsx`: "Write an article" renders only when signed in; signed-out readers see nothing in its place.
  4. First visit defaults to `ne` (`App.tsx:182-185`); a stored choice still wins; `<html lang>` follows.
  5. Skip link, chat greeting and chat disclaimer bilingual (`chat-widget.ts:128,216`).
  6. GOVERNANCE.md and MODERATION-GUIDELINES.md stay unlinked on the public site (owner, Q5). Instead the signed-in Desk gets a "Guides" entry (group `deskGroupAdmin`, visible to moderators and admins) that renders both documents verbatim, reusing the renderer behind the existing moderator-guidelines gate shown at first Desk sign-in. Files: `src/desk/guides.tsx` (create), one entry in `src/desk/desk.tsx`.
  7. `vite.config.ts:53` precache glob excludes `data/rescued-persons.json` and climate geo/time-series JSON; a `runtimeCaching` rule with `NetworkFirst` covers `/data/**` instead. Workbox gets `cleanupOutdatedCaches: true`, `skipWaiting: true`, `clientsClaim: true` so installed clients pick up the new home on next load.
  8. `page-routing.test.ts` covers the new nav grouping.
- **E2E on dev:**
  - API: none.
  - Browser (CDP, 360x740, fresh profile): first paint is Nepali; menu shows six primary items and a "More" group; `/articles` signed out shows no Write button; `/articles` signed in as `helper-beta-tester` shows it. Screenshot each.
  - Service worker: load dev before merging (old build), merge, wait for deploy, reload twice, confirm the new nav. Check in DevTools-equivalent via CDP `ServiceWorker.enable` that the precache manifest no longer lists `rescued-persons.json`.
- **Done when:** screenshots and the SW check are in the e2e report.

#### [x] W1-B Home honesty: per-block source and time, hero, search lead, vocabulary

- **Codex:** `gpt-6.1-sol`, effort `medium` (Nepali copy quality matters more than logic).
- **Owns:** `src/pages/home.tsx`, `src/pages/find-person.tsx`, `src/pages/project-detail.tsx`, `src/pages/info-help.tsx`, `src/i18n/index.ts`, `src/i18n/shell.ts`, `src/lib/edition.ts`, `public/llms.txt`.
- **Step 0, verify before changing:** fetch `https://verifiednepal.com` data on prod: does the `SituationBand` show numbers equal to `public/data/meta.json` (synced 2026-08-29), and does the OPMCM block show items dated this week? Record both in the e2e report. Report 3's "Live over snapshot" claim was not verified; this step settles it.
- **Deliverables:**
  1. `SituationBand` carries its own line: "Source: NDRRMA · snapshot <BS date> (<relative>)" when data is bundled, "updated <relative>" when live, using W0-1 helpers. No block inherits a global "Live".
  2. A masthead dateline under the header on `/` via `formatDateline` (the unused `edition.ts` becomes used or is deleted).
  3. Hero rewritten in shopkeeper words, EN and NE, two short sentences: what is confirmed now, and what you can do here (ask for help, or help someone). It never mentions local updates (section 1.4). Delete the "explicit name search" sentence (`index.ts:68`). Eyebrow no longer names one flood. The five action cards keep their order and position.
  4. `/search` lead says what the box does (searches NDRRMA rescued and missing lists by name, Nepali or English) and keeps the OPMCM link as a second sentence; the contradiction at `find-person.tsx:99-105` is gone.
  5. Vocabulary: OPMCM badge (`home.tsx:490`) → `officialSource`; project committee badge (`project-detail.tsx:130-132`) → `checked` with the tooltip; nothing else on these pages says "Verified" except the brand name.
  6. The relief-goods band and flood CTA stop naming "Trishuli" in hard-coded copy; they read event name and dates from `relief-centers.json` meta and the flood manifest.
  7. `llms.txt` and `/info` about-copy describe the site as it is (checked record of disaster and relief information for Nepal), not a single-flood dashboard.
- **E2E on dev:**
  - Browser (CDP, 360x740 and 1280x800, both languages): home shows the dateline with a BS date; the situation band shows its own source line with a relative time; the hero contains no "explicit name search"; `/search` lead and box agree. Screenshots.
  - Nepali review: the owner or a named native speaker reads the new `ne` strings before prod dispatch #1 (owner action A-1).
- **Done when:** screenshots are in the report and the Nepali review is recorded.

#### [x] W1-C Backend: `kind: news` end to end (plan tasks T1, T2, T3, part of T6)

- **Codex:** `gpt-6.1-sol`, effort `high`.
- **Owns:** `server/**` only. Follow the TDD steps in the 20-task plan for T1, T2, T3 exactly, with these amendments:
  - `happenedAt` and at least one source are **required** for `kind: "news"`: either a `sourceUrls[]` entry or a `sourceNote` (a typed line of at most 200 characters, for example "Ward 3 office notice, 14 Oct" or "phone call with the ward chair, 14 Oct"). Owner decision Q9: real local news often has no link; the typed line, shown on the item next to the correspondent's name, counts as the source. Reject with 400 `missing: "source"` when both are absent.
  - **Daily submission limit, admin-configurable (Q11).** One settings item `PK: "SETTINGS", SK: "LOCAL_UPDATES"` with `{ dailyLimitEnabled: true, dailyLimit: 5 }` as the default when the item is absent. Routes: `GET /admin/settings/local-updates` and `PUT /admin/settings/local-updates` (admin only; `dailyLimit` integer 1-50). On `POST /me/articles` with `kind: "news"` by a non-admin, count the author's `ARTICLE` pointers (`listPointers`) whose dispatch is `kind: "news"` and `createdAt` within the last 24 h; when the limit is on and the count is at or above it, 429 `daily_limit` with `{ limit, resetsAt }`. Admins are exempt. Body 1200 characters, exactly one tag and at most three source URLs stay as fixed validator constants.
  - `expiresAt` is stored if given and never used to filter.
  - T6 is cut to the author ≠ reviewer rule, applied to `kind: "news"` only (403 `own_item`). Articles keep today's behaviour. District, language and national rules move to G-2.
  - `GET /dispatches?kind=news` and `GET /moderation/dispatches?kind=news` default to `article` so existing callers are unchanged.
  - Who may create news now: `auth.role === "admin"` or `auth.user.reporter?.approvedAt`. The admin user-update route accepts `reporter: { localities: [], nationalScope: false }` and stamps `approvedAt` (clearing it revokes), so the owner can onboard a correspondent by email from the Desk admin form (UI in W2-E). Apply flow, scope rules and rate limit stay in G-2.
  - Because there is no second moderator yet (Q6), author ≠ reviewer means an admin-authored item has nobody to publish it. The intended path is: the correspondent writes, the admin publishes. Document this in the rule card (W2-E).
- **Deliverables:** constants, validators, model and view fields, authoring API, moderation list filter, tests in `server/test/local-updates.test.js`; `server/test/articles.test.js` still green.
- **E2E on dev** (API, all with fixture tokens; this path avoids Turnstile):
  0. `admin-beta-tester`: set `reporter` on `helper-01-beta-tester` via the admin route → `GET /me` as that helper shows `reporter.approvedAt`; the helper can `POST /me/articles` with `kind: "news"`; `helper-02-beta-tester` (no flag) gets 403 `reporter_required`.
  1. `admin-beta-tester`: `POST /me/articles` with `kind: "news"`, a real cited item (a current OPMCM notice with place, `happenedAt`, one source URL, Nepali body under 1200 chars) → 201 draft. Submit → pending.
  2. Same admin tries to publish own item via the moderation route → 403 `own_item`.
  3. `moderator-beta-tester` publishes → 200; `GET /dispatches?kind=news` lists it; `GET /dispatches` (no kind) does not; `GET /dispatches/:id` shows `kind`, `locality`, `happenedAt`, `sourceUrls`.
  4. News with body over 1200 chars, or without `happenedAt`, or with neither a source URL nor a `sourceNote` → 400 with the named `missing` field. A news item with only a `sourceNote` and no URL → 201.
  7. Limit: `admin-beta-tester` `PUT /admin/settings/local-updates {dailyLimitEnabled:true, dailyLimit:1}`; `helper-01` creates one news item → 201, second → 429 `daily_limit`; admin sets `dailyLimitEnabled:false` → the helper's next create → 201; admin restores `{true, 5}`; `moderator-beta-tester` on the PUT → 403.
  5. Existing article flow: `helper-beta-tester` creates and submits an article, moderator publishes, article list unchanged.
  6. Content created here must read as real (Nepali place names, real OPMCM citation); record ids in the report.
- **Done when:** the eight checks (0 to 7) are in the report and the Lambda deploy run is green.

#### Prod dispatch #1 (immediately after Wave 1 is green on dev)

Owner decision Q12: push to prod immediately. The agent that closes the last Wave 1 lane runs `deploy-prod.yml` and `deploy-backend-prod.yml` as in section 2.4 and records the prod SHA in the e2e report. The Nepali read-through (A-1) happens on prod afterwards; copy fixes land as one follow-up commit and another dispatch. Section 1.4 rule 6 (Get help / Give help above the fold) is checked on prod too.

**Done 2026-10-14:** frontend and backend prod workflows both green on commit 28ccc09; prod home serves bundle `index-DcLfd9rM.js`, Nepali by default, dateline `बुधबार, असोज २८, २०८३`, Get help / Give help buttons end at 493 and 549 px at 360x740, `?kind=news` returns `{"items":[]}`, an unknown kind returns 400. Dev e2e: `docs/e2e/2026-10/E2E-TEST-REPORT.md`.

### Wave 2, the Now strip, the Desk queue, sharing (three lanes, parallel)

Start after Wave 1 is on `main` and dispatch #1 has run.

#### [x] W2-D The "Now" strip on `/` (replaces plan task T10)

- **Codex:** `gpt-6.1-sol`, effort `high`.
- **Owns:** `src/components/now-strip.tsx` (create), `src/pages/home.tsx` (the `OfficialUpdates` block and the position of the hard-wired August block only), `src/i18n/now.ts` (extend), `src/lib/now-items.ts` + `.test.ts` (create: pure normaliser).
- **Sources and labels** (one `NowItem { id, kind, title, place?, happenedAt, source: { label, url }, trust: "official" | "checked" | null, href, language }`):
  - **OPMCM `government-efforts`** (already fetched by `live.ts` for `OfficialUpdates`; reuse, do not refetch): trust `official`, title, agency as the place line (the feed has no district), `happenedAt = createdAt`, the `description` body text clamped to three lines (`line-clamp-3`, tap to expand), link out to the OPMCM page. Owner decision Q9: title, agency, time, link and body text may all be republished under "Official source".
  - **Ledger deliveries** `getLedger` (newest 10): "Delivered · <org or moderator label>", place = municipality + ward, `happenedAt = confirmedAt ?? redeemedAt`, trust `null` (no trust word on rows a moderator did not review), href `/ledger`.
  - **Published local updates** `GET /dispatches?kind=news` (newest 10): trust `checked`, place from `locality`, `happenedAt`, source = first source URL as a link, otherwise the `sourceNote` as plain text, href `/articles/:id`.
  - **Standing entries**, always last: Flood impact explorer and Ledger, labelled by what they are, no date.
  - Bundled relief centres are **not** rows (one global `last_verified`, no per-row date). API centres can join later when they carry `verifiedAt`.
- **Behaviour:** at most two new requests on `/` (ledger, news); sorted by `happenedAt` desc; ten rows then "See all"; every row: place or agency, title, relative time (W0-1), source link, EN/ने chip from the item language, trust label from `nowStrings`. Each row has the `ShareButton` with a text share (title + place + relative time + URL) for WhatsApp, Viber and copy; PNG cards only for rows that have their own permalink (news items), via the existing card pipeline. Empty state: "Nothing new since <relative time of the latest item>" and the standing entries; never a blank heading. The block replaces `OfficialUpdates` **in its current position** (`home.tsx:213`, below the situation band and relief map). It does not move above the hero or the five action cards (section 1.4).
- **Tests:** `now-items.test.ts` covers each adapter, the sort, the ten-row cap, the empty state and the Devanagari digit rendering of a relative time.
- **E2E on dev:** dev has 27 ledger rows and the W1-C news item, so every source renders. Browser (CDP, 360x740, `ne` then `en`): strip shows OPMCM rows labelled आधिकारिक स्रोत, a ledger row with place and "Delivered", the news item labelled जाँच गरिएको with a source link, standing entries last; a Viber share link on a row has the `viber://forward?text=` scheme; conjunct-heavy Nepali in a PNG card renders correctly (if glyphs break, open G-5 fonts). Record request count on `/` before and after (must be at most two more). An OPMCM row shows its body text clamped. Screenshots, including the section 1.4 rule 6 shot of `/` with Get help / Give help above the fold. Note in the report that prod day one will show OPMCM rows plus standing entries only, until supply exists.
- **Done when:** the above is in the report.

#### [x] W2-E Desk "Local updates" queue and admin-only authoring (plan tasks T14, T11)

- **Codex:** `gpt-6.1-sol`, effort `medium`.
- **Owns:** `src/desk/local-updates.tsx` (create), `src/desk/desk.tsx`, `src/desk/use-desk.ts`, `src/i18n/desk.ts`, `src/articles/editor.tsx`, `src/articles/my-articles.tsx`, `src/desk/admin.tsx`, `src/i18n/local.ts` (create), `src/pages/me.tsx` (entry point only).
- **Deliverables:**
  1. Desk tab "Local updates" under `group: deskGroupPublish` (today's sidebar grouping), admin and moderator. Rows show title, body, scope, locality, `happenedAt`, sources inline; one-click Publish / Reject with reason; Publish hidden when the viewer is the author (server enforces). Rule card: "Reject if no source, no place, or no date." plus a corrections line ("If something published turns out wrong, correct it and say what changed.") and the PCN 2083 checklist (official source for deaths or missing; no faces of the dead, grieving families or children; label AI imagery; correct immediately with an explanation). Rule card text bilingual in `desk.ts`.
  2. Authoring: "Write a local update" visible to admins (and users with `reporter.approvedAt`) from `/me` and the articles list. Form reuses the article editor in a reduced mode: title, body (paragraphs and one image), language (EN/NE), `MunicipalitySelect` + ward input (existing components; the `LocalityPicker` of T8 is gated), scope radios Ward → Nepal, `happenedAt` (native `<input type="datetime-local">`), sources: up to three URLs **or** one typed source line ("Where this comes from", placeholder "Ward 3 office notice, 14 Oct"), at least one of the two required; exactly one tag. Validation messages mirror the server's `missing` codes, including 429 `daily_limit` ("You have filed <n> updates today; try again <relative time>").
  3. "My local updates" list under `/me` with statuses, reusing `my-articles.tsx`.
  4. Admin form (`src/desk/admin.tsx`, add to owned files): a "Local correspondent" toggle on a user row, found by email as today; sets or clears the flag through the W1-C admin route; the admin list shows a "Correspondent" badge.
  4b. Admin settings card "Local updates" on the same admin page: a switch "Daily limit per correspondent" and a number input (1-50, default 5), saved through `putLocalUpdateSettings`; shows the saved value and who last changed it if the API returns it. Queue rows and the detail view show `sourceNote` inline when there is no URL.
  5. Rule card also says: "You cannot publish your own update. The correspondent writes, a moderator publishes."
  6. Language chip on the detail page is **not** here (W2-F owns `dispatch-detail.tsx`).
- **E2E on dev:**
  - Browser (CDP, signed in via the test form): as `admin-beta-tester` onboard `helper-01-beta-tester` as a correspondent from the admin form; as that helper write a real local update (current OPMCM or municipal notice, Nepali, cited), submit; as `admin-beta-tester` see it in the Desk tab with sources inline, publish; it appears on `/` in the strip (W2-D) and in `GET /dispatches?kind=news`. As the helper, confirm the Publish button is absent on own item. Reject path with a reason; `/me` shows "rejected" with the reason. Settings card: set the limit to 1, file two updates as the helper, the second shows the limit message; switch the limit off, the third goes through; restore 5. File one update with a typed source line and no URL; it publishes and the queue shows the line. Screenshots of the queue, the form at 360 px in Nepali, the settings card and the rule card.
  - Run after W2-D is merged for the strip check; everything else can run before.
- **Done when:** the loop submit → queue → publish → strip is in the report with ids.

#### [x] W2-F Sharing: Viber everywhere, news share meta, detail-page eyebrow (plan task T12 share half + quick win 10)

- **Codex:** `gpt-6.1-sol`, effort `medium`.
- **Owns:** `src/components/share-button.tsx`, `src/pages/dispatch-detail.tsx`, `src/pages/dispatches.tsx` (list row date only; W1-A's Write-button change is already merged), `src/pages/incidents.tsx`, `src/lib/og-meta.ts`, `functions/articles/[id].ts`, `src/i18n/articles-public.ts` (share strings).
- **Deliverables:**
  1. Viber (`viber://forward?text=`) added beside WhatsApp and Facebook in every share row; icon + label, 44 px; the `ShareButton` text share includes title, place, relative time and URL.
  2. `dispatch-detail.tsx`: for `kind === "news"` an eyebrow "Local update / स्थानीय अपडेट", a locality chip (district · municipality · ward), "Happened <BS date> (<relative>)", the EN/ने chip, the `checked` label with tooltip, and a "Sources" list from `sourceUrls` plus the `sourceNote` as a plain line when present. Article pages unchanged except relative time next to the absolute date.
  3. `dispatches.tsx` and `incidents.tsx` list rows show relative time (W0-1) with the absolute date in `<time dateTime>`.
  4. `og-meta.ts` `dispatchMeta` and `functions/articles/[id].ts` handle `kind: "news"`: title, description from the body, locality in the description, `inLanguage` from the item language, JSON-LD `datePublished` from `happenedAt`. No `NewsArticle` type, no `article:*` OG tags (dropped until supply exists).
- **E2E on dev:** Browser: open the W1-C news item; eyebrow, chip, Happened line, sources, Viber link present at 360 px in Nepali; `curl -A facebookexternalhit https://dev.verifiednepal.com/articles/<id>` returns OG title/description with the locality and `inLanguage` `ne`. An article page still renders as before. Screenshots.
- **Done when:** in the report.

#### Prod dispatch #2 (immediately after Wave 2 is green on dev)

Same as dispatch #1: the agent closing the last Wave 2 lane runs both workflows and records the SHA.

**Done 2026-10-14:** frontend prod workflow green on commit 2173be8 (no server changes since dispatch #1, so the backend workflow was not re-run); prod home serves `index-NaMv9Ese.js`; strip shows three OPMCM rows plus the two standing entries, Get help / Give help end at 493 and 549 px, `?kind=news` empty. Dev e2e: `docs/e2e/2026-10/E2E-TEST-REPORT.md`. From this point the first correspondent's ten local updates (A-2) are authored on prod.

### Wave 3, docs and housekeeping (one lane, any time after Wave 1)

#### [x] D-1 Documents: stale text, PDF defects, plan dispositions

- **Codex:** `gpt-6-luna`, effort `low`.
- **Owns:** `docs/NEWS-PORTAL-DECISIONS.md`, `docs/superpowers/plans/2026-10-14-local-updates.md` (header only), `docs/public-audit-2026-10/reports/*.md`, `docs/public-audit-2026-10/research_notes/**/verified_nepal_public_site_inventory.md` (§11, §12 notes), `docs/public-audit-2026-10/VerifiedNepal-Public-Site-Audit-2026-10.pdf`, `CONTRIBUTING.md` (workflow line), `docs/FEATURES.md`.
- **Deliverables:** row 5 of the decisions table no longer says "Works with post-moderation"; a line under "Build order" points to this plan for sequencing; the 20-task plan gets a header note "Sequenced by docs/PUBLIC-SITE-ACTION-PLAN-2026-10.md; T10 replaced, T6/T13 cut, T18/T19 gated"; Report 2 "62% primary" → "62% use"; posting window "6-10 pm"; Report 3 §2.1 opening claim softened to what the inventory supports and the three swallowed placeholders escaped as code spans; inventory §11/§12 get a dated "superseded" note; the PDF regenerated with the same headless-Chrome pipeline (README describes it) and `pdfinfo` page count recorded; `CONTRIBUTING.md:55` describes worktree → gates → merge to main → dev auto-deploy; `FEATURES.md` gains a "Now strip and local updates" section after W2.
- **E2E:** `pdftotext` grep shows the three placeholders; markdown link check on the edited files.

---

## 4. Gated items (not dispatched until the gate opens)

| Id | Scope | Gate | What changes when it opens |
|---|---|---|---|
| **G-1 Locality layer** | Plan T4, T5, T7, T8, T9, the "Your area" and list-filter parts of T10, T12 sitemap half, quick win 16 (Roman-Nepali transliteration in the picker and `/search`) | Ten published local updates in one municipality **and** Reach tab shows the strip is clicked (A-6) **and** owner go | Collapse rule = empty tier collapses (not "fewer than three"); no `expiresAt` filtering; picker accepts Roman input; `/dispatches/local` stays at two queries; nav entry under "More". Models: T4 tiering `gpt-6-astra` high; the rest `gpt-6.1-sol` high. |
| **G-2 Correspondents and reviewer rules** | Plan T13, rest of T6, T15, T16, T17, plus three new tasks: edit-after-publish returns the item to pending (today 409), a `POST /dispatches/:id/flag` route feeding the FLAGGED queue, and the three-rejections-in-90-days flag on the admin list | At least two active moderators besides the owner (Q6: none today), else the scope rules deadlock the queue; the first correspondent is onboarded by email in W2-E without waiting for this | T17 profile URL uses a handle or request id, never the raw auth `sub`. Queue language filter server-side. Models: reviewer rules `gpt-6-astra` high; the rest `gpt-6.1-sol`. |
| **G-3 Ads** (feature built 2026-10-14, marketing gated) | Plan T18, T19 (ADS-A backend, ADS-B frontend) | Owner decision 2026-10-14: build the feature now. **Selling or running ads waits for the DoIB registration certificate (A-3).** Safety default: with no ad item the public endpoint returns `ad: null` and no page changes; the Desk ads section carries a warning not to run paid ads before registration. | Only the `articleEnd` slot is placed (detail pages); `localTop` waits for the locality page (G-1). **Deployed to prod 2026-10-14 (commit bf0a238), no ads created; prod `/ads` returns `{"ad":null}`.** |
| **G-4 `feed.xml`** | Quick win 11 | 30+ published items **and** registration done (a feed reads as a news portal) | Clone the sitemap fetch loop; `gpt-6-luna`. |
| **G-5 Self-hosted fonts** | Quick win 8 | W2-D's PNG-card conjunct check fails, or a measured first-paint problem on 4G | Two Devanagari weights (400/600) + two Latin, `index.html` and `styles.css`; `gpt-6.1-sol` medium. |
| **G-6 `sameAs` and footer Facebook link** | Quick win 15 | Owner has created the page (A-5) | Ten-minute `gpt-6-luna` run. |

## 5. Not in this plan

Stopped by the council and accepted here: AI writer, condolences, ad-manager role, comments, push, dark mode, Nepali URLs / `hreflang`, SSR, volunteer hours on climate-magazine articles. Also not dispatched: a `/now.json` export, Meta Graph auto-posting, open licensing of feeds, BIPAD as a strip source (unverified), `article:published_time` OG tags, "remove the `/stories` link" (no such link exists), the www redirect (already a 301). `/climate` and `/our-message` are demoted under "More" in W1-A; retire-or-keep is owner question Q4.

## 6. Disposition of the 20 tasks

| Task | Disposition |
|---|---|
| T1, T2, T3 | Kept as written, with the W1-C amendments (required `happenedAt` and source, no expiry filter) |
| T4, T5 | Gated G-1 |
| T6 | Cut to author ≠ reviewer on news only (W1-C); remainder gated G-2 |
| T7, T8, T9 | Gated G-1 (collapse on empty; Roman input in the picker) |
| T10 | Replaced by W2-D; "Your area" and list filter gated G-1 |
| T11 | W2-E, admin-only, using `MunicipalitySelect` instead of the gated `LocalityPicker` |
| T12 | Share-meta half in W2-F; sitemap half gated G-1 |
| T13 | Gated G-2 |
| T14 | W2-E with the `group:` nav shape and the extended rule card |
| T15, T16, T17 | Gated G-2 (T17 without raw `sub` in the URL), plus three new G-2 tasks |
| T18, T19 | Built as ADS-A and ADS-B on 2026-10-14 (owner decision); no ads are created until registration |
| T20 | Folded into each wave's commits and D-1 |

## 7. Owner actions and questions

### Actions only the owner can do

| Id | Action | Blocks |
|---|---|---|
| A-1 | Nepali read-through of the Wave 1 strings on prod (owner/admin, per Q7); fixes ship as a follow-up commit. Owner 2026-10-14: "looks good for now" | Done for now |
| A-2 | Onboard the first correspondent by email from the Desk admin form (W2-E); they write the first ten local updates from real, cited sources; the admin publishes each (the admin cannot publish their own items) | G-1 gate, Wave 2 e2e on prod |
| A-3 | Confirm registration rules with DoIB directly **and** the Bagmati Province Communication Registrar's Office (fees, named editor, staffing, renewal); start entity formation if proceeding | G-3, any public use of "news" / "reporter" |
| A-4 | Submit the sitemap in Search Console | SEO plan Phase 0 |
| A-5 | Social-media handler creates the owned Facebook page and posts the evening card (6-10 pm). Owner 2026-10-14: no page yet | G-6, distribution claim |
| A-6 | Read the Desk Reach tab at day 28 after dispatch #2: if the strip gets no clicks and nothing new is filed, G-1 does not open | G-1 |
| A-8 (owner agreed 2026-10-14) | Before Baisakh 2084 (14 April 2027) and each year after, check `src/lib/bs-calendar.ts` month lengths for the coming BS year against the published Nepali calendar (patro); one agent run with `gpt-6-luna` fixes the table | Correct masthead dates from June 2027 |
| A-7 | Authorised on 2026-10-14: agents run prod dispatches #1 and #2 themselves right after each wave is green on dev; the owner reads prod afterwards | None |

### Questions to answer (each blocks or shapes an item)

1. **Who writes the first ten local updates, and which moderator publishes them?** Answered: one correspondent onboarded by email from the admin portal writes; the admin publishes (A-2).
2. **Who creates the Facebook page and posts the evening card?** Answered: the social-media handler; page coming soon (A-5).
3. **Who is the named person accountable for "Checked"…** Answered: accepted; the publishing moderator is accountable. W0-2 tooltip copy stands; the audit entry already records the moderator.
4. **`/climate` and `/our-message`: retire or keep under "More"?** Answered: keep under More.
5. **Are GOVERNANCE.md and MODERATION-GUIDELINES.md fit to link publicly verbatim?** Answered: verbatim is fine, but keep them inside the signed-in portal as a guide (W1-A item 6).
6. **How many active moderators are there besides you?** Answered first as none; updated 2026-10-14 evening: `laxman.pokhrel.101@gmail.com` is already a moderator, so there is one moderator besides the admin and a correspondent's update can be published by either. G-2 reviewer rules still wait for a second moderator and named correspondents.
7. **Who reviews the Nepali strings before prod dispatch #1?** Answered: the admin (A-1).
8. **Has DoIB entity formation started…** Answered: not yet, starting soon. G-3 stays gated; public naming stays "local updates".
9. **May the strip republish OPMCM title, agency and link verbatim under "Official source", and may a named correspondent stand as the source when no URL exists?** Answered: yes to both, and keep the OPMCM body text as well. W2-D shows title, agency, time, body (clamped) and link; W1-C accepts a typed `sourceNote` as an alternative to a URL, at least one required.
10. **PMDRF QR and committee wallet details: keep, or link out only?** Answered: keep. No change.
11. **Local-update limits: body 1200 characters, exactly one tag, up to three sources, five submissions per day. Confirm or change before G-1.** Answered: the daily limit is per correspondent and becomes an admin setting in the Desk admin page (on/off plus the number, default on at 5; W1-C routes, W2-E card). Body, tag and source-count limits stay as validator constants.
12. **Prod cadence: dispatch #1 as soon as A-1 is done, or hold until Wave 2 and ship once?** Answered: push to prod immediately after each wave is green on dev; agents run the two workflows (section 2.4); the Nepali review follows on prod.

## 8. Success measure

The strip exists to be cited. At day 28 after prod dispatch #2, from the Desk Reach tab and the ledger: number of strip rows that are local updates (target ten in one municipality), page views of `/` in Nepali vs English, clicks on strip rows, and whether anyone besides the owner has filed an item. If none of these move, stop at Wave 2 and revisit supply before building the locality layer. Nothing in G-1 to G-3 starts on a feeling.
