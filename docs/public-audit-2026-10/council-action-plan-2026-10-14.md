# Council transcript: one action plan for the public side (2026-10-14)

Round run to reconcile the public-site audit, `docs/NEWS-PORTAL-DECISIONS.md` and the 20-task local-updates plan into `docs/PUBLIC-SITE-ACTION-PLAN-2026-10.md`. Five advisors (Sonnet subagents), five anonymised peer reviews, chairman synthesis. Facts the session verified after the advisors wrote (OPMCM feed live with 100 items, dev data counts, existing date helpers, www redirect already live) are carried into the chairman prompt and the final plan.

---

# Part 1. Framed question

# Council question (2026-10-14): one prioritised, agent-executable action plan for Verified Nepal's public side

## The decision

The owner of verifiednepal.com (a volunteer-run, bilingual EN/NE, mobile-first disaster-response and mutual-aid site for Nepal) has three documents that must become ONE action plan that coding agents execute one item at a time, in priority order:

1. **The public-site audit** (`docs/public-audit-2026-10/`): seven research notes, three reports, and an LLM-council verdict. Verdict headline: the public side should become "Nepal's checked record", a Nepali-first status board of short, dated, ward-located, sourced items distributed as share cards into Facebook/WhatsApp/Viber; not a magazine, not a 101st news portal. Council sequence: **Phase 0 "honesty"** (un-hardwire `/` from the August 2026 flood, relative time + Bikram Sambat dates, snapshot label instead of "Live", hide empty `/articles` `/projects` `/incidents` from nav, remove dead `/stories` link, six-item menu, Nepali default on first visit, hero rewrite, fix `/search` contradiction, two words only "Official source / आधिकारिक स्रोत" and "Checked / जाँच गरिएको", link GOVERNANCE + MODERATION-GUIDELINES publicly, corrections line + PCN 2083 checklist on the Desk rule card, drop the 1.5 MB `rescued-persons.json` from the service-worker precache, self-host two Devanagari weights). Then **Phase 1** = owner's build-order step 1 (`kind: news` + validator + Desk queue) PLUS a public home "Now" strip fed from four sources already ingested (OPMCM notices, drop-centre verifications, ledger deliveries, published news items), each row with place, happenedAt, source link, relative time, EN/ने chip, PNG share card with Viber added, and an owned Facebook page posting 6-9 pm. **Phase 2** = locality page + picker (Roman-Nepali input lands here), gated on one municipality holding ten published items. **Phase 3** = correspondent role. **Ads wait for the DoIB registration certificate.** Stop: AI writer, condolences, ad-manager role, comments, push, dark mode, Nepali URLs/hreflang, SSR, volunteer hours on climate articles. Demote `/climate` and `/our-message` from primary nav (owner to decide retire-or-keep).

   Report 3 §7 lists 17 quick wins (0.1-2 days each) with file paths; items 1-6, 9, 14, 17 are Phase 0 (about 3 working days total). Other wins: Viber share + `article:published_time` OG tags; `/feed.xml` Function; GOVERNANCE/MODERATION pages; `llms.txt` + `/info` un-hardwired; Roman-Nepali→Devanagari transliteration for `/search` (2 d); Nepali skip link + chat greeting; `Organization.sameAs` once a Facebook page exists; www→apex redirect (infra repo, Terraform) and Search Console sitemap submission (owner).

   Confirmed on prod 2026-10-14: `/dispatches`, `/stories`, `/centers`, `/incidents`, `/projects`, `/ledger` all return `{"items":[]}`; `/audit` empty Aug-Oct. Supply is zero. Home status bar says "Live · updated 08:23" over a bundled NDRRMA snapshot `synced_at 2026-08-29`.

2. **The owner's decisions doc** (`docs/NEWS-PORTAL-DECISIONS.md`, 2026-10-14, authoritative over the council): local updates = `kind: "news"` on the existing DISPATCH item; PRE-moderation (same pending→published path as articles, own Desk queue, "Reject if no source, no place, or no date", scope-based reviewer rules against friend-approves-friend, 5 submissions/24 h); reporter is a flag on USER, not a role; public naming "Local updates" / "local correspondents" (never "news", "reporter", "news portal" in public copy) until VerifiedNepal itself registers with DoIB; `/local/<municipality>` page with picker and Ward→Municipality→District→Nepal tiers, empty tiers collapse; all 753 local levels available, only ones with published items listed; two labelled ad slots, admin-only AD item; condolences, AI writer, ad-manager deferred. Build order: (1) news kind + validator + Desk queue, (2) locality GSI + `/local` page + picker + "Now" strip, (3) reporter role, (4) ads, (5) later items.

3. **The 20-task implementation plan** (`docs/superpowers/plans/2026-10-14-local-updates.md`, 117 KB, TDD steps per task, nothing implemented): Phase A backend (T1 constants/validators, T2 dispatch model + GSI1 `DISPATCH#LOC#<district>`, T3 authoring API accepts news, T4 pure tiering helper, T5 `GET /dispatches/local`, T6 reviewer rules), Phase B public UI (T7 locality storage + tier collapse, T8 strings + LocalityPicker, T9 `/local` page, T10 home "Your area" block + detail chip + list filter, T11 authoring form, T12 share meta + sitemap), Phase C Desk (T13 moderator languages/national flag API, T14 Desk "Local updates" queue + admin form), Phase D correspondents (T15 request model/API, T16 apply from `/me` + approve on Desk, T17 public byline/profile), Phase E ads (T18 ad model/API, T19 AdSlot component + Desk ads), T20 docs. The plan's "Now"/"Your area" block (T10) renders only local-update items and only when a reader has saved a locality; it does NOT include OPMCM/centre/ledger rows, relative time, BS dates, share cards or Viber. The plan assumes "one PR per phase, main is protected".

