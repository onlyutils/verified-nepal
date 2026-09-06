# VerifiedNepal — End-to-end test report, dev, 2026-09-06

Companion documents: [USER-FLOWS.md](USER-FLOWS.md) (flow-by-flow walkthrough for the UI/UX review), [DEV-DATASET.md](DEV-DATASET.md) (the dataset now on dev), per-run raw findings in [findings/](findings/), screenshots in [screenshots/](screenshots/).

## 1. Executive summary

**The USP holds where it is implemented.** "Nothing user-submitted is public until a moderator approves it" was verified end to end — through the real UI, then confirmed against the public API — for needs, offers, projects, articles, stories, organizations and disasters: pending items are invisible on every public page and list endpoint, approval flips visibility, rejection (with a required reason) never surfaces, and every decision lands on the public `/audit` page with masked names.

**Two places break the promise (P1):**
- `VN-01` Missing-person posters have **no moderation step** — a saved poster is on the public board immediately (no `/moderation/missing*` route exists). If this is deliberate (time-critical content), it needs to be stated in the product docs and the privacy policy.
- `VN-02` The public incidents API returns **pending disaster reports** to anonymous callers (`GET /incidents?status=pending`) including the reporter's user id and proof-photo URLs; the page hides them client-side, the API doesn't.

**Everything else that failed is fixable UX/quality work**, not broken flows: a systemic contrast failure of the muted-text token (`VN-03`), an unreadable climate chart (`VN-04`), no 404 page (`VN-05`), and a Turnstile failure path that lets the form submit and then blames the server (`VN-06`). One regression introduced by the dev-only test sign-in (`VN-07`, landing on `/org` instead of the page you came from) was fixed and deployed during this run (`e1fd179`).

**Numbers.** Wave 1 (empty-ish dev): 5 runs, 27 routes × EN/NE × mobile/desktop, ~115 flow steps — 89 PASS, 4 FAIL, 9 BLOCKED, the rest partial/observational. Blocks were environmental (Cloudflare Turnstile never issues a token to headless Chrome, so anonymous writes could only be verified at the API level) and data (dev had zero published needs). Both are addressed: the environment was then populated through the app's own handlers with 100 helpers, 150 needs, 120 offers, 8 orgs, 10 drop centers, 15 projects, 20 articles, 15 stories, 15 posters and 44 real photos, and wave 2 (Desk at volume, org/drop-center/donation flows, helper groups, posters, populated visuals) is appended in §8 as it completes.

## 2. Scope and method

| Run | Role / account | Method | Output |
|---|---|---|---|
| anon | none | headless Chrome (CDP) + curl | 17 public routes EN+NE, forms, API negatives — [findings/anon.md](findings/anon.md) |
| helper | helper-beta-tester | Chrome + curl | sign-in, /me, offers, org, articles, stories, tokens — [findings/helper.md](findings/helper.md) |
| moderator | moderator-beta-tester | Chrome + curl | gates, queue, boards, print/sync, articles/stories, audit — [findings/moderator.md](findings/moderator.md) |
| admin | admin-beta-tester (+ throwaway fixture) | Chrome + curl + OnlyUtils MCP | roles/districts, disasters lifecycle, climate, cross-role visibility — [findings/admin.md](findings/admin.md) |
| ux | read-only | Chrome instrumentation | 27 pages × 4 captures; overflow, contrast, tap targets, a11y tree, console/network, offline — [findings/ux.md](findings/ux.md) |
| dev dataset | all 100 helpers + moderator/admin | in-process Lambda handler harness (Turnstile skipped, real DynamoDB, real media presign/CDN) | dataset + [DEV-DATASET.md](DEV-DATASET.md) |

Environment: `https://dev.verifiednepal.com` (Cloudflare Pages) → `https://api.dev.verifiednepal.com` (Lambda, DynamoDB `verifiednepal-dev`), OnlyUtils dev client `ou_client_34HIKupJ5afWl0DIoh7zi`. Accounts and the dev-only password sign-in are described in [../../BETA-TESTING.md](../../BETA-TESTING.md). Nothing touched production.

## 3. USP verdict per content type

