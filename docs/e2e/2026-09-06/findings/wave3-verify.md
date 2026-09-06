# Wave 3 — verification of the overnight fixes on dev (2026-09-07, ~01:00–02:00 NPT)

Deploys confirmed (frontend bundle + backend Lambda for batches 1–5). 22 checks: 19 pass, 2 partial, 1 new P1 regression. Screenshots and raw JSON in the scratch folder `e2e/wave3-verify/`.

| # | Check | Result | Notes |
|---|---|---|---|
| — | NEW: hard load of `/` renders the 404 view | FAIL P1 | client-side navigation to "/" works; fresh profile / reload shows "Page not found" (fixed in batch 6) |
| 1 | VN-02 no pending/internal fields on public incidents | PASS | |
| 2 | VN-09 district validation on role set | PASS | |
| 3 | VN-11/08 audit labels, single masked names, typed targets, specific verbs | PASS | |
| 4 | VN-03/04 contrast | PARTIAL | `--muted-foreground` now 7.2:1; climate labels legible; `.text-subtle` tagline still 3.2:1 (batch 6) |
| 5 | VN-05 404 page EN/NE | PASS | |
| 6 | VN-19 compact mobile emergency bar; h1 at y=190 | PASS | |
| 7 | VN-21/22 login h1/labels; toggle "नेपाली"/"English" everywhere | PASS | |
| 8 | VN-06 Turnstile: submit disabled + hint, "Verification" label | PASS | |
| 9 | VN-15/16 honest empty states; no draft banner on first visit | PASS | |
| 10 | VN-18 View vs Edit on /me/articles | PASS | |
| 11 | VN-24 helper on /desk sees the explanation, no redirect | PASS | |
| 12 | VN-36 poster photos | PARTIAL | board thumbnails render; detail dialog still empty (batch 6) |
| 13 | VN-37/38/39 transfer label, donation code label, no Renew on fulfilled | PASS | |
| 14 | VN-40/41 Match + Redeem on desktop and mobile → /ledger | PASS | new P2: match result panel prints `[object Object]` (batch 6) |
| 15 | VN-42 flag Resolve + audit row + deep link | PASS | |
| 16 | VN-10/14 confirmations; Reject disabled until reason | PASS | org reject validates on submit instead (batch 6 nit) |
| 17 | VN-26 /desk/boards, /desk/flags survive reload; /desk/login intact | PASS | |
| 18 | VN-27 dates | PARTIAL | Desk cards "06 Sept 2026, 18:26 NPT"; audit month dropdown still English in NE (batch 6) |
| 19 | VN-28 mobile Desk nav cue; chat FAB hidden on /desk | PASS | |
| 20 | VN-20 searchable district picker with chips | PASS | |
| 21 | VN-43/44 org reject reason in audit; "Vouched for" only with vouches | PASS | |
| 22 | VN-45/46/47 group persists across reloads; "+" phones save; /org#needs reload | PASS | |

Data changed and left: need 7d36c18d (Sunsari) matched + redeemed → fulfilled (ledger); center flag on 69b474d7 resolved; org 64d3b48a vouched then rejected with a reason; helper-09 formed a group on a Morang transport need. Restored: moderator scope (Kathmandu, Kaski), throwaway account (helper, no districts).
