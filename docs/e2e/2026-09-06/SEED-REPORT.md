# Dev seed report — 2026-09-06

Target: `verifiednepal-dev` (DynamoDB, ap-south-1, account 129264592326), OnlyUtils dev client `ou_client_34HIKupJ5afWl0DIoh7zi`. Nothing touched prod. Every free-text field carries `[seed]`; every account email ends in `@verifiednepal.com`. Manifest with every id/code: `seed-manifest.json` (same folder).

## Counts

| Type | Total | States |
|---|---|---|
| Helper accounts | 100 | 25 loggable (OnlyUtils password accounts, allow-listed) + 75 profile-only (`seed_helper_026..100`); role `helper`, 0–3 districts each, `createdAt` spread over 30 days |
| Incidents (disasters) | 7 new (+3 pre-existing) | 4 active (admin-created), 1 archived, 1 pending (community request w/ photo), 1 rejected (community request). Note: `e2e-0906-admin-landslide-a` was archived by another tester mid-run |
| Needs | 150 | 61 published · 45 pending · 19 matched (15 via offers, 4 via org claim) · 15 fulfilled (7 single redeem, 3 `/claims/sync`, 5 org deliver) · 10 rejected. 3 flagged, 5 with helper groups, 9 with photos, 26 owned by signed-in helpers (dashboard pointers), 2 renewed. 66 NE / 84 EN, 60 % on-behalf, 22 districts, 7 incidents + general bucket |
| Offers | 120 | 55 published · 40 pending · 15 matched · 10 rejected; ~25 % with an org label |
| Moderation extras | — | 6 claim-lease demos, 1 need edit, 1 offer edit, 6 edited-on-publish; actions split moderator (Kathmandu/Kaski scope) vs admin (rest) so `/audit` shows both |
| Print sheets | 3 | Dolakha w5, Tanahun w7, Jhapa w11 (`printSheets` in manifest) |
| Helper groups | 5 | each: starter + joiner, 3 items, 1 done, 1 claimed, 1 released |
| Organizations | 8 | 5 verified (2 known, 2 self_declared, 1 vouched), 2 pending, 1 rejected; org 1 has an accepted staff member, org 3 has a declined + an open invite |
| Drop centers | 10 | 1–2 per verified org, lat/lng, hours, accepts 3–6 goods |
| Goods entries | 41 + transfer set | intakes, distributions, 1 center→center transfer received with 2-unit discrepancy, 1 external transfer, 1 correction |
| Donations | 10 | 7 received (1 partial qty), 1 not_received, 2 declared → `/donation/<ref>` pages resolve |
| Center flags | 1 | reason `closed` |
| Projects | 15 | 6 published, 1 in-progress, 1 completed, 5 pending, 2 rejected; 8 photos (6 committee path → 4 published/2 pending, 2 moderator path); 15 updates (13 published, 1 rejected, 1 pending) |
| Articles | 20 | 10 published (views/likes/shares bumped), 5 pending (1 is a rejected→revised→resubmitted), 4 drafts, 1 rejected; 7 covers + 4 image blocks uploaded |
| Stories | 15 | 10 published, 4 pending, 1 rejected; 6 with fresh uploads |
| Missing posters | 15 | 8 missing, 5 found (1 via edit), 2 safe; 6 with photos |
| Climate | — | 26 message submissions across 10 countries, 8 downloads |

Public spot checks after seeding (anonymous GETs): `/needs?incidentId=…` 13–20 items, `/offers` 20, `/projects` 4, `/dispatches` 11, `/stories` 11, `/missing` 16, `/centers` 10, `/goods-ledger?district=Sindhupalchok` 10, `/audit?month=2026-09` 20, `/incidents` 6 active, `/climate/messages` 69 rows.

## Loggable helper credentials (dev only)

Password for all: `E2eTest!2026Pass`. Sign in via the "Test account sign-in (dev only)" form on `/desk/login`, or `POST https://auth.onlyutils.com/login {email,password,client_id}`.

