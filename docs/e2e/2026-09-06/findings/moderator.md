# Moderator-role e2e findings (dev.verifiednepal.com, 2026-09-06)

Account moderator-beta-tester@verifiednepal.com. Screenshots NN-*.png in this folder (`*-full` = full page; 31–33 = 390×844 mobile). Fixtures tagged E2E-0906-mod.

## 1. Flows tested

| # | Step | URL / endpoint | Expected | Actual | Result | Shot |
|---|---|---|---|---|---|---|
| 1a | Pre-ack API gate | GET /moderation/queue, /moderation/flags (no ack) | 403 guidelines_not_acknowledged | 403 on both | PASS | — |
| 1b | Sign in → guidelines gate | /desk/login → /desk | Gate shown | Full guideline text, checkbox, "I have read and will follow these" | PASS | 01, 01b |
| 1c | Ack with box unchecked | /desk | Still gated | Still gated, no feedback | PASS (nit) | 02 |
| 1d | Ack with box checked | /desk | Proceed | → district gate | PASS | 03 |
| 1e | Post-ack API | GET /moderation/queue | 200 | 200 | PASS | — |
| 2a | District gate | search "Ka" → Kathmandu + Kaski → Save | Queue scoped | "Scope: Kathmandu, Kaski · Edit"; only those items; filter limited to the two | PASS | 04, 05, 06 |
| 2b | Clear districts to none | POST /me/districts {[]} | clear | Not possible by design — API requires 1–10; gate cannot be skipped | N/A | — |
| 3a | Queue render | Desk → Queue | 3 pending offers with preview/private/dup panels | As expected, badge count correct | PASS | 09 |
| 3b | Claim | offer 1 → Claim | Publish/Reject/Release; Publish disabled until "I called the registrant…" checked | As expected | PASS | 10 |
| 3c | Publish offer | check → Publish | Leaves queue, public, audit | Left queue; GET /offers?incidentId=test → published; audit publish OFFER | PASS | 11 |
| 3d | Claim → Release → re-claim | offer 2 | toggles | Works ("You · 9:55" badge) | PASS | 12 |
| 3e | Reject with reason | Reject → Out of scope + detail | Removed, never public, audit with reason | As expected | PASS | 13, 13b, 14 |
| 3f | Rejected item public? | /give-help, GET /offers | never | not visible | PASS | 37, 38 |
| 3g | Edit/correct published offer | Boards → Edit → Save | public updated, audit edit | GET /offers shows "[edited by moderator]"; audit edit OFFER | PASS | 23, 24, 25 |
| 3h | Offer → matched | POST /offers/:id/status {matched} (API; UI has only Edit/Archive for offers) | 200, audit | 200; public matched; audit status:matched | PASS | — |
| 4a | Need → claim code → print → redeem → ledger | /get-help anon | need created | BLOCKED: Turnstile never renders headless; submit → 400; API no-token 400 / bogus 400 (enforcement PASS); zero published needs on dev | BLOCKED | 07, 07b, 08b |
| 4b | Print claim list | Desk → Print, Kathmandu W5 → Load list | sheet/empty | Clean empty state; "Print this sheet" disabled when empty | PASS (empty) | 26, 32 |
| 4c | Paper sync unknown code | "E2E0-BOGUS-CODE" → Sync | per-code result | "E2E0-BOGUS-CODE unknown" | PASS | 33 |
| 4d | Public ledger | /ledger | loads | loads, empty | PASS | 36 |
| 5a | Article moderation | Desk → Articles → Publish | public + audit | One-click publish (no confirm); GET /dispatches includes it; /articles/016690cd… renders; audit publish DISPATCH | PASS | 20, 28, 34 |
| 5b | Story moderation | Desk → Stories → Publish | public + home strip + audit | One-click; GET /stories includes it; home strip shows it; audit publish STORY | PASS | 29, 30 |
| 5c | Story eligibility | POST /me/stories as helper before/after offer matched | 403 → 201 | 403 story_not_eligible → 201 after match | PASS | — |
| 5d | Poster moderation | — | verify → publish | No /moderation/missing* route exists; GET /missing public on submit; owner edits via /me/missing/:id | FINDING | — |
| 5e | Project moderation | Desk → Projects | verify committee → publish | Not exercised (project creation needs Turnstile); empty state captured | BLOCKED | 19 |
| 6 | Flag a need | POST /needs/:id/flag / Desk → Flags | flag visible | BLOCKED (needs a need + Turnstile); Flags empty state captured | BLOCKED | 18 |
| 7 | Audit | GET /audit?month=2026-09, /audit | every action, masked | All actions present; labels masked (Beta (., t***@…); no phones; cache-control max-age=60 | PASS | 35 |
| 8 | Organizations tab | Desk → Organizations | view | Helper-agent org under Pending; not acted on | PASS (view) | 22 |

## 2. Bugs / issues

| Sev | Issue | Repro | Shot |
|---|---|---|---|
| P1 | Missing-person posters bypass moderation: no /moderation/missing* route; live on submit (GET /missing). Contradicts principle #1. If intentional (time-critical), document it. | server/src/router.js; submit poster → GET /missing | — |
| P1 (env) | Turnstile never renders headless → needs/projects/flags untestable by automation; the claim→print→redeem→ledger chain has no data on dev. Fix: dev-only Cloudflare test keys (1x00000000000000000000AA / 1x0000000000000000000000000000000AA). | node b_anon_need.mjs | 07b, 08b |
| P2 | Widget-load failure: "Verification required" over a blank box, submit still allowed, error reads "Something went wrong on our side" — actual cause is the missing token. | /get-help where widget can't render | 08b |
| P2 | Masked name renders "Beta (." for "Beta Tester (Helper)" — keeps "(" and drops the rest; in queue, public helperLabel, audit. | any display name containing "(" | 09, 35 |
| P2 | Offers show "W—" (no ward) in meta line; reads as missing data. | queue/boards with an offer | 09, 23 |
| P2 | Published offers appear on no public page; /give-help board is needs-only, yet GET /offers is public. Surface them or restrict the endpoint. | /give-help after publishing an offer | 37, 38 |
| P2 | Reject dialog: Reject button enabled with no reason selected; validation only after click. | claim → Reject → click | 13 |
| UX-nit | Guidelines ack button with unchecked box gives no feedback. | 1c | 02 |
| UX-nit | Article/story Publish are one-click, no confirm/undo — inconsistent with needs/offers (checkbox) and reject (dialog). | 5a/5b | 20, 29 |
| UX-nit | Timestamps US-formatted ("9/6/2026, 3:10:59 PM") in both languages, no TZ label. | any card | 09 |
| UX-nit | /audit cached 60 s — a moderator may not see their own action immediately. | 7 | — |
| UX-nit | Chat FAB overlaps Desk cards/actions on mobile. | 390 px Desk | 31, 32 |
| UX-nit | Mobile Desk nav is a clipped horizontal scroller ("Print cla…") with no overflow cue. | 390 px | 31 |
| UX-nit | Dev data hygiene: two active incidents both named "Test" → every card carries a "Test" chip. | 09 | 09 |

## 3. UX observations

- Queue ergonomics are strong: public preview vs private details side-by-side, duplicate check, mandatory "I called the registrant" before Publish, claim/release prevents double work. The claimed badge is subtle — a stronger "you're working on this" state would help.
- First-run is three gates (guidelines → districts → queue); district search + checklist handles 77 districts well; copy says scope is editable later (true, but never clearable).
- Reject dialog copy ("The registrant hears this reason when called") is the best moment of the flow.
- Print list picker + empty state are clean; print CSS of a populated sheet could not be evaluated. Paper sync per-code results suit field use.
- Boards: offers get only Edit/Archive — matched/fulfilled for offers is API-only, so a moderator can't close an offer's loop in the UI.
- Three different confirmation models across item types (checkbox / dialog / none).
- NE toggle present on Desk; not exercised this run.

## 4. Test data (E2E-0906-mod)

| Type | ID | Final state |
|---|---|---|
| Offer | ab9360e0-7a15-4543-a0d9-f0ca242a5c2d | published → edited → matched (public) |
| Offer | 6eee96e1-82d8-403e-8a87-c2f5bb40e86f | rejected (out_of_scope) |
| Article | 016690cd-f2d6-4ced-9ae2-b3f21249d3d0 | published |
| Story | 511512d4-a8ee-467e-94ea-fe0c842d45ed | published (public + home strip) |
| Moderator profile | moderator-beta-tester@… | guidelines acked; districts = Kathmandu, Kaski |
| Untouched | helper-agent offer d821d6e3…, article, org 64d3b48a… | left pending |

## 5. Environment limitations

- Turnstile (managed, sitekey 0x4AAAAAAEkBp90mEl2o4Ebs) never renders under headless Chrome even with non-headless UA + AutomationControlled disabled → all anonymous writes untestable; server enforcement confirmed.
- Story/article media presign not exercised; fixtures reused an existing approved-incident CDN file id.
- 15-min tokens → re-login per batch. Shared dev DB with other agents; audit entries interleave.
