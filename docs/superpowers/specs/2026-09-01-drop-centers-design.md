# Organizations, drop centers and the goods ledger — design

Status: approved by the owner 2026-09-01 (chat). Implemented in three phases
(see `docs/superpowers/plans/2026-09-01-drop-centers.md`).

## Problem

Groups collect relief goods at physical drop centers. The site should let
people find those centers, let the organizations running them account for
what came in and went out, and let a donor see that what they dropped moved
through the system — without promising item-level chain of custody that
nobody can verify.

## Decisions (and the weak spots they answer)

1. **Organizations are the trust unit, not centers.** Anyone signed in with
   Google can register an organization. Moderators verify the organization
   once; its centers need no separate verification.
2. **Verification never blocks usage.** A newly registered org is
   `pending` (provisional): it can create centers and log goods immediately;
   its centers are public but badged *unverified*. Verification upgrades the
   badge. Rejection or suspension hides the centers (ledger data is kept).
3. **"Verified" has a written meaning.** The moderator approval form
   requires a tier and a note. Tiers: `known` (on a seed list / established
   org), `vouched` (an already-verified org vouched for them), `self_declared`
   (moderator checked what they could). The tier is public.
4. **Goods are tracked at category + quantity, never per item.** Fixed
   taxonomy with one canonical unit per category (below). Free-text units
   are not accepted.
5. **The ledger is append-only and is the single source of truth.** Stock on
   hand is computed from entries; there is no separately edited inventory.
   Mistakes are fixed with a *correction* entry that reverses the original
   (the original stays, marked corrected). Entries are never edited or
   deleted.
6. **Transfers are two-sided.** Sending center logs `transfer_out`
   (stock drops, entry is *in transit*). Receiving center logs what actually
   arrived, which creates its `transfer_in`. A quantity mismatch is recorded
   as a discrepancy on both sides — that number is the point of the feature.
   Transfers to off-platform destinations end at "sent".
7. **Donor codes are opt-in and never claim per-donation delivery.** A donor
   can declare a drop (QR/link at the center) and get a code. The code's
   status page shows what is true: received (once staff confirm) and, since
   then, how much of that category the center distributed or transferred.
   Bulk intake without any donor code is the normal case.
8. **One org, many people.** The registering account is the org *owner*.
   Owners invite *staff* by Google email; staff can only log entries;
   owners can revoke instantly.
9. **Poor connectivity is expected.** Entry logging queues in the browser
   when offline and flushes later. Not a full offline app.
10. **Everything is attributable and revocable.** Every org/center change and
    moderation action writes an `AUDIT` record. Entries carry the acting
    user's `sub`. Staff identities are never shown publicly.

Explicitly out of scope: money, per-item barcodes, automated registry
lookups, notifications.

## Roles

| Actor | Can |
|---|---|
| Public | Browse centers, see stock and activity (masked), declare a drop, flag a center |
| Signed-in user (`helper`) | Register an organization (max 3 owned) |
| Org owner | Edit org, manage centers, log entries, transfers, corrections, invite/revoke staff, confirm donor drops |
| Org staff | Log entries, transfers, corrections, confirm donor drops |
| Moderator / admin | Verify, reject, suspend, reinstate orgs; see flags; see everything |

## Goods taxonomy

`GOODS_CATEGORIES` (id → unit):

```
rice kg · lentils kg · flour kg · cooking-oil litre · salt-sugar kg ·
dry-food packet · drinking-water litre · tarpaulin piece · tent piece ·
blanket piece · mattress piece · clothing piece · hygiene-kit kit ·
sanitary-pads packet · soap piece · medicine kit · first-aid-kit kit ·
utensils set · solar-light piece · other piece
```

Units: `kg | litre | piece | packet | kit | set`. The server sets the unit
from the category; clients never send it.

## Data model (DynamoDB single table `PK`/`SK`, GSI1 `gsi1pk/gsi1sk`, GSI2 `gsi2pk/gsi2sk`)

### ORG
`PK=ORG#<id>` `SK=META`, `type:"ORG"`, `gsi2pk=ORG#<status>`, `gsi2sk=createdAt`.