| # | Email | Display name | ou_user |
|---|---|---|---|
| 01 | helper-01-beta-tester@verifiednepal.com | Beta Helper 01 (owner: Sindhu Youth Relief Network, verified/known) | ou_user_34K2hKz9lNMPt0icHQp30 |
| 02 | helper-02-beta-tester@verifiednepal.com | सीता तामाङ (Beta 02) (owner: Pokhara Mothers Group, verified/self_declared) | ou_user_34K2hPjjv2gqHp5Lk8spN |
| 03 | helper-03-beta-tester@verifiednepal.com | Beta Helper 03 (owner: Himalaya Care Foundation, verified/known) | ou_user_34K2hSAFinvy0U5HFujOb |
| 04 | helper-04-beta-tester@verifiednepal.com | Beta Helper 04 (owner: Koshi Boat Volunteers, verified/vouched) | ou_user_34K2hVls0xyrqLy3Rb72r |
| 05 | helper-05-beta-tester@verifiednepal.com | रमेश श्रेष्ठ (Beta 05) (owner: Karnali Trust Hospital Outreach, verified) | ou_user_34K2hZfoYeSnTEoOyobEF |
| 06 | helper-06-beta-tester@verifiednepal.com | Beta Helper 06 (owner: Gorkha Rebuild Society, pending) | ou_user_34K2hcjVfIJcAW9fSgtx3 |
| 07 | helper-07-beta-tester@verifiednepal.com | Beta Helper 07 (owner: Valley Logistics Pvt, pending; filed the rejected disaster report) | ou_user_34K2hgadMDWO4dkMCD0vN |
| 08 | helper-08-beta-tester@verifiednepal.com | अनिता गुरुङ (Beta 08) (owner: Instant Relief Nepal, rejected) | ou_user_34K2hkHJvV2sAi9SO1ES8 |
| 09 | helper-09-beta-tester@verifiednepal.com | Beta Helper 09 (staff of org 1) | ou_user_34K2hnl2h4x4LlRWXKkSC |
| 10 | helper-10-beta-tester@verifiednepal.com | Beta Helper 10 (declined org 3 invite) | ou_user_34K2hr02nVSsKynyidD2N |
| 11 | helper-11-beta-tester@verifiednepal.com | Beta Helper 11 (has an open invite from org 3) | ou_user_34K2htKzwdXViYJQzxoFa |
| 12 | helper-12-beta-tester@verifiednepal.com | विकास राई (Beta 12) | ou_user_34K2hvuxiu7wTB4PSxa2w |
| 13 | helper-13-beta-tester@verifiednepal.com | Beta Helper 13 | ou_user_34K2hybqg06hzoC6ZL170 |
| 14 | helper-14-beta-tester@verifiednepal.com | Beta Helper 14 | ou_user_34K2iAIuIIotzR6C3xasA |
| 15 | helper-15-beta-tester@verifiednepal.com | सुनिता मगर (Beta 15) | ou_user_34K2iDnzlem8HoGxOjJjf |
| 16 | helper-16-beta-tester@verifiednepal.com | Beta Helper 16 | ou_user_34K2iGE7Aoqj5uLRmapOy |
| 17 | helper-17-beta-tester@verifiednepal.com | Beta Helper 17 | ou_user_34K2iJmuLSZ86EJhjZkI3 |
| 18 | helper-18-beta-tester@verifiednepal.com | प्रकाश लामा (Beta 18) | ou_user_34K2iNKizxQgyWJV4DYbt |
| 19 | helper-19-beta-tester@verifiednepal.com | Beta Helper 19 | ou_user_34K2iQmUz7WK5LxCU7EGc |
| 20 | helper-20-beta-tester@verifiednepal.com | Beta Helper 20 | ou_user_34K2iTiOqDj5qplGyPrZK |
| 21 | helper-21-beta-tester@verifiednepal.com | Beta Helper 21 | ou_user_34K2iX966laabGIrXr2ZW |
| 22 | helper-22-beta-tester@verifiednepal.com | कमला थापा (Beta 22) | ou_user_34K2iaM3PGW5Bk4KEulW5 |
| 23 | helper-23-beta-tester@verifiednepal.com | Beta Helper 23 | ou_user_34K2icaBVWlgiGCnSYEaG |
| 24 | helper-24-beta-tester@verifiednepal.com | Beta Helper 24 | ou_user_34K2ig5As1Ci5fTlRzFL2 |
| 25 | helper-25-beta-tester@verifiednepal.com | दीपक भट्टराई (Beta 25) | ou_user_34K2ijchcyhQCG1n8ittv |

Every helper has offers, ~half have articles/posters, helpers 01–05 also own orgs + centers. Which helper owns what: `seed-manifest.json` (`owner`, `helper`, `author` fields). The test-audience allow-list now holds 35/100 entries.

## Media (Part D)

44 uploads, all through the app's own presign handlers with the real OnlyUtils media service (`client_credentials` with the `e2e-agent-ropc-testing` secret), then `PUT` to the returned S3 URL, then a `GET` on the CDN URL. **44/44 PUT 200, 44/44 CDN 200, no presign failures.**

| Flow | Handler | Uploads |
|---|---|---|
| Need photos | `POST /needs/media/presign` → `media[]` on `POST /needs` | 10 (9 attached; one need creation was rejected for an archived incident before the fix and re-created without media) |
| Project photos, committee path | `POST /projects/:id/photos/presign` + `POST /projects/:id/photos` with `X-Update-Code` → `publish-photo` on 4 | 6 |
| Project photos, moderator path | same, Bearer moderator/admin (published immediately) | 2 |
| Article cover / image blocks | `POST /me/articles/media/presign` | 7 + 4 |
| Story photos | `POST /me/articles/media/presign` (there is no story-specific presign route; `storyController` only validates `media.url` under `MEDIA_PUBLIC_BASE`) | 6 |
| Missing posters | `POST /me/missing/presign` + `PUT /me/missing/:id` | 6 |
| Disaster reports | `POST /me/missing/presign` (any presign works — the incident request only needs `fileId`+`originalUrl`) | 2 |
| Smoke | `POST /needs/media/presign` | 1 |