## Where the three already differ (from Report 3 §6)

| Topic | Decisions doc / plan | Council | Nature |
|---|---|---|---|
| First thing to ship | Backend step 1 | Phase 0 honesty fixes, then step 1 + a public "Now" strip from existing data | Council front-loads visible change |
| "Now" strip | Step 2, local updates only, needs saved locality | Phase 1, all dated items (OPMCM, centres, ledger, news), no locality needed | Scope + timing |
| Step 2 trigger | Day one, only localities with items listed | Gate on one municipality with ten items | Go/no-go threshold |
| Ads | After reporter role | After DoIB certificate; entity formation starts now | Legal gate |
| Articles / climate / our-message | Not addressed | Hide empties, demote climate/our-message, stop climate articles | New |
| Distribution (FB page, Viber, cards, RSS) | Not addressed | Daily 6-9 pm card, Viber, feed | New |
| Stop list | Defer AI writer, condolences, ad manager | Also stop comments, push, dark mode, Nepali URLs, SSR | Wider |

Nothing in the council sequence reverses a settled owner decision.

## Execution constraints the plan must satisfy (owner's rules, fixed)

- Every feature is built in its own **git worktree** off `main`, merged to `main` directly (owner is admin; branch protection has `enforce_admins: false`, required check `check` from `ci.yml` applies to PRs only), which auto-deploys the frontend to `dev.verifiednepal.com` (`deploy-dev.yml` on push to main) and the backend Lambda when `server/**` changed (`deploy-backend-dev.yml`). Prod deploys are manual `workflow_dispatch` by the owner.
- **All code changes are made by Codex CLI** (`codex exec --dangerously-bypass-approvals-and-sandbox -m <model> …`), never by hand. Available codex models: `gpt-6-astra` (frontier, hardest work), `gpt-6.1-sol` (latest workhorse), `gpt-6-sol`, `gpt-6-luna` (fast/cheap, current default), `gpt-reserve` (fast agentic coding), older 5.6 family. Reasoning effort low→ultra selectable. The plan must assign a model per item.
- **Maximise parallel agents** for independent items (disjoint files; per-area i18n files; shared helpers committed first). Known hazard: Lambda concurrency is 10 per AWS account, so parallel browser drivers against dev while the Desk is open throttle to 503.
- **Every item must state deliverables and how to test end-to-end on dev**: dev has password fixture accounts (helper/moderator/admin `*-beta-tester@verifiednepal.com`), a dev-only test sign-in on `/desk/login`, API at `https://api.dev.verifiednepal.com`, Turnstile blocks headless browsers for anonymous writes (verify via API or signed-in flows), headless Chrome over raw CDP for screenshots, prior reports in `docs/e2e/<date>/E2E-TEST-REPORT.md` (table of API checks + browser checks + findings). Dev data must look real (no "test"/"seed" markers).
- Gates: `pnpm typecheck && pnpm test && pnpm build` at root, `cd server && pnpm test`, `pnpm format`. No new runtime deps. Bilingual every string. Commits plain, no trailers.
- Owner-blocked items exist (DoIB entity formation, Facebook page creation, Search Console sitemap submission, infra-repo Terraform for www redirect, Turnstile test keys on dev). Agents cannot do these.

## What the council is asked

Given all of this, what should the ONE prioritised action plan look like?

1. **Order**: what goes first, what parallelises in the same wave, what is strictly sequential, and what is gated (on owner action, on content supply, on DoIB)?
2. **Changes to the 20-task plan**: which tasks need rewriting to absorb the council's verdict (e.g. T10 "Your area" vs the council's four-source "Now" strip; relative time + BS dates as a shared helper; "Checked" vocabulary; Viber + share cards; T18/T19 gated), and which stay exactly as written?
3. **Drop or defer**: of the 17 quick wins, the 20 tasks and the council's new recommendations, what should NOT be in the plan at all, so agents are not spent on it?
4. **Questions only the owner can answer** before or during execution.

What's at stake: one owner plus volunteers, limited agent budget (rate limits have been hit before by over-parallelising), a public site whose "verified, not viral" promise is currently contradicted by a stale home page and empty surfaces, and legal exposure if "news" or ads ship before DoIB registration. A wrong order wastes weeks of agent time on a locality layer nobody can see, or ships a visible change that breaks the article flow.

Source files you may read for grounding (repo root `/home/lxu/workspace/laxman/verifiednepal`): `docs/public-audit-2026-10/council-verdict.md`, `docs/public-audit-2026-10/reports/3-verified-nepal-alignment-audit.md` (§6, §7 especially), `docs/NEWS-PORTAL-DECISIONS.md`, `docs/superpowers/plans/2026-10-14-local-updates.md` (headings and "Locked technical decisions" are enough).


---

# Part 2. Advisor responses

**The Expansionist:** (Response A)

**Order**

The council's Phase 0 and the owner's step 1 have no shared files, so run both from day one in separate worktrees. This is two waves, not a sequence.

- **Wave 0, same day, parallel:**
  - Quick wins 1-6, 9, 14, 17 and 12.
  - Pull QW7 (relative time and BS dates) out as a shared helper, `src/lib/format-date.ts`, and commit it first. Every later row, card, feed and byline reads it, so it compounds the most.
  - Backend T1-T3 in a second worktree.