Fields: `id, name, orgType (ngo|community|company|religious|government|other),
registrationNumber?, contactName, contactPhone, contactEmail?, districts[],
description, website?, status (pending|verified|rejected|suspended),
tier? (known|vouched|self_declared), ownerSub, ownerEmail?, createdAt,
updatedAt, verifiedAt?, verifiedBy?, verificationNote?, rejectionReason?,
suspendedAt?, suspensionReason?, vouches?: [{orgId, orgName, sub, at}]`.

### ORG membership (dual write)
`PK=USER#<sub>` `SK=ORG#<orgId>` → `{type:"ORGMEMBER", sub, orgId, role (owner|staff), orgName, createdAt}`
`PK=ORG#<orgId>` `SK=MEMBER#<sub>` → same fields plus `email?, name?`.

### ORG invite (P3)
`PK=EMAIL#<lower-email>` `SK=ORGINVITE#<orgId>` → `{type:"ORGINVITE", orgId, orgName, role:"staff", invitedBy, createdAt}`.
Materialized into a membership the first time that email calls `GET /orgs/mine`.

### CENTER
`PK=CENTER#<id>` `SK=META`, `type:"CENTER"`,
`gsi1pk=CENTER#<district>`, `gsi1sk=createdAt`,
`gsi2pk=CENTER#<visibility>` (`public|hidden`), `gsi2sk=createdAt`.
Pointer for the org dashboard: `PK=ORG#<orgId>` `SK=CENTER#<centerId>` → `{type:"ORGCENTER", centerId, name, district, status, createdAt}`.

Fields: `id, orgId, orgName, orgStatus, orgTier?, name, district, ward?,
address, lat?, lng?, hours?, contactPhone, accepts[] (goods categories),
notes?, status (open|paused|closed), createdAt, updatedAt, createdBy,
flagCount?`.

`visibility = public` iff `orgStatus ∈ {pending, verified}` and
`status ∈ {open, paused}`; otherwise `hidden`. Org status changes rewrite
every center of the org (via the pointer items).

### GOODS entry
`PK=GOODS#<centerId>` `SK=<createdAt>#<entryId>`, `type:"GOODS"`,
`gsi1pk=GOODS#<district>`, `gsi1sk=createdAt`.

Fields: `id, centerId, orgId, district, entryType
(intake|distribution|transfer_out|transfer_in|correction), category, unit,
qty (>0), delta (signed, server-computed), note?, createdBy, createdByName?,
createdAt, donationRef?, transferId?, destinationType? (center|external),
destinationCenterId?, destinationLabel?, transferStatus? (in_transit|received|sent),
qtyReceived?, discrepancy? (number), correctsEntryId?, correctedByEntryId?`.

`delta`: `+qty` for intake/transfer_in; `-qty` for distribution/transfer_out;
for correction `-original.delta`.

### TRANSFER inbox pointer (P2)
`PK=CENTER#<destCenterId>` `SK=INBOUND#<transferId>` → `{type:"INBOUND", transferId, fromCenterId, fromCenterName, category, unit, qty, entryId, createdAt}`; deleted on receive.

### DONATION (P3)
`PK=DONATION#<ref>` `SK=META` → `{type:"DONATION", ref, centerId, centerName, district, category, unit, qty, note?, status (declared|received|not_received), declaredAt, receivedAt?, intakeEntryId?}`.
Pointer for the center's confirm list: `PK=CENTER#<centerId>` `SK=DONATION#<declaredAt>#<ref>` (same fields); rewritten with the new status on confirm.

### FLAG on a center (P2)
Same shape as need flags: `PK=CENTER#<id>` `SK=FLAG#<iso>#<rand8>`, plus a
`PK=FLAGGED` `SK=CENTER#<id>` pointer; `flagCount` incremented on the center.

### AUDIT
Existing `buildAuditEntry`. New `targetType` values: `ORG`, `CENTER`,
`GOODS`. Label: org name / center name / `entryType category qty`.

## API contract

All routes live in `server/src/index.js`; JSON bodies; errors `{error}`.
Auth = `Authorization: Bearer <OnlyUtils token>` via `requireAuth`.
"member" = has a `USER#<sub>/ORG#<orgId>` item (any role) or is
moderator/admin; "owner" = membership role `owner` (moderators/admins are
not owners and cannot write org data).

