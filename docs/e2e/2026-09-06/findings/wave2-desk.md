# Wave 2 — moderator + admin Desk at volume (dev, 2026-09-06/07 night)

Moderator scope temporarily widened to 10 districts for a 51–54-item queue, restored to Kathmandu + Kaski at the end. Screenshots 01–45 in this folder (files named in the table below; s1_*–s6_* scripts and 01-queue-admin-desktop.png…20-project-after-publish.png belong to an earlier aborted run).

## Results
| # | Step | Expected | Actual | Result | Shot |
|---|---|---|---|---|---|
| 1b | Queue at volume | 40+ items, badge | 51–54 items, "Queue 51" | PASS | 01-queue-volume-desktop.png |
| 1c/1d | District filter · free-text search | narrows | narrows | PASS | 02, 03 |
| 1e | Claim → tick → Publish need (Kailali b2d43277) | public | GET /needs published | PASS | 04, 05 |
| 1f | Check status with its refCode | Published + claim code | shown | PASS | 45-check-status.png |
| 1g | Claim → Reject with reason (Gorkha eab1756e) | gone, never public | gone | PASS | 06, 07, 08 |
| 1h | Claim → Release (Lalitpur a1f3a205) | pending, unclaimed | confirmed | PASS | 09, 10 |
| 2a/2b | Out-of-scope need (Achham) UI + API | hidden / 403 | hidden; 403 out_of_scope | PASS | 12 |
| 3a | Boards: match need ↔ offer (e8bcc44c ↔ fc76d02d) | matched | matched (mobile markup only — VN-40) | PASS* | 13, 14 |
| 3b | Boards: Redeem a claim code | button + redeem | button never renders (VN-41) | FAIL | — |
| 3c | Redeem via Paper Sync (Z853583J, 5DS5NJVT) | fulfilled, ledger masked | both redeemed; /ledger masked, no phone | PASS | 18-sync-results.png |
| 4a/4b/4c | Print sheet desktop · PDF · mobile | QR, code, masked name | correct; mobile "Category" column clips | PASS (nit) | 36-print-sheet-desktop.png, 37-print-sheet.pdf, 40-mobile-print-sheet.png |
| 5 | Sync 2 valid + 1 bogus | per-code | redeemed/redeemed/unknown | PASS | 18 |
| 6a | Flags tab | flags listed | 1 need flag + 1 center flag | PASS | 35-flags.png |
| 6b/6c | Resolve · jump to item | available | no resolve anywhere; need flags show inert id (VN-42) | FAIL | 35 |
| 7a–7c | Projects: verify+publish d5a71a86 · approve update 379fd4ac · approve photo (7c6fbb76) | public, CDN | all confirmed, CDN 200 | PASS | 19–24 |
| 8a/8b | Orgs: verify b507e74f (tier known) · reject 4cf99017 | states + reason | verified/rejected; reason stored | PASS (VN-43 audit) | 27–30 |
| 9 | Reject article 3819be41; author (helper-08) sees reason | rejected + reason | confirmed via /me/articles/:id | PASS | 31–34 |
| 10a | Admin: approve pending disaster (Bhaktapur market fire) | active | active | PASS | 41, 42 |
| 10b/10c | Admin stats · Climate counts | non-zero | 40 pending / 59 published needs…; 83 messages / 14 downloads | PASS | 43, 44 |
| 10d | /audit masking by target type | masked | NEED/ORG/PROJECT/DISPATCH/INCIDENT/CENTER/GOODS/UPDATE masked | PASS | — |

## Bugs
- VN-40 P1 — Boards "Match" (need ↔ offer) exists only in the mobile card markup (src/desk/boards.tsx NeedActions in the md:hidden block); the desktop table has no offer picker or Match button. A laptop moderator cannot match at all.
- VN-41 P1 — Boards "Redeem a claim code" never renders: GET /needs (server/src/views/need.js toPublicNeedListItem) omits claimCode, and both Redeem buttons gate on need.claimCode. Redemption only works via Paper Sync or the raw API.
- VN-42 P2 — Flags tab has no resolve action (UI or backend) for need flags or center flags; need flags show the needId as inert text with no link.
- VN-43 P2 — Org reject writes audit reason "reject" literally (orgController.js:380) instead of the moderator's reason.
- VN-44 P2 — "Vouched for" tier on an org with no vouches fails with the generic "Something went wrong on our side" (server 400 "no vouches recorded" not surfaced; option offered regardless).
- nit — reject-article dialog reuses "The registrant hears this reason when called".
- nit — mobile print sheet clips the Category column.
- nit — mobile Desk nav scroller / chat FAB overlap still present (pre-batch-4 build).

## UX
- Desktop table and mobile card renderings are maintained separately per section; Boards proves they drift — add an action-parity check.
- Print sheet is field-ready; Paper Sync is the best-designed recovery path; admin Stats/Climate are single-glance; district self-service works well; Flags lacks a jump-to-item.

## Data changed
Needs b2d43277 published · eab1756e rejected · a1f3a205 released (pending) · 3ade98ce published · e8bcc44c matched (offer fc76d02d) · 08caa440 + fe06eb17 fulfilled (codes Z853583J, 5DS5NJVT) · project d5a71a86 published · update 379fd4ac published · photo ou_file_34K7RAJNm8SEUh2p9I8Gn published · org b507e74f verified (known) · org 4cf99017 rejected · article 3819be41 rejected · incident seed-bhaktapur-market-fire active · moderator scope restored to Kathmandu, Kaski.