- **Wave 1, after the helper lands:**
  - A single `NowItem` adapter that normalises OPMCM, centre verifications, ledger deliveries and news into one shape: place, happenedAt, source, language.
  - Build the strip, the share cards, `/feed.xml` (QW11), a public `/now.json` and `llms.txt` (QW14) on that adapter.
  - Add QW10 (Viber) in the same wave.
  - T4-T6 run parallel on the backend.
- **Gated:** T7-T9 and T12 wait for one municipality with ten items. T15-T17 wait for T14. T18-T19 wait for the DoIB certificate.

**Changes to the plan**

- **Rewrite T10.** Make it the four-source Now strip. A saved locality becomes a lens on that strip, not a separate "Your area" block. The strip is the product, and locality becomes a filter on it.
- **T12 grows** into per-row PNG cards, reusing the existing og-card Function. Every ledger delivery becomes a postable card. That is the viral unit, and ward chairs will share it.
- **Pull QW16 (transliteration) forward** into Wave 1. "Does my palika have X" is the real reader query.
- **Add one task:** a card and auto-post pipeline for the 6-9 pm Facebook slot, with the strip as its source.
- **T1-T6 and T11 stay exactly as written.**
- **Point T15 at ward chairs, verified orgs and NGOs first.** They already file deliveries, so the ten-item gate can be met without recruiting reporters.

**Drop or defer**

- Defer T17 (byline profile), T18, T19 and the "national" half of T13.
- Defer QW8 (self-hosted fonts) behind everything else.
- Don't spend agents on QW13 or QW15, which are owner-only.
- Don't build `/climate` articles. Do keep the country-slogan share cards. They are a free distribution asset, so demote them in nav but don't retire them.

**Models**

- `gpt-6-astra` for the adapter and card pipeline.
- `gpt-6.1-sol` for T4-T6 and T10.
- `gpt-6-luna` for copy, nav and i18n tasks.

Keep Wave 0 to at most three parallel Codex runs, because of the rate limits.

**Owner questions**

1. Which org or municipality is the pilot? A Rasuwa ward chair is the obvious hook. Can that person file deliveries this month?
2. May verified-org ledger entries auto-appear in the strip as "Official source", or must each one pass a moderator?
3. Do you want `/now.json` and `/feed.xml` openly licensed for reuse by other portals and NGOs?
4. Will you create the Facebook page this week and authorise Meta Graph auto-posting?
5. Retire or keep `/climate` and `/our-message`?

---

**The Executor:** (Response B)

**Executor view: ship Phase 0 plus step 1 plus the Now strip in three waves. Nothing in Phase 2 or later starts until a gate opens.**

**Wave 0: serial, one agent, ~0.5 d (`gpt-6.1-sol`).** Land these on `main` first. Every later agent imports them.
- Relative-time and BS helper (QW7), in `src/lib/format-date.ts` with a test.
- The two-word vocabulary (QW6), in a new `src/i18n/now.ts`.
- Client types and `api.ts` entries for `kind` and `locality`. Pull these out of T7. Otherwise T11, T14 and the Now strip all collide in `src/lib/api.ts` and `src/lib/types.ts`.
- T1 constants and validators.

**Wave 1: 3 parallel agents (`gpt-6-luna`, `gpt-6.1-sol` for the backend).** Cap at 3 because of rate limits and the Lambda limit of 10.
- **A, chrome:** QW2, QW3, QW4, QW17. Files: `site-header.tsx`, `site-status-bar.tsx`, `App.tsx`, `dispatches.tsx`, `chat-widget.ts`. QW1 also edits `site-status-bar.tsx`, so QW1's status-bar part goes to agent A.
- **B, home de-stale:** QW1 (minus the status bar), QW5 and QW14. Files: `live.ts`, `home.tsx`, `i18n/shell.ts`, `i18n/index.ts`, `find-person.tsx`, `llms.txt`, `info-help.tsx`. Include the `home.tsx:490` vocabulary line from QW6.
- **C, backend:** T2 then T3, then a minimal T6 (author ≠ reviewer only). Server files only, so it is disjoint from A and B.
- QW9 is a 0.25 d one-liner in `vite.config.ts`. Hand it to whichever agent finishes first.
- **Verify on dev:**
  - Use the 360 px CDP screenshot to check there is no "Live" label, the nav has six items and there is no `/stories` link.
  - Check the snapshot label by API.
  - Run `pnpm test`.
  - Sign in as admin, POST a `kind: news` draft, submit it, publish it as moderator, then GET it. This avoids Turnstile.

**Wave 2: 3 parallel agents, after wave 1 is merged.**
- **D, Now strip:** a new `src/components/now-strip.tsx` that replaces the hard-wired August block in `home.tsx`. It carries a `ShareButton` per row. It reads OPMCM, centres, ledger and news, with news added once T3 is merged.
- **E, Desk and editor:** T14 (`src/desk/*`) and T11 (`src/articles/editor.tsx`, using the existing `MunicipalitySelect`, not T8).
- **F, share:** T12 together with QW10, because both touch `og-meta.ts`.
- **Prod caveat:** the ledger, centres and news endpoints are all empty on prod. Day one the strip will show OPMCM rows only, so say so in the acceptance test. Seed realistic items on dev to exercise it.

**Order changes to the plan**
- T1 to T3 stay as written.
- T6 is cut to author ≠ reviewer now, because only admins can create news until T15. Move the rest of T6 and all of T13 to just before T15.
- T10 is replaced by the Now strip. T10's detail chip and list filter go with T9 in Phase 2.
- T18 and T19 are blocked on the DoIB certificate. Do not dispatch them.