### Phase 1

| Method & path | Who | Body / query | Response |
|---|---|---|---|
| `POST /orgs` | signed-in | `{name, orgType, registrationNumber?, contactName, contactPhone, contactEmail?, districts[], description, website?}` | `201 {id, status:"pending"}` (max 3 owned orgs → 400 `too many organizations`) |
| `GET /orgs/mine` | signed-in | — | `{items:[{...org, role}]}` |
| `GET /orgs/{id}` | member | — | org (private shape) |
| `POST /orgs/{id}` | owner | any of `name, orgType, registrationNumber, contactName, contactPhone, contactEmail, districts, description, website` | `{ok:true}` |
| `POST /orgs/{id}/centers` | owner | `{name, district, ward?, address, lat?, lng?, hours?, contactPhone, accepts[], notes?}` | `201 {id}` |
| `GET /orgs/{id}/centers` | member | — | `{items:[center private shape]}` |
| `POST /centers/{id}` | owner | any of center fields + `status` | `{ok:true}` |
| `GET /centers?district=&cursor=` | public | — | `{items:[center public shape], cursor?}` (public only; without `district` uses GSI2 `CENTER#public`) |
| `GET /centers/{id}` | public | — | center public shape + `stock:[{category,unit,qty}]` + `recent:[entry public shape]` (last 20) — 404 if hidden and caller is not a member |
| `GET /centers/{id}/stock` | public | — | `{items:[{category,unit,qty}]}` |
| `GET /centers/{id}/entries?cursor=` | public / member | — | `{items:[entry], cursor?}` newest first, 50/page; public shape omits `createdBy/createdByName` |
| `POST /centers/{id}/entries` | member | `{entryType: "intake"|"distribution", category, qty, note?}` | `201 {id}` |
| `GET /goods-ledger?district=&cursor=` | public | — | `{items:[entry public shape], cursor?}` |
| `GET /moderation/orgs?status=` | mod | status default `pending` | `{items:[org private shape + centersCount]}` |
| `POST /moderation/orgs/{id}` | mod | `{action:"verify", tier, note}` / `{action:"reject", reason}` / `{action:"suspend", reason}` / `{action:"reinstate"}` | `{status}` |
| `GET /admin/stats` | admin | — | adds `orgsPending`, `orgsVerified`, `centersPublic`; `ORG#pending` joins the oldest-pending loop |

Center public shape: `{id, name, district, ward?, address, lat?, lng?, hours?, contactPhone, accepts, status, org:{id,name,status,tier?}, createdAt, updatedAt, flagCount?}`.
Entry public shape: `{id, centerId, district, entryType, category, unit, qty, delta, note?, createdAt, transferStatus?, destinationType?, destinationLabel?, discrepancy?, correctsEntryId?, correctedByEntryId?}`.

Validation: org `name` 2–150, `orgType` enum, `registrationNumber` ≤100,
`contactName` 1–100, `contactPhone` via `validatePhone`, `contactEmail` via
`validateOptionalEmail`, `districts` 1–10 strings 1–100, `description`
10–2000, `website` ≤200. Center `name` 1–100, `district` 1–100, `ward` int
1–33, `address` 1–300, `lat` 26–31 / `lng` 80–89 (both or neither),
`hours` ≤200, `accepts` ⊆ taxonomy, ≤20, unique, `notes` ≤500. Entry
`category` ∈ taxonomy, `qty` finite number > 0 ≤ 1,000,000 (max 2 decimals),
`note` ≤500.

### Phase 2