| Content | Pending hidden (page + API) | Approve → public | Reject → never public | Audit row | Verdict |
|---|---|---|---|---|---|
| Need | ✓ | ✓ (populated via API; UI publish in wave 2) | ✓ | ✓ | holds |
| Offer | ✓ | ✓ UI | ✓ UI (reason) | ✓ | holds; but published offers surface on no public page (`VN-13`) |
| Project | ✓ | populated; UI in wave 2 | ✓ | ✓ | holds (creation blocked by Turnstile in automation) |
| Article | ✓ | ✓ UI (one click) | populated | ✓ | holds |
| Story | ✓ (+ computed eligibility) | ✓ UI | populated | ✓ | holds |
| Organization | ✓ ("unverified" gating) | populated; UI in wave 2 | populated | ✓ | holds; copy contradicts model (`VN-31`) |
| Disaster | page ✓ / **API ✗** | ✓ UI | ✓ UI (reason) | ✓ | **`VN-02`** |
| Missing poster | **✗ no moderation** | n/a | n/a | — | **`VN-01`** |

## 4. Consolidated defects (deduplicated across runs)

Severity: **P1** = breaks the USP, a task, or WCAG AA broadly · **P2** = degrades a task or misleads · **nit** = polish. "Where" links to the raw finding.

### P1

| ID | Issue | Where | Evidence / fix |
|---|---|---|---|
| VN-01 | Missing-person posters bypass moderation: no `/moderation/missing*` route, `GET /missing` lists a poster the moment it is saved. | moderator 5d | Product decision: either add a poster queue to the Desk or document posters as the deliberate exception. |
| VN-02 | `GET /incidents?status=pending` (anonymous) returns pending reports with `createdBy` (OnlyUtils sub), `proofMedia` URLs and `approvedBy`. Page filters client-side only. | admin B1 | Drop `pending` from public statuses; strip `createdBy/approvedBy/rejectionReason` in `handleGetIncidents`; check the frontend `listIncidents()` default (`active,pending`). |
| VN-03 | `--muted-foreground` = rgb(147,143,138): 3.2:1 on white, 2.95:1 on cream; ~188 occurrences (captions, helper text, timestamps). | ux 1 | Darken token to ≈rgb(112,108,103) (4.6:1). One CSS variable. |
| VN-04 | Climate ranking bar labels 1.47:1 (dark grey on brand blue). | ux 2 | White labels on bars or labels outside. |
| VN-05 | Unknown routes render the home page; no 404. | ux 3 | Real not-found view with "Back to front page". |
| VN-06 | Turnstile failure path: desktop submits without a token → server 400 `turnstile token required` → user sees "Something went wrong on our side"; mobile blocks client-side instead. Same on `/projects/register`. Widget label "Verification required" over a blank box. | anon B2, helper B2, moderator P2 | Disable submit until the widget yields a token; map the 400 to a "complete the verification" message; show widget load errors. |
| VN-07 | Test-account sign-in ignored `vn:return_to` → helper landed on `/org`; header/status-bar links also dropped return_to for Google. | helper B1 | **Fixed** in `e1fd179` (verified: /give-help → Sign in → back to /give-help). |

### P2