**Gated, do not dispatch**
- T4, T5, T7, T8, T9 and T10 wait for one municipality holding ten published items.
- T15 to T17 wait until real correspondents are named.
- T20: update docs inside each wave's commits instead of as a final task.

**Drop or defer**
- QW16 (transliteration) is deferred into Phase 2 with the picker. It costs 2 d for no visible win today.
- QW11 (feed.xml) is deferred because there is nothing to feed.
- QW12 shrinks to two footer links to the GitHub blob URLs. That is 0.1 d, not 0.5 d.
- QW8 (fonts) is optional in wave 2 and only if budget remains.
- QW15 is a 0.1 d change once the owner has a Facebook page URL.
- QW13 belongs to the owner.

**Owner questions**
1. Besides you, how many active moderators are there? That decides whether the reviewer rules matter yet.
2. Do you retire or keep `/climate` and `/our-message`?
3. Who creates the Facebook page, and who posts the 6-9 pm cards?
4. Who are the first named correspondents? Without them, Phase 2 never starts.
5. Is the Rs 5,000 DoIB entity step moving, and who owns it?

---

**The Contrarian:** (Response C)

**Order**

1. Wave 1, in parallel on disjoint files:
   - Frontend honesty fixes: QW 1, 2, 3, 4, 5, 6, 9, 14, 17.
   - Backend T1-T5, which touch only `server/**`.
   - Treat `home.tsx`, `site-header.tsx` and `i18n/shell.ts` as one lane. Several items touch them, so run one agent there.
2. Next, as a serial gate: QW7 (relative time and BS helper), then QW8 (fonts). The share cards render to canvas, so they need the self-hosted Devanagari weights. Fallback glyphs will break conjuncts.
3. Then the Now strip and cards (with QW10 Viber), then T14 and T11.

**Flaws in the council plan**

- **Supply is zero, and the plan never names who posts.** The strip's "already ingested" sources are stale: the NDRRMA snapshot is from 29 Aug and centres were last verified 8 Sep. A strip reading "46 days ago" is honest, but it still looks dead. Before building, count the rows the four sources produce on prod today. Define the empty state first.
- **Lambda concurrency is 10, and the 1,000 request is still pending.** A 6-9 pm Facebook card sends a spike at a home page that fires four fetches. Build one cached `/now` endpoint, or a static JSON on the CDN.
- **QW2 hides nav items "when their list is empty".** That makes nav depend on runtime fetches, so it flickers and adds load. Remove the links statically.
- **"Checked" overclaims.** The moderation rule is "reject if no source, place or date". That is a completeness check, not verification.
- **QW7's BS date table needs fixtures.** A wrong BS date is the worst bug on a site called the checked record.

**Changes to the 20 tasks**

- **T10:** rewrite it into the four-source Now strip. Drop the saved-locality dependency.
- **T6:** keep only author ≠ reviewer. The district, language and national rules need three or more moderators, and with one or two they deadlock the queue.
- **T13:** defer it for the same reason.
- **T7-T9, T12:** gate them on ten published items in one municipality.
- **T11, T14:** keep them, but start them after the Now strip.

**Drop or defer**

- **T18/T19:** do not build ads. Unused ad code on prod is pure exposure.
- **T15-T17:** defer. Set the reporter flag by hand until there are real correspondents.
- **QW11 (`/feed.xml`):** drop it. Nobody reads RSS in Nepal, and a feed reads as a news portal before registration.
- **QW16 (transliteration):** defer to Phase 2.
- **QW13, QW15:** owner-blocked, so no agent time.

**Owner questions**

1. Name the first three people who will post local updates, and the dates. Without them Phase 1 ships a strip of stale scrapes.
2. Is posting newsy cards from a Facebook page called "Verified Nepal" before the entity exists acceptable to you? Does it conflict with "never call it news"?
3. Retire or keep `/climate` and `/our-message`?
4. Is anything in MODERATION-GUIDELINES or GOVERNANCE unfit to publish verbatim (QW12)?
5. Who is the second moderator? Without one, the pre-moderation queue stalls on author ≠ reviewer.

---

**The Outsider:** (Response D)

**Outsider read: the plan has a circular dependency, a premise that its own evidence contradicts, and three names for one component.**

**Naive questions the documents don't answer**
- The "Now" strip is "fed from four sources already ingested". The same document says `/centers`, `/ledger` and `/dispatches` return `{"items":[]}`. That leaves OPMCM (never expanded) and a frozen August snapshot. Check whether the strip would have more than one live source before anyone builds it.
- The Phase 2 gate is ten published items in one municipality. Items need authors, and the reporter flag is Phase 3, so the gate depends on what it gates. The only workable author is an admin (T3 allows it). The plan should say so and say who that person is.
- "Now strip", "Your area" and "Live" all name the home block. T10 and the council describe different components under overlapping names.
- "Checked" is a truth claim, but the Desk rule only rejects items missing a source, place or date. That checks form, not facts. Does the legal exposure exceed what the owner thinks?
- The plan says "one PR per phase, main is protected". The owner's rule is worktree, direct merge to main. An agent executing cold will open PRs.
- "Never say news in public copy" has no enforcement. `kind: news` and `NEWS-PORTAL-DECISIONS` sit next to public strings.

**1. Order**
- **Wave 1, in parallel on disjoint files:**
  - Phase 0 split into three briefs: home, nav and i18n; fonts and service worker; footer, governance and `llms.txt`.
  - T1 then T2 (server only) alongside.
