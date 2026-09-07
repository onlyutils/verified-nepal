# Wave 4 — self-service take / deliver for helpers and groups (dev, 2026-09-07)

API-driven with browser verification of the Desk Boards handler/release UI. 8 of 9 flows run; mobile screenshots not run (driver hang under the time budget).

| Step | Expected | Actual | Result |
|---|---|---|---|
| Helper takes a published need | matched | matched | PASS |
| Taker reads private contact | 200 with contact | 500 | FAIL P1 (fixed in batch 11) |
| Non-taker reads contact | 403 | 403 not_need_handler | PASS |
| Hand back → retake → deliver | published → matched → fulfilled | as expected | PASS |
| Ledger row | deliveredBy masked label | label ok, but raw `ref` id leaked | PASS with P2 (fixed in batch 11) |
| Beneficiary status page | taken / delivered text | shows handler + deliverer | PASS |
| Take limit | 4th take → 409 take_limit, bilingual UI message | as expected | PASS |
| Group form → join → group take → deliver | matched "Helper group (2)" → fulfilled | as expected | PASS |
| Org claim on a group-taken need | 409 | 409 need_not_available | PASS |
| assignOnly (moderator toggle) | take hidden/403; moderator match still works | as expected | PASS |
| Paper Sync after helper delivery | confirmedAt on the same ledger row, no duplicate | as expected | PASS |
| Desk Boards handler + Release | label + Release → published | as expected | PASS |
| Story eligibility | deliverer 201, others 403 | as expected | PASS |

Bugs: P1 contact endpoint 500 (nested `contactViewedBy` map never initialised); P2 public ledger JSON exposed `deliveredBy.ref`. UX: Desk Boards had no disaster selector (depended on a localStorage value set by the public offer dialog); `countActiveHelperTakes` scanned the table per take. All four addressed in batch 11.

Data changed: need 19f1691e (Gorkha) fulfilled + confirmed; 69805872, 6b63c13d, e1e4a9ab matched by helper-13; 13b7a6d9 (Sindhupalchok) fulfilled by a helper group; 3c1ee73f (Kaski) assignOnly + moderator-matched; a1666233 (Tanahun) taken then released by admin; story 0cf64ac8 pending. No roles changed.