| ID | Issue | Where |
|---|---|---|
| VN-08 | `/audit`: every target labelled "User · …" (incidents, orgs too); approve/edit/role.set/org.create all render as "Updated"; actor shows "Only Utils Only Utils" (duplicated, unmasked) while the copy says names are masked. | admin B2, anon B4 |
| VN-09 | `POST /admin/users/:sub/role` accepts any district string ("Atlantis" stored, shown, un-removable). | admin B3 |
| VN-10 | Inconsistent confirmation models: disaster Approve/Archive one click (Archive irreversible), article/story Publish one click, needs/offers need a checkbox, rejects a dialog. Role change has the good confirm dialog — reuse it. | admin B4, moderator nit |
| VN-11 | Masked name renders "Beta (." for display names containing "(" — queue, public helper label, audit. | moderator |
| VN-12 | Offers show "W—" (no ward) in the meta line. | moderator |
| VN-13 | Published offers appear on no public page; `/give-help` board is needs-only while `GET /offers` is public. | moderator |
| VN-14 | Reject dialog's Reject button enabled before a reason is chosen. | moderator |
| VN-15 | `/projects` empty state says "You appear to be offline" while online (`projects.tsx:169` passes `t.offline` unconditionally). | anon B1, ux 12 |
| VN-16 | "Draft restored from …" banner appears on the same visit / on an empty form. | anon B3 |
| VN-17 | Public GETs 400 without filters (`/needs`, `/projects`, `/offers` need `incidentId`; `/audit` month; `/ledger`, `/goods-ledger` district). No cross-incident listing exists. | anon B5, dataset obs 2 |
| VN-18 | Pending article still shows "Edit", which opens a read-only page. | helper B3 |
| VN-19 | Emergency banner + status bar take 213px of a 390×844 viewport; every H1 starts at y≈378; banner wraps to 3 rows. | ux 4, anon, helper |
| VN-20 | 77-district checkbox walls (offer dialog, register-org, `/incidents` filter, admin role picker) — ~4,600px of scrolling on mobile; the moderator district gate already has search — reuse it. | ux 5, helper, admin |
| VN-21 | `/desk/login` and 404 states have no H1; login inputs are placeholder-only. | ux 6 |
| VN-22 | Language toggle label inconsistent ("EN"/"नेपाली" vs "अङ्ग्रेजी"/"नेपाली" on login; name vs code asymmetry). | ux 7 |
| VN-23 | Article detail fires `POST /dispatches/:id/view` for non-existent ids. | ux 8 |
| VN-24 | Helper visiting `/desk` is silently redirected to `/org`. | ux 9, helper |
| VN-25 | Tap targets under 44px: footer "Register organization" (20px), "OnlyUtils" (17px), give-help tab pills (28px), poster phone links (20px). | ux 10 |
| VN-26 | Desk sections are buttons, not routes: no deep links, reload loses the section. | admin |
| VN-27 | Timestamps US-formatted in both languages with no timezone; audit month picker English in NE. | moderator, anon |
| VN-28 | Mobile Desk: section nav clipped ("Print cla…") with no overflow cue; chat FAB overlaps cards/actions. | moderator, admin |
| VN-29 | `/me` "Your story" block is a dead end for ineligible helpers (no path to eligibility). | helper B4 |
| VN-30 | Offer dialog header says "Sign in with Google to register help…" while signed in. | helper B5 |
| VN-31 | Org dashboard copy "Unverified — publicly visible as unverified" contradicts "nothing public until approved". | helper |
| VN-32 | `/ledger` shows a Turnstile widget inline with the filters on a read-only page (guards CSV) — looks broken until it resolves. | anon |
| VN-33 | Asymmetric incident gate: `POST /needs` accepts a pending incident, offers/projects require active. | dataset obs 1 |
| VN-34 | `storyRole` reports whichever pointer is read first (all 15 dataset stories resolved "helper" though several authors also own a fulfilled need). | dataset obs 4 |
| VN-35 | Resubmitted article keeps its original `createdAt`, so it never moves up the moderation queue. | dataset obs 7 |

### Nits

Stats labels ("Oldest pending age: h", trailing colons); "Role updated." shown twice; broken proof image has no fallback; desktop home hero ALL CAPS vs mobile sentence case; mobile menu is 20 flat items mixing pages/account/guides; `/audit` cached 60 s so a moderator may not see their own action; poster board prints full phone numbers publicly (confirm against the privacy principle); person search matches substrings ("Ram" → "Pramila"); offers can't be closed (matched/fulfilled) from the Boards UI; rejection reason is public on `/audit` while the dialog placeholder says "shown to the reporter"; moderator district scope can never be cleared; guidelines ack with the box unchecked gives no feedback; "Aa" text-size trigger meaningless in NE; login photo credit ~2.5:1; two pre-existing incidents had generic names; `/ledger` is per-district only so a district picker without counts feels empty (dataset obs 6); story media has no dedicated presign route (dataset obs 3); admin-created incidents cannot be rejected, only archived (dataset obs 5).

## 5. What is working well (leave alone)

- Expectation-setting copy on every intake form ("No account needed. A moderator will review before anything appears publicly") — the USP made visible.
- Queue ergonomics: public preview vs private details side by side, duplicate check, mandatory "I called the registrant" before Publish, claim/release locks; the reject dialog copy.
- Accessibility baseline: skip link, landmarks, one H1 per page, labelled inputs, alt text everywhere, visible focus rings, zero console errors on normal pages, no horizontal overflow at 390px anywhere.
- Full EN/NE parity with persistence; Devanagari renders cleanly.
- Offline-first shell with honest "snapshot" labelling.
- Role-change confirm dialog ("This will be audited") — the pattern to spread.
- Silent token refresh; sign-out; 401/403 boundaries on every role-gated endpoint (verified exhaustively for `/admin/*` and `/moderation/*`).
- Media pipeline: presign → S3 → CDN worked 44/44 across six different flows.

## 6. Environment limitations and recommendations