- **Wave 2:** T3, T4, T6 (the shared date and relative-time helper is committed first). Then the "Now" strip as a new task.
- **Then:** T13 and T14 (Desk queue).
- **Gated:** locality (T7–T9, T12) on the ten items. Correspondents (T15–T17) on the Desk queue working. Ads (T18–T19) on the DoIB certificate.
- Limit this to two or three agents per wave. The Lambda limit is 10 and Codex rate limits have already been hit.

**2. Plan changes**
- Rewrite T10 as the council's "Now" strip. Make it a new task that doesn't depend on a saved locality.
- Fix the PR line and add a grep test that fails on "news" or "reporter" in public strings.
- Split the 117 KB plan into one brief per task.
- Add a model per task: `gpt-6-luna` for copy, nav and fonts, `gpt-6.1-sol` for backend and Desk, `gpt-6-astra` only for the tiering and reviewer rules.
- T1–T6, T13, T14 and T20 stay as written.

**3. Drop or defer**
- Defer #16 transliteration (2 days) to Phase 2.
- Defer #11 `/feed.xml`: nothing to feed.
- Defer #15 `sameAs`: owner-blocked, and a one-line edit once the page exists.
- Defer T17 byline and profile, and T12 `/local` sitemap.
- Defer share cards and Viber until the strip has real rows.
- Drop #10 `article:published_time` and `article:author` OG tags until articles exist.

**4. Owner questions**
- Who writes the first ten items, and who posts to Facebook from 6 to 9 pm daily?
- Does "Checked" mean "form complete" or "facts confirmed", and has a lawyer seen it?
- Do the OPMCM and NDRRMA feeds actually produce rows today?
- Are `/climate` and `/our-message` retired or kept?
- Do Phase 0 changes go to prod before the rest, or together with it?

---

**The First Principles:** (Response E)

**The actual problem.** The brand claim ("verified, not viral") is false on first visit. The cause is that nothing is being checked, so the home page is stale and every list is empty. Twenty tasks of plumbing don't fix that. No task in the plan creates items, and the tasks assume a reporter who doesn't exist. The plan should be shaped around getting a first item in front of a reader, not around finishing the locality layer.

**1. Order**
- **Wave 0, honesty (parallel, 3 agents, disjoint files):**
  - Copy and nav: QW 2, 3, 4, 5, 6, 14, 17.
  - Dates: QW 1 and QW 7 as one shared `format-date.ts` helper, committed first because the Now strip depends on it.
  - Precache: QW 9.
  - Also QW 12 (GOVERNANCE and MODERATION pages).
- **Wave 1 (two tracks in parallel):**
  - Track A: T1, then T2, then T3, then T14, strictly sequential. Author news as admin only.
  - Track B: a new Now-strip task over a plain `NowItem` adapter, with OPMCM, centres, ledger and news as sources. It adds the share card and Viber (QW 10) and depends only on Wave 0's helper.
- **Gated:**
  - T7–T9 and T12's sitemap part wait for ten published items in one municipality.
  - T15–T17 wait for that gate and for a second human who wants to be a correspondent.
  - T18–T19 wait for DoIB.
  - The Facebook page, Search Console and the www redirect are owner actions.

**2. Changes to the 20-task plan**
- **T10:** split it. "Your area" and the list filter move behind the locality gate. The Now strip replaces them as a new task, which makes it the public face of T3.
- **T1/T2:** confirm that `happenedAt` and `sourceUrl` are required on news. A Now row can't render without them.
- **T11:** build it admin-only. The reporter check in T3 stays as written.
- **T12:** pull the share-card and Viber parts forward into the Now-strip task. The sitemap part stays gated.
- **T4, T5:** unchanged, but they wait for the gate.
- **T20:** keep it, and add the "Checked" vocabulary.

**3. Drop or defer**
- **T13:** defer. With one moderator, scope and language routing is dead code.
- **T6:** build only author ≠ reviewer now, and the rest when a second reviewer exists.
- **QW 16:** defer. Transliteration serves a picker that doesn't exist yet.
- **QW 8:** defer. It's a 1-day performance task, not an honesty one.
- **QW 11:** defer. The feed has nothing to carry.
- **T18, T19:** don't write them. Code for ads sitting on main before DoIB is liability, not progress.

Cap concurrency at 3 agents. Use `gpt-6-luna` for Wave 0 copy and nav, and `gpt-6.1-sol` for T1–T3 and the Now strip. `gpt-6-astra` isn't needed anywhere.

**4. Questions for the owner**
- Who supplies the first ten items, and who posts at 6–9 pm? This is the real bottleneck.
- Who is the named person behind "Checked"? The word needs an accountable human.
- Do you accept admin-only authoring until the gate is met?
- `/climate` and `/our-message`: retire or keep?
- Who is the named editor for DoIB, and has entity formation started?
- Are OPMCM and centre items located precisely enough to show a place? Many are district-level only.


---

# Part 3. Peer reviews

## Review 1

**1. Strongest: C.** It is the only response that attacks the plan with evidence from the inputs:
- The four "already ingested" sources are stale (NDRRMA snapshot 29 Aug, centres last verified 8 Sep), so the strip would look dead.
- A 6-9 pm Facebook spike hitting a home page with four fetches, under a Lambda limit of 10, needs one cached `/now`.
- QW2's runtime-empty nav hiding flickers.
- "Checked" overclaims, because the Desk rule checks completeness, not truth.
- A wrong BS date is the worst possible bug on this site.

E is close and frames the root problem best (nothing creates items). D's circular-gate catch is real, but D then tells agents to skip share cards and Viber, which are the distribution unit.

