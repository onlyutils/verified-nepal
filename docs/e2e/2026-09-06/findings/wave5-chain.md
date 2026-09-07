# Wave 5 — login policy, registrant dashboard, group → drop center → hand-over chain (dev, 2026-09-07)

All steps passed (API + real UI, including the Radix drop-center picker). Screenshots in the tester's scratch folder `e2e/wave5-chain/` (mobile-01…05 for the five requested mobile screens).

| Area | Checks | Result |
|---|---|---|
| Login policy | on-behalf without token → 401 sign_in_required; anonymous self-registration still needs Turnstile (400 without); /projects anonymous → 401; sign-in nudges shown in the UI for "Someone else" and project registration | PASS |
| Registrant | register on behalf (consent) → /me pending + reference code → moderator publish → claim code on /me → helper takes (masked name shown) → delivers → code redeemed → timeline taken → handed over → confirmed; no claimCode on public /status or /needs | PASS |
| Group via drop center | form + join → take as group → "Send via a drop center" → drop-off code → both members' /me at "declared" with unread badges → org Inbound shows need context → confirm received → "received" → org Needs "Goods received — hand over" → hand over → ledger "Helper group (2) via Community hall depot — Sindhupalchok" + goods-ledger distribution with needId → claim code redeemed → "confirmed" on both members and the beneficiary status page | PASS (run twice: API, and through the real UI) |
| Channel switch | center ↔ direct allowed before receipt; after receipt → 409 goods_already_received | PASS |
| Access control | non-member set channel → 409; non-member confirm donation → 403; non-org-member deliver → 403; org deliver before receipt → 409 | PASS |
| Badges | counts per section after changes; POST /me/seen clears one section; header avatar total; visiting /me auto-clears the visible sections | PASS |

Follow-ups (batch 15): hide "Mark delivered" while goods are en route to a center and keep the drop-off instructions/code visible on the card; "1 pieces" plural; /org tab strip overflow cue on mobile; keep the expanded card after the board reloads.

Data changed: need 1ff55dec (ref AHLSN7ZL5OB4) fulfilled/confirmed (registered by helper-17, delivered by helper-20); need fde9b1a0 (ref 4FEAY4XXO5KH) fulfilled/confirmed via drop center d2d6c137, donation DEY3LD4E2RFJ; need dbf3e90d matched, donation OTONWHTKEZZJ left declared (live Inbound example); need 610ddde8 (ref 5E2EAK2KWDGS) matched, donation HHXQOG44ZV7S declared via the UI. No roles changed.