Image pool: 12 disaster photos from `~/Downloads/rm-test-data/img/dis` (3 AVIF skipped — PIL 10.4 has no AVIF decoder) + 14 fallback stock photos, all re-encoded to JPEG ≤1400px / ≤520 KB (`seed/img/`). Sample CDN URLs:

- https://cdn.dev.verifiednepal.com/media/ou_client_34HIKupJ5afWl0DIoh7zi/ou_file_34K7LmM7XcO5H5oEMLHoH/seed-a01.jpg
- https://cdn.dev.verifiednepal.com/media/ou_client_34HIKupJ5afWl0DIoh7zi/ou_file_34K7LoBUT8dDIe52JVPUF/seed-a02.jpg
- https://cdn.dev.verifiednepal.com/media/ou_client_34HIKupJ5afWl0DIoh7zi/ou_file_34K7Lpid3dNxxmJ014QVb/seed-a03.jpg
- https://cdn.dev.verifiednepal.com/media/ou_client_34HIKupJ5afWl0DIoh7zi/ou_file_34K7LulXm0nWZumedgcTn/seed-a04.jpg
- https://cdn.dev.verifiednepal.com/media/ou_client_34HIKupJ5afWl0DIoh7zi/ou_file_34K2pLfVkhsq8O5kO13OI/seed-01.jpg

## How it works / re-run / extend

`seed/lib.mjs` imports `createHandler` from `server/src/index.js` and calls the Lambda's `route()` in-process with: a DynamoDB DocumentClient on 1-hour assume-role creds (fetched fresh via `aws sts assume-role --profile out-mgmt` at import), the dev env (`TABLE_NAME`, `AUTH_AUDIENCE`, media vars) **without `TURNSTILE_SECRET`** (so `verifyTurnstile` is skipped — `server/src/lib/turnstile.js:4-8`), a local RSA JWK as `fetchJwks`, and locally minted RS256 tokens whose `sub` is the real `ou_user_…` id. Every record therefore went through the same validation, GSIs, pointers and audit writes as production traffic. `node_modules` is a symlink to `server/node_modules`; nothing was written inside the repo.

```
cd scratchpad/seed
node seed.mjs                      # all phases, in order
node seed.mjs needs offers         # named phases only; counts top up to their targets, nothing is duplicated
```
Phases: `profiles incidents needs offers moderate matches flags groups orgs projects articles stories missing climate`. State lives in `seed-manifest.json` and is saved after every phase (and every 25 records inside the long loops), so a stop mid-way resumes cleanly. Moderation actor is chosen per district (`modFor`): moderator-beta-tester for Kathmandu/Kaski (its current scope), admin-beta-tester elsewhere — the moderator's `guidelinesAckAt` and districts were left untouched. To extend: add records to a phase's defs array or raise its `target`, re-run that phase.

Cleanup: everything is greppable by `[seed]` / `seed_helper_` / `-beta-tester@verifiednepal.com`; media file ids are listed under `media[]`.

## What failed, and observations that are real findings

Handler failures: **none** after the pool fix. The 29 `400 invalid incident` errors in the first pass were caused by `e2e-0906-admin-landslide-a` being archived by another tester while the run was in progress (needs/offers against it were simply not created and the run topped up).

Observations from driving every write path (not bugs in the seed, worth a look):

1. **Asymmetric incident gate** — `POST /needs` accepts a `pending` incident (`needController.js:91`), `POST /offers` and `POST /projects` require `active`. A helper can file a need against a not-yet-approved disaster but cannot offer help for it.
2. **No cross-incident public listing** — `GET /needs|offers|projects` all `400` without `incidentId`; the general bucket is only reachable as `incidentId=general`. Any "all open needs" board must fan out per incident client-side.
3. **Story presign is borrowed** — there is no `/me/stories/*/presign`; the UI must be using the article (or poster) presign. Works, but the story controller's `MEDIA_PUBLIC_BASE` check is the only guard.
4. **`storyRole` order** — a person who both received and gave help is reported by whichever pointer is read first ("needy" wins only if that pointer is hit before an offer); 15/15 seeded stories resolved as `helper` although several authors also own a fulfilled need.
5. **Admin-created incidents cannot be rejected**, only archived after publish; `reject` is community-request-only (`incidentController.js:204`). Fine by design, but the Disasters tab will show no reject action on them.
6. **`/ledger` requires a district** and is empty for districts with no redemption — `/ledger?district=Kathmandu` is 0 even with 15 fulfilments elsewhere; a district picker without counts will feel broken.
7. **Rejected-then-resubmitted article** keeps its original `createdAt` ordering — resubmission does not bump it to the front of the moderation queue.