**2. Biggest blind spot: A.** It assumes supply exists. It names a Rasuwa ward chair as pilot and treats ledger deliveries as the "viral unit", even though `/ledger` is empty on prod. It adds scope (an auto-post pipeline, `/now.json`, open licensing) under a limited agent budget. Meta Graph auto-posting is owner-blocked, and it puts newsy auto-posted cards on a page that is not yet registered. It also lets ledger entries auto-appear as "Official source" with no moderation, and it never notices the Phase 2 gate depends on authors that don't exist.

**3. Missed by all five:**
- **Service-worker staleness.** Returning and installed-PWA users keep the old precached August home page until the worker updates. The Phase 0 honesty fix is not live without a cache-version bump and update strategy, and none of the plans include one.
- **Prod release.** Everything is verified on dev, prod deploys are manual, and nobody schedules a prod cut. The honesty fix can sit on dev while the public site stays false.
- **No kill or success metric.** The existing Reach tab could measure the strip, but nobody defines what result would stop or redirect the plan.
- **Republishing OPMCM/NDRRMA content.** Nobody asks about attribution or licence terms for putting government items in a strip labelled "Official source".

## Review 2

**1. Strongest: E.** It states the real problem: the brand promise is false on first visit because nothing is being checked, and no task creates items. It sequences around getting a first item in front of a reader. It also catches the two things that make "Checked" safe or unsafe: `happenedAt` and `sourceUrl` must be required on news, and a named accountable human must stand behind the word. C is close behind with the best concrete flaws (Lambda spike from a 6-9 pm Facebook card, nav that flickers when it depends on runtime fetches, BS date fixtures). C stops short of E's framing.

**2. Biggest blind spot: A.** It treats zero supply as a solved problem ("a ward chair can file deliveries") and then adds more build on top: a `NowItem` adapter, `/now.json`, an open-licence feed, Facebook auto-posting via Meta Graph, and transliteration pulled forward. All of that is machinery for content that doesn't exist. It also asks whether ledger entries can auto-appear as "Official source" without moderation. That works against the pre-moderation decision. Auto-posting newsy cards before DoIB registration ignores the legal exposure the question names. B is a close second: it defers the feed because there is nothing to feed, yet never asks who produces the items.

**3. Missed by all five:**
- **Prod promotion.** Prod deploys are manual. Every Phase 0 honesty fix lands on dev, but the false "Live" claim is on prod. No plan item says when the owner promotes it.
- **Service-worker staleness.** Existing installs keep serving the old precached home. Nobody planned a cache-version bump or checked that returning users actually see the fix.
- **Nepali copy review.** Agents will write the hero, "Checked" and the Nepali-default strings. Nobody budgets a native-speaker review before shipping to prod.
- **No success measure.** The page-reach counters already exist (POST /reach, Desk Reach tab). No one names a metric or a stop-condition, such as a Nepali-first home that gets no returning visits.

## Review 3

**1. Strongest: A.** It is the only response that sees compounding order. A shared `format-date.ts` lands first, then one `NowItem` adapter feeds the strip, the cards, `/feed.xml`, `/now.json` and `llms.txt`. Every later output reuses one normalised shape. A also points T15 at ward chairs and verified orgs, who already file deliveries. That is a real route to the ten-item gate without recruiting reporters. E is the runner-up for naming supply as the bottleneck. B has the best collision hygiene, pulling `api.ts` and types out of T7.

**2. Biggest blind spot: D.** It subtracts the upside. It defers share cards and Viber "until the strip has real rows" and drops the OG tags. But distribution is the product, and the cards are what make a single row worth creating. D also spends its effort on documentation hygiene (splitting the plan, a grep test) rather than on how supply or reach grows. C is close behind: dropping the feed because "nobody reads RSS" ignores that machine-readable output is how other portals and NGOs reuse the record.

**3. What all five missed:**
- **Backfill as the first supply.** Nobody proposes turning existing assets into dated, sourced, located items. Candidates are the August flood record, `rescued-persons.json`, the flood-impact data, and the OPMCM notice archive. A one-off import could clear the ten-item gate in days and give the strip a populated day one.
- **Free external feeds.** The 753-municipality dataset and the BIPAD public API, which the earlier org-features research noted, were not considered as sources. Treat BIPAD as unverified until checked.
- **A permalink per row.** Cards need a canonical, indexable URL that carries the OG tags, or shares point nowhere.
- **A success metric.** The existing page-reach counter (`POST /reach`) could measure card click-through and decide whether the gate and later phases proceed.
- **No prod rollout plan.** D asked about prod deploys, but no response sequences them.

## Review 4

1. **Strongest: B.** It is the only response a cold agent could start from.
   - It gives file-level lanes per agent, which prevents collisions: `site-status-bar.tsx` goes to A, and `api.ts`/`types.ts` are pulled out of T7.
   - It assigns a model per wave and caps concurrency at 3.
   - It has a concrete dev check that avoids Turnstile: sign in as admin, POST a `kind: news` draft, publish it as moderator, then GET it.
   - It warns that the strip will show only OPMCM rows on day one.
   - It folds T20 into each wave, and it cuts QW12 to two footer links.

2. **Biggest blind spot: A.** It ignores that supply is zero.
   - It says ward chairs "already file deliveries" and proposes a Rasuwa pilot, but the prompt says `/ledger` and `/centers` return empty.
   - It adds scope on top of empty surfaces: a `/now.json`, an auto-post pipeline, and pulling QW16 forward.
   - Meta Graph auto-posting depends on a Facebook page the owner hasn't created.
   - It gives no deliverables or test steps for any item, and it runs `gpt-6-astra` on the adapter and the card pipeline despite the rate-limit warning. D and E also lack test steps, but they don't invent premises.