1. **Turnstile blocks automation.** Cloudflare's managed widget never issues a token to headless Chrome (checkbox challenge, tried with real mouse events and a non-headless UA). Recommendation: on **dev only**, use Cloudflare's always-pass test keys (`1x00000000000000000000AA` site / `1x0000000000000000000000000000000AA` secret) via `VITE_TURNSTILE_SITE_KEY` + the Lambda `TURNSTILE_SECRET`, so anonymous forms can be driven end to end by agents and CI. Until then the dataset harness (Turnstile skipped in-process) is the way to create anonymous content.
2. **Radix tabs** ignore synthetic `element.click()`; drivers must send real CDP mouse events. Not a product bug, but worth a `data-testid` pass for future automation.
3. **15-minute tokens** — every browser scenario re-logs in; fine.
4. **Shared dev database** — runs interleaved (an incident archived by the admin run mid-run cost 29 retries); the dataset harness is idempotent and topped up.
5. `Page.captureScreenshot` with `captureBeyondViewport` hangs on pages embedding the Turnstile iframe.

## 7. Test data left on dev

The dev dataset reads as real content. Identify records by the ids in `dev-dataset.json` and by the `*-beta-tester@verifiednepal.com` owner emails; wave-1 fixtures are listed at the end of each `findings/*.md`. The account `throwaway-beta-tester@verifiednepal.com` remains a helper account. The dataset inventory contains the reference codes, claim codes, update codes and donation codes.

## 8. Wave 2 — populated environment (night of 2026-09-06)

Three runs on smaller models against the populated dataset: Desk at volume ([findings/wave2-desk.md](findings/wave2-desk.md)), helper/org/public-with-codes ([findings/wave2-helper.md](findings/wave2-helper.md)), and a read-only visual pass of 20 pages × EN/NE × mobile/desktop ([findings/wave2-visual.md](findings/wave2-visual.md)).