| Method & path | Who | Body | Response |
|---|---|---|---|
| `POST /centers/{id}/entries` | member | `{entryType:"transfer_out", category, qty, destinationType:"center"|"external", destinationCenterId?, destinationLabel?, note?}` (`center` requires an existing public center ≠ self; `external` requires label 1–200) | `201 {id, transferId}` |
| `GET /centers/{id}/inbound` | member | — | `{items:[INBOUND]}` |
| `POST /transfers/{transferId}/receive` | member of destination | `{qtyReceived, note?}` | `201 {id}` — creates `transfer_in` (qty = qtyReceived) at destination, sets `transferStatus=received`, `qtyReceived`, `discrepancy = qty − qtyReceived` (when ≠ 0) on both entries, deletes INBOUND |
| `POST /centers/{id}/entries` | member | `{entryType:"correction", correctsEntryId, note}` (note required 3–500; original must belong to this center, not already corrected, not a `transfer_*` with a linked counterpart) | `201 {id}` |
| `POST /centers/{id}/flag` | public + Turnstile | `{reason: "not_real"|"closed"|"misuse"|"other", details?}` | `{ok:true}` |
| `GET /moderation/flags` | mod | — | existing inbox gains `centers:[...]` |
| `POST /orgs/{id}/vouch` | owner of a `verified` org | — | `{ok:true}` (target must be `pending`; one vouch per org) |

Moderation `verify` accepts `tier` ∈ `known|vouched|self_declared`; `vouched`
requires at least one vouch on the org.

### Phase 3

| Method & path | Who | Body | Response |
|---|---|---|---|
| `POST /orgs/{id}/members` | owner | `{email}` | `201 {status:"invited"|"member"}` (immediate membership if an `EMAIL#` pointer resolves the sub; else invite) |
| `GET /orgs/{id}/members` | owner | — | `{items:[{sub?, email, name?, role, status:"member"|"invited", createdAt}]}` |
| `DELETE /orgs/{id}/members/{subOrEmail}` | owner | — | `{ok:true}` (cannot remove the last owner) |
| `GET /orgs/mine` | signed-in | — | also materializes pending invites for the caller's email |
| `POST /centers/{id}/donations` | public + Turnstile | `{category, qty, note?}` | `201 {ref}` (12-char base32, same generator as need refCodes) |
| `GET /donations/{ref}` | public | — | `{ref, center:{id,name,district}, category, unit, qty, status, declaredAt, receivedAt?, sinceReceived?:{distributed, transferred}}` |
| `GET /centers/{id}/donations?status=` | member | default `declared` | `{items}` |
| `POST /donations/{ref}/confirm` | member of that center | `{qty?}` (defaults to declared) → creates an intake entry with `donationRef` | `{entryId}` / `{action:"not_received"}` → `{ok:true}` |

## Frontend

Routes (hand-rolled router in `src/App.tsx`): `/register-organization`,
`/org` (dashboard for the caller's orgs), `/drop-centers`,
`/drop-centers/:id`, `/donation/:ref` (P3). Nav gains **Drop centers**;
the landing hero gains a **Register organization** square button; the
masthead shows **My organization** when the signed-in user has a membership.

Sign-in return: `auth.signIn()` stores `sessionStorage["vn:return_to"] =
location.pathname + search`; after a successful code exchange on `/desk`
the app navigates there (only same-origin paths; cleared after use). The
OAuth `redirect_uri` stays `/desk` (registered with OnlyUtils).

Desk gets an **Organizations** tab (count = pending): each pending org
shows all fields, owner email, centers count, vouches, and a **Verify**
dialog (tier select + required note) / **Reject** dialog (reason). A
second list shows verified orgs with **Suspend** (reason) and suspended
orgs with **Reinstate**. Flags on centers appear in the existing Flags tab.

Org dashboard: org card (status badge + what it means), centers list,
add/edit center dialog, per-center panel with stock table, "Log entry"
form (type, category, qty, note), recent entries (corrected ones struck
through), and in later phases: transfers (send / inbound to confirm),
corrections, staff list, donor drops to confirm. Entries that fail with a
network error go to `localStorage["vn:goods-queue"]` and a banner offers
retry; the queue flushes on `online` and on dashboard load.

Public directory: district filter, list of cards (name, org + tier badge or
"unverified", address, hours, accepts chips, stock summary), map with
markers for centers that have coordinates (reuse `ReliefMap` pieces),
"Flag this center" (P2), "I dropped something here" (P3).

Copy rules: every new string in `en` and `ne`, in per-area files
(`src/i18n-orgs.ts`, `src/i18n-centers.ts`, `src/i18n-desk-orgs.ts`); the
public badge for pending orgs reads "Unverified organization" / "प्रमाणित
नभएको संस्था"; never show a "delivered to you" message for donations.