3. **Missed by all five:**
   - **No item-level queue.** None gives IDs, dependencies, deliverables and a dev E2E check per item, which the question required. They describe waves and refer to "QW7" or "#16" without saying what these are. A cold agent would have to open Report 3 to decode them.
   - **No prod promotion step.** Phase 0 fixes are meant to correct prod, but prod deploys are manual. Only D asks about this, and as a question rather than a step.
   - **No Nepali copy review.** The plan has bilingual strings, a new Nepali-first default and a hero rewrite, with no native-speaker check. Only C flags the BS date fixtures.
   - **No merge discipline.** There is no gate sequence per merge (`pnpm typecheck && pnpm test && pnpm build`, then the server tests), and no rollback step when a dev auto-deploy breaks. Only D notices the plan's "one PR per phase" line contradicts the owner's direct-merge rule.
   - **No reasoning effort per item.** The question asked for model assignments, and none gives a low-to-ultra effort level.

## Review 5

**1. Strongest: B.**
- It is the only response that checks file collisions. It notes that T7, T11 and T14 all collide in `src/lib/api.ts` and `types.ts`, and pulls the client types out of T7 into a shared first commit.
- It groups quick wins by file: `site-status-bar.tsx` stays with the chrome agent, and `home.tsx` and `shell.ts` stay with the home agent.
- It swaps `LocalityPicker` for the existing `MunicipalitySelect` in T11. That keeps T11 from depending on the gated T8.
- It cuts T6 to author ≠ reviewer.
- Its dev test avoids Turnstile: sign in as admin, POST a news draft, publish it as moderator, then GET it.
- It warns that the Now strip will show OPMCM rows only on day one.

**2. Biggest blind spot: A.**
- It says T11 "stays exactly as written" while gating T7-T9. T11 imports `LocalityPicker` and `localStrings` from T8 and the types from T7, so it cannot run.
- It runs Wave 0 as "same day, parallel" with no file lanes. QW4, QW12 and QW17 all edit `App.tsx`, and T1-T3 share `server/test/local-updates.test.js`.
- It never confronts zero supply. It assumes ward chairs will file deliveries.
- It adds a Meta Graph auto-posting pipeline for a Facebook page that does not exist yet. That is also an owner-blocked item.

**3. Missed by all five:**
- `src/lib/format-date.ts` already exists, with about 20 importers including the Desk. The quick-win list calls it "new", and A, B and E say "create" it. Relative time and BS dates must be additive exports. `edition.ts` exists too.
- OPMCM `government-efforts` items are `title` and `createdAt` only, with no place. The council's "each row with place" cannot be met for the one live source. Only E raised this, and only as a question.
- Home already has `OfficialUpdates` fed live from OPMCM. The Now strip is partly a refactor of that block, not a new one.
- T11 and T14 both edit `DeskProfile` in `src/lib/auth.tsx`.
- No wave ends with an owner-run prod `workflow_dispatch` and a check. Merges only reach dev.


---

# Part 4. Chairman's verdict

## Where the Council Agrees

- The "verified, not viral" claim is false on first visit. Honesty fixes ship before any locality work, and no owner decision is reversed.
- T1-T3 are server-only and run beside the Phase 0 frontend work from day one.
- T10 is replaced by a four-source "Now" strip that needs no saved locality. T7-T9 and the locality half of T12 wait for ten published items in one municipality.
- T18/T19 (ads) wait for the DoIB certificate. T15-T17 wait for real correspondents.
- No more than three Codex runs at once, because of rate limits and the 10-Lambda ceiling. Quick wins 13 and 15 are owner actions.

## Where the Council Clashes

- **Share cards and Viber, now or later.** A and E want them in the strip task. D defers them until rows exist. I side with A and E, narrowed: Viber on every row, PNG cards only for rows with their own permalink. Distribution is the product.
- **Transliteration (QW16) and `/feed.xml` (QW11).** A pulls both forward. B, C, D and E defer them. Deferred: no picker exists to use the first, nothing exists to feed the second, and a feed reads as a news portal before registration. A's `/now.json`, Meta auto-posting and open licensing are cut as scope on empty supply.
- **Fonts (QW8).** C says the cards need self-hosted Devanagari. A, B and E say defer. Defer, but the card test must check Devanagari conjuncts on dev. If they break, QW8 moves up.
- **T6 and T13.** B, C and E are right. Build author-is-not-reviewer only. District, language and national rules deadlock a queue with one or two moderators.
- **`gpt-6-astra`.** Only A wants it. Not used.

## Blind Spots the Council Caught

- Supply is zero and no task creates items (C, D, E). A assumed it away.
- The Phase 2 gate is circular: items need authors, and the reporter flag is Phase 3 (D). The way out is admin-authored items that a different moderator publishes.
- `format-date.ts` and `edition.ts` already exist, so the helpers are additive exports. `OfficialUpdates` already renders three OPMCM items on home, so the strip refactors it.
- OPMCM items have no place field. Bundled centres carry one global `last_verified`. "Each row with place and date" therefore fails for both, and centres cannot be timed strip rows.
- Prod deploys are manual, so the honesty fix does not exist publicly until the owner dispatches it. The service worker may also keep serving the old home to returning installs.
- T11 imports `LocalityPicker` from the gated T8. T7, T11 and T14 collide in `api.ts`, `types.ts` and `DeskProfile`.
- The plan's "PR per phase" contradicts the owner's worktree-to-main rule.
- Nobody budgeted a Nepali copy review or a success measure.