**What now passes end to end that wave 1 could not reach:** publish/reject/release at a 50-item queue with district and text filters; scope enforcement (hidden in UI, 403 via API); need ↔ offer match; claim-code redemption via Paper Sync → fulfilled → masked `/ledger`; the printed claim sheet (desktop, mobile, PDF — QR codes, masked names, checkboxes); project committee verify → publish, update and photo approval with the photo served from the CDN; organization verify with trust tier and reject with reason; article reject with the reason visible to the author; admin disaster approval; non-zero admin/climate stats; audit masking across every target type; helper groups (form → items → join → claim → done, reflected on both helpers' `/me`); project updates via update code held pending; org take → private contact → deliver → ledger line, and hand back; center stock intake → transfer → receive with public stock and goods ledger updating; team invite accept/decline; drop-center pages; donation status pages; poster save with photo → edit → mark Found; status check for pending/published/fulfilled and renew; article like/share. With data loaded, every page still has zero horizontal overflow, zero console errors and zero failed requests.

**New defects found only with data:**

| ID | Sev | Issue | Where |
|---|---|---|---|
| VN-36 | P1 | Missing-person poster photos never render on the board or in the generated poster (empty placeholder). | wave2-visual |
| VN-40 | P1 | Boards "Match" (need ↔ offer) exists only in the mobile card markup; the desktop table has no way to match. | wave2-desk |
| VN-41 | P1 | Boards "Redeem a claim code" never renders: the public needs list omits `claimCode` (correctly), so the Desk has no moderator-only source for it. | wave2-desk |
| VN-45 | P1 | Stale cache on `/give-help`: after group actions a reload can show the pre-action state until the browser cache is cleared (API cache headers / service-worker strategy). | wave2-helper |
| VN-37 | P2 | "Sent to Sent to {destination}" on every transfer-out entry of public center pages (template used as its own fallback). | wave2-visual, wave2-helper |
| VN-38 | P2 | Donation status result panel titled "Look up another code". | wave2-visual |
| VN-39 | P2 | "Renew for 30 days" offered (and accepted by the API) on fulfilled needs. | wave2-visual, wave2-helper |
| VN-42 | P2 | Flags tab has no resolve action and no link from a need flag to the item. | wave2-desk |
| VN-43 | P2 | Org rejection writes the literal reason "reject" to the audit log. | wave2-desk |
| VN-44 | P2 | "Vouched for" tier on an org without vouches fails with the generic server error. | wave2-desk |
| VN-46 | P2 | Center edit fails whenever the stored phone has a leading "+". | wave2-helper |
| VN-47 | P2 | `/org#needs` deep-link/reload falls back to Overview. | wave2-helper |
| nits | — | `/ledger?district=` ignored; one green tone for open and done states; `/poster/:id` opens the editor; article share count not optimistic; anonymous visitors see live group buttons that no-op; "Form a group" and org take not mutually exclusive; declined invites vanish; NE numerals inconsistent; reject-article dialog reuses need copy; mobile print sheet clips Category; dataset media reuse one watermarked stock photo. | all three |

## 9. Fixes applied overnight (2026-09-06 → 07)

Six Codex batches, each typechecked, built and run against the 199 server tests before being committed and deployed to dev; a Sonnet verification pass re-checked every item on the live site ([findings/wave3-verify.md](findings/wave3-verify.md)). Commits on `main`: `09e2a73` backend · `c6b89e4` global UI · `3915a57` forms/flows · `6da81a5` Desk · `70a4182` caching/org/helper follow-ups · batch 6 (regression + leftovers) — see `git log`.

| ID | Status | Note |
|---|---|---|
| VN-01 posters bypass moderation | **open — product decision** | needs a call: add a poster queue, or document posters as the exception |
| VN-02 incidents API leak | fixed, verified | public statuses active/archived only; internal fields stripped |
| VN-03 muted text contrast | fixed, verified (token 7.2:1) | `.text-subtle` tagline still 3.2:1 → batch 6 |
| VN-04 climate labels | fixed, verified | |
| VN-05 no 404 page | fixed, verified | **regression: hard load of `/` showed the 404 → batch 6** |
| VN-06 Turnstile failure path | fixed, verified | submit disabled until token; specific messages; "Verification" label |
| VN-07 return_to | fixed, verified | |
| VN-08 audit labels/verbs/actor | fixed, verified | |
| VN-09 district validation | fixed, verified | |
| VN-10 confirmations | fixed, verified | |
| VN-11 masking "Beta (." | fixed, verified | word-based masking, Devanagari-aware |
| VN-12 "W—" | fixed | |
| VN-13 published offers not shown publicly | **open — product decision** | show an Offers board or restrict the endpoint |
| VN-14 reject button gating | fixed, verified | org reject validates on submit instead → batch 6 |
| VN-15 offline copy on empty list | fixed, verified | |
| VN-16 draft banner | fixed, verified | |
| VN-17 list endpoints need filters | **open** | API design; low priority |
| VN-18 Edit on pending article | fixed, verified | |
| VN-19 emergency bar height | fixed, verified | compact single row < 640px; h1 now at y=190 |
| VN-20 77-checkbox walls | fixed, verified | shared searchable picker with chips |
| VN-21 login h1/labels | fixed, verified | |
| VN-22 toggle label | fixed, verified | |
| VN-23 view counter on 404 | fixed | |
| VN-24 helper on /desk | fixed, verified | |
| VN-25 tap targets | fixed | |
| VN-26 Desk section routes | fixed, verified | `/desk/<section>` |
| VN-27 dates | fixed, verified | audit month dropdown in NE → batch 6 |
| VN-28 mobile Desk nav / chat FAB | fixed, verified | |
| VN-29 story eligibility copy | fixed | |
| VN-30 offer dialog copy | fixed | |
| VN-31 org visibility copy | fixed | |
| VN-32 ledger Turnstile placement | fixed | |
| VN-33 incident gate asymmetry | **open — by design** | needs may reference a pending disaster (inline report) |
| VN-34 storyRole precedence | **open** | define precedence when a person both gave and received |
| VN-35 resubmitted article ordering | fixed | |
| VN-36 poster photos | partially fixed | thumbnails render; detail dialog → batch 6 |
| VN-37 "Sent to Sent to" | fixed, verified | |
| VN-38 donation code label | fixed, verified | |
| VN-39 renew on fulfilled | fixed, verified | UI hidden + API 409 |
| VN-40 Boards Match on desktop | fixed, verified | |
| VN-41 Boards Redeem | fixed, verified | moderator-only claim-code projection; anonymous response unchanged (tested) |
| VN-42 flag resolution | fixed, verified | new resolve endpoints + audit rows + deep links |
| VN-43 org reject audit reason | fixed, verified | |
| VN-44 vouched tier | fixed, verified | |
| VN-45 stale board cache | fixed, verified | NetworkFirst SW strategy, `no-store` reads, refetch after mutations |
| VN-46 "+" phones | fixed, verified | |
| VN-47 /org#needs | fixed, verified | |
| New: match panel `[object Object]` | batch 6 | found by the verifier |
| Nits | mostly fixed | stats labels, duplicate "Role updated", image fallback, hero caps, share count optimistic, declined invites kept, group/org exclusivity, sign-in nudge for anonymous group actions, badge tones, print sheet mobile, reject-dialog copy |

Still open for a decision in the morning: VN-01, VN-13, VN-17, VN-33, VN-34, the mobile menu grouping, the public phone numbers on posters, and the search substring matching.