## The Recommendation

**All waves.** Use a worktree off main and merge directly after `pnpm typecheck && pnpm test && pnpm build`, `cd server && pnpm test` and `pnpm format`. Strike "PR per phase". Lanes never share files. Browser checks run one at a time with the Desk closed.

**Wave 0 (serial, one run, `gpt-6.1-sol` high, about 0.5 d).** Commit to main first:
- Additive `relativeTime` and `bsDate` exports in `src/lib/format-date.ts`, with fixture tests across BS year boundaries.
- `src/i18n/now.ts` with the two words only.
- Client `kind`/`locality` types and `api.ts` entries, pulled out of T7.
- `DeskProfile` fields in `src/lib/auth.tsx`, pulled out of T11/T13.
- A test that fails if "news" or "reporter" appears in public i18n strings.

**Wave 1 (three lanes).**
- **A, chrome, `gpt-6-luna` medium.** Covers QW1 label half, 2, 3, 4, 9, 12 (two footer links to the GitHub pages), 17 and the service-worker check. Files: `site-header.tsx`, `site-status-bar.tsx`, `live.ts`, `App.tsx`, `dispatches.tsx`, `chat-widget.ts`, `site-footer.tsx`, `vite.config.ts`. QW2 removes links statically, because runtime-empty hiding flickers.
- **B, home, `gpt-6.1-sol` medium (Nepali copy).** Covers QW1 dateline half, 5, 6 and 14. Files: `home.tsx`, `i18n/shell.ts`, `i18n/index.ts`, `find-person.tsx`, `llms.txt`, `info-help.tsx`, `project-detail.tsx`.
- **C, backend, `gpt-6.1-sol` high.** T1, T2 and T3 as written, plus T6 cut to author-is-not-reviewer. `server/**` only.

Dev check: as admin, POST a news draft, submit it, publish it as a moderator, then GET it, which avoids Turnstile. A 360 px CDP screenshot must show no "Live", six menu items and no `/stories` link.

**Owner prod dispatch #1 after Wave 1.** This is when the false "Live" label dies. Native-speaker review of the Nepali strings comes first. Service worker: `registerType: "autoUpdate"` is set, but the workbox block has no explicit `skipWaiting` or `clientsClaim`. Load the old dev build, deploy, reload twice and confirm the new home appears. If it doesn't, add both plus `cleanupOutdatedCaches`.

**Wave 2 (three lanes).**
- **D, Now strip, `gpt-6.1-sol` high.** A new `src/components/now-strip.tsx` refactors `OfficialUpdates`. Sources are OPMCM (agency, "Official source", no place), ledger deliveries and published news. It makes at most three requests and defines an empty state. Dev exercises every source. Prod day one shows OPMCM only, and the acceptance test says so.
- **E, Desk and editor, `gpt-6.1-sol` medium.** T14 and T11, admin-only, using the existing `MunicipalitySelect`. News requires `happenedAt`, and the moderation rule rejects items without a source. The Desk rule card gets the corrections line and PCN 2083 checklist.
- **F, share, `gpt-6.1-sol` medium.** Viber (QW10), the T12 share-meta half, and PNG cards for items with a permalink.

**Owner prod dispatch #2** follows Wave 2, as separate frontend and backend dispatches.

**Not dispatched:**
- T4, T5, T7-T9, the rest of T10 and the T12 sitemap: wait for ten items in one municipality.
- T6 remainder and T13: wait for a second and third moderator.
- T15-T17: wait for named correspondents. Set the flag by hand until then.
- T18/T19: wait for DoIB. Do not write them.
- T20: folded into each wave's commits.
- Quick wins 8, 11 and 16 are deferred. 13 and 15 are owner-only. The article OG tags in QW10 are dropped.

**Supply.** The owner authors the first ten items as admin from real, cited sources. Candidates are the August flood record and OPMCM notices that carry a place. A different moderator publishes each one. No agent-written items and no seed markers. Review the Reach tab at day 28. If the strip gets no clicks and nothing new is filed, Phase 2 does not start. BIPAD is unverified and not dispatched.

**"Checked" may claim** only that a named moderator, not the author, found a source, place and date. It must never mean "true" or "confirmed". It never appears on OPMCM rows, which are "Official source". It never appears on ledger rows a moderator hasn't touched. Its tooltip links the checklist.

## The One Thing to Do First

Dispatch Wave 0 as one `gpt-6.1-sol` run: the date helpers, the vocabulary file and the shared types. Every other lane imports it.

## Questions only the owner can answer

1. Who writes the first ten local updates, and which moderator publishes them? This blocks the Phase 2 gate and the Wave 2 end-to-end checks.
2. Who creates the Facebook page and posts at 6-9 pm? This blocks QW15 and any distribution claim.
3. Who is the named person accountable for "Checked", and does it mean form-complete plus human-reviewed? This sets the copy and the legal line.
4. Retire or keep `/climate` and `/our-message`? This shapes Lane A's nav.
5. Are GOVERNANCE and MODERATION-GUIDELINES fit to publish verbatim? This blocks QW12.
6. How many active moderators exist? This decides whether T6 and T13 ever matter.
7. Who reviews the Nepali strings before prod dispatch #1? This blocks that dispatch.
8. Has DoIB entity formation started? This gates ads and any use of "news".
9. May the strip republish OPMCM title, agency and link, and may a named correspondent count as the source when no URL exists? This shapes the Wave 2 row and validation rules.
