# Organizations & Drop Centers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verified organizations register once, run drop centers that the public can find, and account for goods in/out on an append-only ledger that donors and moderators can read.

**Architecture:** New backend code lives in self-contained modules (`server/src/orgs/*`, `server/src/goods/taxonomy.js`) wired into the existing Lambda router by one `routeOrgs(...)` call; shared helpers from `index.js` are injected through a `deps` object so the module can be re-slotted when the backend's MVC refactor lands. Frontend adds pages under `src/pages/`, per-area i18n files, an Organizations tab in the Desk, and a stored return path so Google sign-in can start from any page.

**Tech Stack:** Node 22 Lambda (custom router, DynamoDB single table, `node:test` + `FakeDdb`), React 18 + Vite + TypeScript + Tailwind, hand-rolled router in `src/App.tsx`, `node:test` for pure frontend logic.

**Spec:** `docs/superpowers/specs/2026-09-01-drop-centers-design.md`

## Global Constraints

- Commit messages: plain conventional style (`feat(orgs): …`), **no** Co-Authored-By / Claude-Session trailers.
- No new dependencies, no new DynamoDB indexes (GSI1/GSI2 only), no `ScanCommand`, no `UpdateCommand` (rewrite items with `PutCommand`; `FakeDdb` has no Update support).
- Every new user-facing string exists in both `en` and `ne`, in a per-area i18n file (`src/i18n-orgs.ts`, `src/i18n-centers.ts`, `src/i18n-desk-orgs.ts`). Nobody edits `src/i18n.ts`.
- Never show raw API error text; use `apiErrorMessage(err, language)` from `src/api-error.ts`.
- Public responses never include `createdBy`, `createdByName`, owner/staff subs or emails.
- Server validates every field it stores (lengths, enums, numbers) exactly as the spec's validation table says.
- `pnpm typecheck` runs `tsc -b`; delete `*.tsbuildinfo` before trusting it. CI runs typecheck → `pnpm test` → `pnpm build` at the root and `pnpm test` in `server/`.
- Deploy: push to `main` deploys the frontend (Cloudflare Pages). The Lambda is updated with `bash <scratchpad>/deploy-lambda.sh` (builds `server/dist/lambda.zip`, `aws lambda update-function-code` on `verifiednepal-dev-api` in account 129264592326, region ap-south-1, via `OrganizationAccountAccessRole` from profile `out-mgmt`).
- `docs/MODERATION-GUIDELINES.md` has uncommitted owner edits — do not touch it.

## File map

**Backend (new)**
- `server/src/goods/taxonomy.js` — `GOODS_CATEGORIES` (`{id, unit}` list), `GOODS_UNITS`, `unitFor(category)`.
- `server/src/orgs/model.js` — key builders (`orgKey`, `memberKeys`, `centerKey`, `orgCenterPointer`, `goodsKey`, `inboundKey`, `donationKeys`, `inviteKey`), validators (`validateOrgBody`, `validateCenterBody`, `validateEntryBody`), shape mappers (`toPublicCenter`, `toPrivateCenter`, `toPublicEntry`, `toPrivateEntry`, `toPrivateOrg`), `centerVisibility(orgStatus, centerStatus)`, `computeStock(entries)`.
- `server/src/orgs/repo.js` — DynamoDB access only: `getOrg`, `putOrg`, `listOrgsByStatus`, `getMembership`, `putMembership`, `deleteMembership`, `listMemberships`, `listUserOrgs`, `getCenter`, `putCenter`, `listOrgCenters`, `listCentersByDistrict`, `listPublicCenters`, `putEntry`, `listEntries`, `listAllEntries`, `listDistrictEntries`, `putInbound`, `deleteInbound`, `listInbound`, `putDonation`, `getDonation`, `listCenterDonations`, `putInvite`, `listInvitesForEmail`, `deleteInvite`, `putAudit`.
- `server/src/orgs/controller.js` — one exported async function per route, signature `(event, ctx, params)` where `ctx = { deps, getDdb, env, fetchJwks }` and `deps` is the injected helper bag (below).
- `server/src/orgs/routes.js` — `export async function routeOrgs(method, path, event, ctx)`; returns a response object or `null` when the path is not ours.
- `server/test/orgs.test.js` — end-to-end through `createHandler` with `FakeDdb`.

**Backend (modified)**
- `server/src/index.js` — add `import { routeOrgs } from "./orgs/routes.js"`, build `orgDeps` once, call `routeOrgs` before the 404; extend `getTargetLabelForAudit` for `ORG|CENTER|GOODS`; extend `handleAdminStats`; extend `handleGetFlags` (P2).
- `server/test/helpers.js` — `FakeDdb` gains `DeleteCommand` support if absent.
- `server/README.md` — routes table.

**Frontend (new)**
- `src/i18n-orgs.ts`, `src/i18n-centers.ts`, `src/i18n-desk-orgs.ts`
- `src/pages/register-organization.tsx`, `src/pages/org-dashboard.tsx`, `src/pages/drop-centers.tsx`, `src/pages/drop-center-detail.tsx`, `src/pages/donation-status.tsx` (P3)
- `src/goods.ts` — frontend copy of the taxonomy with labels (en/ne) and `unitLabel`.
- `src/goods-queue.ts` (P3) — offline queue helpers (pure, tested in `src/goods-queue.test.ts`).

**Frontend (modified)**
- `src/api.ts` — types + functions for every route (the contract; written first).
- `src/types.ts`, `src/App.tsx`, `src/layout.tsx`, `src/dashboard.tsx` — routes, nav, landing CTA.
- `src/auth.tsx` — return-to path.
- `src/desk.tsx` — Organizations tab.

## Injected deps (backend contract)

```js
// server/src/index.js — built once inside createHandler
const orgDeps = {
  json, err, parseBody, getQuery, encodeCursor, decodeCursor,
  requireAuth, requireModAuth, ensureGuidelinesAck, buildAuditEntry,
  validateString, validateOptionalString, validatePhone, validateOptionalEmail,
  verifyTurnstile, generateRefCode, maskName,
};
// router, just before `return json(404, …)`:
const orgRes = await routeOrgs(method, path, event, { deps: orgDeps, getDdb, env, fetchJwks });
if (orgRes) return orgRes;
```

`requireAuth(event, {fetchJwks,getDdb,env})` resolves to `{payload, user, role, ddb, tableName}`; caller sub = `payload.sub`, display name = `user?.name || payload.name || ""`, email = `user?.email || payload.email`.

---

# Phase 1 — organizations, centers, intake/distribution, public directory, moderation

### Task P1-0: API contract + routing scaffold (done by the coordinator before the parallel tasks)

**Files:** `src/api.ts` (append), `src/goods.ts` (new), `src/types.ts`, `src/App.tsx`, `src/layout.tsx`, `src/dashboard.tsx`, stub pages.

- [ ] Append the P1 types and functions to `src/api.ts` exactly as in the "Frontend API contract" section below.
- [ ] Create `src/goods.ts` with `GOODS_CATEGORIES`, `goodsLabel(id, language)`, `unitLabel(unit, language)`.
- [ ] Add `Page` values `registerOrg | org | dropCenters | dropCenterDetail`; paths `/register-organization`, `/org`, `/drop-centers`, `/drop-centers/:id`; `pageTitle` entries; lazy imports; nav item `dropCenters` after `giveHelp`; landing hero `SquareButton` "Register organization" → `navigate("registerOrg")`.
- [ ] Stub pages export `RegisterOrganization`, `OrgDashboard`, `DropCenters`, `DropCenterDetail` components with the final prop types so `pnpm typecheck` passes; commit `feat(orgs): routes, nav and API contract for organizations and drop centers`.

### Task P1-B: backend module

**Files:** create `server/src/goods/taxonomy.js`, `server/src/orgs/{model,repo,controller,routes}.js`, `server/test/orgs.test.js`; modify `server/src/index.js` (import + deps + router line + audit label + stats), `server/test/helpers.js` (Delete support), `server/README.md`.

**Produces:** every Phase 1 route in the spec's API table, behaving exactly as specified.

- [ ] Write `server/test/orgs.test.js` first, copying `makeHandler` from `server/test/phase4.test.js`. Helpers in the test: `signedToken(sub, email, privateKey)`, `seedUser(ddb, sub, role)` (puts `USER#<sub>/PROFILE` with `role`, `email`, `name`, `guidelinesAckAt: "2026-01-01T00:00:00.000Z"`), `postJson(handler, path, body, token?)`, `getJson(handler, path, token?)`. Tests (each an `it`):
  1. `POST /orgs` without token → 401.
  2. `POST /orgs` valid → 201 `{id, status:"pending"}`; item `ORG#<id>/META` has `gsi2pk:"ORG#pending"`, `ownerSub`; memberships exist at `USER#<sub>/ORG#<id>` (role owner) and `ORG#<id>/MEMBER#<sub>`; an AUDIT item with `action:"org.create"` exists.
  3. `POST /orgs` validation: missing name → 400 `name must be at least 2 characters`; bad `orgType` → 400; `districts: []` → 400; 4th org for the same owner → 400 `too many organizations`.
  4. `GET /orgs/mine` returns the org with `role:"owner"`; a different user gets `items: []`.
  5. `POST /orgs/{id}` by owner updates `name`; by a non-member → 403; by a moderator → 403.
  6. `POST /orgs/{id}/centers` by owner → 201; center item has `gsi1pk:"CENTER#Rasuwa"`, `gsi2pk:"CENTER#public"` (org pending ⇒ public), `orgStatus:"pending"`, `unit`-free `accepts`; pointer `ORG#<id>/CENTER#<cid>` exists. Validation: `lat` without `lng` → 400; `accepts` containing `"gold"` → 400; `ward: 40` → 400.
  7. `GET /centers?district=Rasuwa` (no token) lists the center in public shape: no `createdBy`, has `org:{id,name,status:"pending"}`; `GET /centers` (no district) also lists it; `GET /centers/{id}` returns `stock: []` and `recent: []`.
  8. `POST /centers/{id}` by owner with `status:"closed"` → center `gsi2pk:"CENTER#hidden"`; `GET /centers?district=Rasuwa` no longer lists it; `GET /centers/{id}` without token → 404; with owner token → 200.
  9. `POST /centers/{id}/entries` intake `{entryType:"intake", category:"rice", qty:50}` → 201; item at `GOODS#<cid>` with `unit:"kg"`, `delta:50`, `gsi1pk:"GOODS#Rasuwa"`; distribution `{entryType:"distribution", category:"rice", qty:20}` → `delta:-20`; `GET /centers/{id}/stock` → `[{category:"rice", unit:"kg", qty:30}]`; distribution of `100` rice when only 30 on hand → 400 `insufficient stock`; `qty: 0` → 400; `category:"gold"` → 400; `entryType:"transfer_out"` → 400 in Phase 1 (`unsupported entryType`).
  10. `GET /centers/{id}/entries` without token omits `createdBy`; with owner token includes `createdByName`. `GET /goods-ledger?district=Rasuwa` returns both entries newest first in public shape.
  11. `GET /moderation/orgs` as helper → 403; as moderator lists the pending org with `centersCount:1` and `ownerEmail`.
  12. `POST /moderation/orgs/{id}` `{action:"verify"}` without `tier`/`note` → 400; `{action:"verify", tier:"self_declared", note:"Called the contact number, spoke to the chair"}` → `{status:"verified"}`; org item has `tier`, `verifiedBy`, `verificationNote`, `gsi2pk:"ORG#verified"`; every center of the org now has `orgStatus:"verified"`, `orgTier:"self_declared"`; AUDIT `action:"verify"`, `targetType:"ORG"`.
  13. `{action:"suspend", reason:"Duplicate of another org"}` → centers become `gsi2pk:"CENTER#hidden"`; `{action:"reinstate"}` → public again; `{action:"reject", reason:"…"}` on a pending org → `status:"rejected"`, centers hidden; `{action:"verify"}` on a rejected org → 400 `only pending organizations can be verified`.
  14. `GET /admin/stats` as admin includes `orgsPending`, `orgsVerified`, `centersPublic`.
- [ ] Run `cd server && pnpm test` — expect the new file to fail (routes 404).
- [ ] Implement `taxonomy.js`, `model.js`, `repo.js`, `controller.js`, `routes.js`; wire `index.js`. Stock check on distribution: compute from all entries (`listAllEntries` paginates the `GOODS#<centerId>` partition). Audit actions: `org.create`, `org.update`, `center.create`, `center.update`, `entry.create`, and moderation `verify|reject|suspend|reinstate`.
- [ ] `cd server && pnpm test` → all green (existing 106 + new). `pnpm build` in `server/`.
- [ ] Update `server/README.md` routes list (cross-check each line against the handler's actual return).
- [ ] Commit `feat(orgs): organizations, drop centers and goods ledger backend`.

### Task P1-FA: org registration, dashboard, sign-in return path

**Files:** create `src/pages/register-organization.tsx`, `src/pages/org-dashboard.tsx`, `src/i18n-orgs.ts`; modify `src/auth.tsx` only.

**Consumes:** `src/api.ts` functions `createOrg, listMyOrgs, getOrg, updateOrg, createCenter, listOrgCenters, updateCenter, getCenter, getCenterStock, listCenterEntries, createEntry`; `src/goods.ts`; `useAuth` from `src/auth.tsx`; `districtNames`/`districtLabels` from `src/geo.ts`; UI primitives from `src/ui.tsx` and `src/components/ui/*`.

- [ ] `src/auth.tsx`: in `signIn`, before `window.location.assign`, `sessionStorage.setItem("vn:return_to", window.location.pathname + window.location.search)` unless the path is `/desk`. In the code-exchange effect, after `setAccessToken(tokens.access_token)`, read `vn:return_to`; if it is a string starting with `/` and not starting with `//` and not `/desk`, `sessionStorage.removeItem` it and `window.location.replace(returnTo)`. (Full navigation is acceptable — tokens are already in sessionStorage.)
- [ ] `RegisterOrganization({language, navigate})`: if `!auth.idToken` → card with "Sign in with Google to register an organization" + `SquareButton onClick={auth.signIn}` (same pattern as `src/pages/give-help.tsx:335-353`). Form fields per spec (name, orgType select, registrationNumber, contactName, contactPhone, contactEmail, districts multi-checkbox from `districtNames`, description, website). Client validation mirrors server rules; errors keyed per field, first invalid focused; draft in `localStorage["vn:org-draft"]` like `get-help.tsx`. On success → `navigate("org")`. Below the form a short "What happens next" box: provisional status explained, verification tiers listed.
- [ ] `OrgDashboard({language, navigate})`: requires sign-in (same card). Loads `listMyOrgs`; none → empty state with a button to `registerOrg`. Org header: name, status `StatusMark` (`pending` → "Unverified — visible publicly as unverified", `verified` → tier label, `suspended`/`rejected` → reason). Edit-org dialog (owner). Centers list from `listOrgCenters`; "Add center" dialog (fields per spec; `accepts` as checkboxes from `GOODS_CATEGORIES`; lat/lng optional numeric inputs); each center row → panel with: status select (open/paused/closed, owner only), stock table (`getCenterStock`), "Log entry" form (entryType intake/distribution radio, category select showing unit, qty number input step 0.01, note), recent entries list (`listCenterEntries`, newest first, corrected entries `line-through`). Every request error → `apiErrorMessage`.
- [ ] `pnpm typecheck` clean for your files; commit `feat(orgs): organization registration and dashboard`.

### Task P1-FB: public directory, center detail, landing/desk integration

**Files:** create `src/pages/drop-centers.tsx`, `src/pages/drop-center-detail.tsx`, `src/i18n-centers.ts`, `src/i18n-desk-orgs.ts`; modify `src/desk.tsx` only.

**Consumes:** `listCenters, getCenter, getCenterEntries` (public), `getModerationOrgs, moderateOrg`; `GOODS_CATEGORIES`/labels from `src/goods.ts`; `ReliefMap` markers pattern from `src/relief-map.tsx` (lazy-load leaflet like `src/dashboard.tsx:16`).

- [ ] `DropCenters({language, navigate})`: district `<select>` (all + `districtNames`), list of cards: name, org name + badge (`verified` → tier label; `pending` → "Unverified organization"), address, hours, accepts chips, "View" → `navigate("dropCenterDetail", id)`. Map section (lazy) with a marker per center that has `lat/lng`; toggling follows the show/hide button pattern of `ReliefMap`. Empty state per district.
- [ ] `DropCenterDetail({language, navigate, id})`: header with org badge, contact, hours, accepts, stock table, activity list (public entries; `intake` = "Received", `distribution` = "Distributed", transfers/corrections rendered too for later phases), explanatory note: "Figures are logged by the organization's staff. Stock = received − distributed − sent out."
- [ ] `src/desk.tsx`: add tab `"orgs"` labelled "Organizations · N" (N = pending count) visible to moderators and admins. Panel: sub-filter (pending | verified | suspended | rejected → `getModerationOrgs(token, status)`), cards showing all org fields, owner email, `centersCount`, vouches (if any). Actions: pending → **Verify** dialog (tier `<select>` known/vouched/self_declared + note textarea, required ≥ 5 chars) and **Reject** dialog (reason ≥ 5 chars); verified → **Suspend** dialog (reason); suspended → **Reinstate** button. Reload after each action. Strings in `src/i18n-desk-orgs.ts` (`deskOrgStrings`).
- [ ] `pnpm typecheck` clean; commit `feat(centers): public drop-center directory, detail page and organization moderation tab`.

### Task P1-V: integration, deploy, verify (coordinator)

- [ ] Remove `*.tsbuildinfo`; `pnpm typecheck && pnpm test && pnpm build`; `cd server && pnpm test && pnpm build`.
- [ ] Deploy Lambda (`deploy-lambda.sh`), then smoke against `https://api.dev.verifiednepal.com`: `GET /centers` → 200 `{items:[]}`; `POST /orgs` without token → 401.
- [ ] Headless-Chrome screenshots of `/register-organization`, `/drop-centers`, `/org` (signed-out), landing hero, at 390px and 1280px.
- [ ] Merge to `main` (fast-forward), push; confirm `deploy-dev` workflow succeeds.

---

# Phase 2 — transfers, corrections, tiers/vouching, suspension, public flags

### Task P2-B: backend

**Files:** `server/src/orgs/{model,repo,controller,routes}.js`, `server/test/orgs-p2.test.js`, `server/src/index.js` (`handleGetFlags` gains center flags), `server/README.md`.

- [ ] Tests first (`orgs-p2.test.js`, reuse the P1 helpers by copying them):
  1. `transfer_out` to `destinationType:"center"` with a public destination → 201 `{id, transferId}`; source entry `delta:-qty`, `transferStatus:"in_transit"`; destination has `CENTER#<dest>/INBOUND#<transferId>`; source stock decreased; destination stock unchanged. Destination = self → 400; hidden destination → 400; `external` without `destinationLabel` → 400; insufficient stock → 400.
  2. `GET /centers/{dest}/inbound` as destination member lists it; as source member → 403.
  3. `POST /transfers/{transferId}/receive` `{qtyReceived: 45}` by destination member → 201; destination has `transfer_in` `qty:45, delta:45`; source `transfer_out` now `transferStatus:"received", qtyReceived:45, discrepancy:5`; INBOUND deleted; second receive → 400 `already received`. Receive by source member (not a destination member) → 403.
  4. `external` transfer → `transferStatus:"sent"`, no INBOUND.
  5. `correction` of an intake entry → 201; new entry `delta:-original.delta`, `correctsEntryId`; original rewritten with `correctedByEntryId`; stock reflects it; correcting again → 400 `already corrected`; correcting a `transfer_out` that has been received → 400; missing note → 400.
  6. `POST /centers/{id}/flag` (Turnstile secret unset in tests ⇒ no-op) with `reason:"closed"` → `{ok:true}`; center `flagCount:1`; `GET /moderation/flags` as moderator includes `centers:[{centerId, name, district, flagCount, reasons:[…]}]`. Invalid reason → 400.
  7. Vouch: owner of a verified org `POST /orgs/{pendingId}/vouch` → `{ok:true}` and `vouches` has one entry; second vouch by the same org → 400; owner of a pending org → 403; target verified → 400. Moderator `verify` with `tier:"vouched"` on an org with no vouches → 400 `no vouches recorded`.
- [ ] Implement; `pnpm test` green; README; commit `feat(orgs): transfers, corrections, vouching and center flags`.

### Task P2-F: frontend

**Files:** `src/pages/org-dashboard.tsx`, `src/pages/drop-center-detail.tsx`, `src/i18n-orgs.ts`, `src/i18n-centers.ts`, `src/desk.tsx` (flags tab: center flags list), `src/api.ts` (P2 functions — coordinator appends first).

- [ ] Dashboard center panel: "Send to another center" dialog (destination: radio between "a center on VerifiedNepal" → searchable select fed by `listCenters()` excluding self, and "somewhere else" → label input; category; qty; note). "Inbound transfers" list with **Confirm received** dialog (qty received prefilled with declared qty; shows discrepancy preview). Entry rows: **Correct** button (note required) except on already-corrected or received transfers; corrected rows struck through with "corrected" tag; transfers show destination/source and status; discrepancy shown in red.
- [ ] Org header: for verified orgs, "Vouch for an organization" input (org id or from a list of pending orgs via `listPendingOrgsPublic`? — no such public route; instead the pending org's dashboard shows its own id and a "share this id with an organization that can vouch for you" line; vouching org enters that id).
- [ ] Public detail: "Report a problem with this center" (Turnstile) with reasons not_real / closed / misuse / other + details. Activity rows for transfers show direction and destination/source name; corrections show "correction of …".
- [ ] Desk flags tab: section "Centers" listing flagged centers with reasons and a link to the public page.
- [ ] Commit `feat(centers): transfers, corrections, flags and vouching UI`.

### Task P2-V: integration/deploy/verify (as P1-V).

---

# Phase 3 — staff, donor codes, offline queue

### Task P3-B: backend

**Files:** `server/src/orgs/*`, `server/test/orgs-p3.test.js`, `server/README.md`.

- [ ] Tests first:
  1. Owner `POST /orgs/{id}/members` `{email:"vol@example.com"}` when no `EMAIL#vol@example.com` pointer exists → 201 `{status:"invited"}`; `GET /orgs/{id}/members` lists `{email, role:"staff", status:"invited"}`. When the email pointer exists (seed `EMAIL#…/META {sub}` and the USER) → 201 `{status:"member"}` and both membership items exist. Staff calling `POST /orgs/{id}/members` → 403. Owner removing themselves as last owner → 400.
  2. `GET /orgs/mine` by a user whose email has an invite → membership materialized, invite deleted, org listed with `role:"staff"`.
  3. Staff can `POST /centers/{id}/entries`; staff `POST /orgs/{id}` → 403; staff `POST /orgs/{id}/centers` → 403.
  4. `DELETE /orgs/{id}/members/{sub}` by owner → `{ok:true}`; the removed user's `POST /centers/{id}/entries` → 403 afterwards.
  5. `POST /centers/{id}/donations` (public) `{category:"rice", qty:10}` → 201 `{ref}` (12 chars); `GET /donations/{ref}` → `status:"declared"`, center summary, no staff data; hidden center → 404.
  6. Member `GET /centers/{id}/donations` lists it; `POST /donations/{ref}/confirm` `{}` → `{entryId}`; an intake entry exists with `donationRef`; donation `status:"received"`; `GET /donations/{ref}` now has `receivedAt` and `sinceReceived:{distributed:0, transferred:0}`; after a distribution of 4 rice, `sinceReceived.distributed === 4`; confirm again → 400. `{action:"not_received"}` on a declared donation → `status:"not_received"`.
- [ ] Implement; tests green; README; commit `feat(orgs): staff invites and donor drop codes`.

### Task P3-F: frontend

**Files:** `src/goods-queue.ts` + `src/goods-queue.test.ts` (new), `src/pages/donation-status.tsx` (new, route `/donation/:ref`, Page `donationStatus`), `src/pages/org-dashboard.tsx`, `src/pages/drop-center-detail.tsx`, `src/i18n-orgs.ts`, `src/i18n-centers.ts`, `src/App.tsx`/`src/types.ts` (route), `src/api.ts` (P3 functions — coordinator appends first).

- [ ] `src/goods-queue.ts`: pure functions over an array of `{id, centerId, body, queuedAt}` — `enqueue(list, centerId, body)`, `dequeue(list, id)`, `load()`/`save(list)` around `localStorage["vn:goods-queue"]` (try/catch), and `flush(list, send)` that calls `send(item)` sequentially and returns the remaining list (keeps items whose send throws with `status === 0`; drops items that succeed or fail with 4xx). Tests in `src/goods-queue.test.ts` (node:test): enqueue/dequeue, flush keeps network failures and drops 4xx.
- [ ] Dashboard: wrap `createEntry` so a network failure (`ApiError.status === 0` or `TypeError`) enqueues and shows a banner "N entries waiting to sync — Retry"; flush on mount and on `window` `online`. Staff section (owner): invite by email, list with status, remove. Donor drops section per center: declared drops with **Confirm** (qty editable) / **Not received**.
- [ ] Public detail: "I dropped something here" → dialog (category, qty, note, Turnstile) → shows the ref code (copyable) + link `/donation/<ref>`; also a QR code (dependency `qrcode` already installed) that encodes the `/drop-centers/<id>?drop=1` URL, for the org to print (shown in the dashboard center panel, not on the public page). Public page opens the dialog automatically when `?drop=1`.
- [ ] `DonationStatus({language, ref})`: shows declared/received/not_received, center, category/qty, receivedAt, and — only when received — "Since your drop was logged, this center has distributed X and sent on Y of <category>". Never says "delivered to a beneficiary".
- [ ] Commit `feat(centers): donor drop codes, staff management and offline entry queue`.

### Task P3-V: integration/deploy/verify (as P1-V), then update `docs/superpowers/specs/…` status line and the infra repo `HANDOFF.md`.

---

## Frontend API contract (`src/api.ts` additions)

```ts
export type OrgType = "ngo" | "community" | "company" | "religious" | "government" | "other";
export const ORG_TYPES: OrgType[] = ["ngo", "community", "company", "religious", "government", "other"];
export type OrgStatus = "pending" | "verified" | "rejected" | "suspended";
export type OrgTier = "known" | "vouched" | "self_declared";
export type OrgRole = "owner" | "staff";
export type CenterStatus = "open" | "paused" | "closed";
export type GoodsUnit = "kg" | "litre" | "piece" | "packet" | "kit" | "set";
export type EntryType = "intake" | "distribution" | "transfer_out" | "transfer_in" | "correction";

export interface OrgPrivate {
  id: string; name: string; orgType: OrgType; registrationNumber?: string;
  contactName: string; contactPhone: string; contactEmail?: string;
  districts: string[]; description: string; website?: string;
  status: OrgStatus; tier?: OrgTier; ownerEmail?: string;
  createdAt: string; updatedAt: string; verifiedAt?: string; verificationNote?: string;
  rejectionReason?: string; suspensionReason?: string;
  vouches?: Array<{ orgId: string; orgName: string; at: string }>;
}
export interface MyOrg extends OrgPrivate { role: OrgRole }
export interface CreateOrgBody {
  name: string; orgType: OrgType; registrationNumber?: string; contactName: string; contactPhone: string;
  contactEmail?: string; districts: string[]; description: string; website?: string;
}
export interface CenterOrgRef { id: string; name: string; status: OrgStatus; tier?: OrgTier }
export interface CenterPublic {
  id: string; name: string; district: string; ward?: number; address: string; lat?: number; lng?: number;
  hours?: string; contactPhone: string; accepts: string[]; status: CenterStatus; org: CenterOrgRef;
  createdAt: string; updatedAt: string; flagCount?: number;
}
export interface CenterPrivate extends CenterPublic { orgId: string; notes?: string }
export interface CreateCenterBody {
  name: string; district: string; ward?: number; address: string; lat?: number; lng?: number;
  hours?: string; contactPhone: string; accepts: string[]; notes?: string;
}
export interface StockItem { category: string; unit: GoodsUnit; qty: number }
export interface GoodsEntry {
  id: string; centerId: string; district: string; entryType: EntryType; category: string; unit: GoodsUnit;
  qty: number; delta: number; note?: string; createdAt: string; createdByName?: string;
  transferId?: string; transferStatus?: "in_transit" | "received" | "sent";
  destinationType?: "center" | "external"; destinationCenterId?: string; destinationLabel?: string;
  sourceCenterId?: string; sourceLabel?: string; qtyReceived?: number; discrepancy?: number;
  correctsEntryId?: string; correctedByEntryId?: string; donationRef?: string;
}
export interface CreateEntryBody {
  entryType: "intake" | "distribution" | "transfer_out" | "correction"; category?: string; qty?: number; note?: string;
  destinationType?: "center" | "external"; destinationCenterId?: string; destinationLabel?: string; correctsEntryId?: string;
}
export interface CenterDetailResponse extends CenterPublic { stock: StockItem[]; recent: GoodsEntry[] }
export interface ModerationOrgItem extends OrgPrivate { centersCount: number; ownerSub?: string }

export function createOrg(token: string, body: CreateOrgBody): Promise<{ id: string; status: OrgStatus }>
export function listMyOrgs(token: string): Promise<{ items: MyOrg[] }>
export function getOrg(token: string, id: string): Promise<OrgPrivate>
export function updateOrg(token: string, id: string, body: Partial<CreateOrgBody>): Promise<{ ok: boolean }>
export function createCenter(token: string, orgId: string, body: CreateCenterBody): Promise<{ id: string }>
export function listOrgCenters(token: string, orgId: string): Promise<{ items: CenterPrivate[] }>
export function updateCenter(token: string, id: string, body: Partial<CreateCenterBody> & { status?: CenterStatus }): Promise<{ ok: boolean }>
export function listCenters(params?: { district?: string; cursor?: string }): Promise<{ items: CenterPublic[]; cursor?: string }>
export function getCenter(id: string, token?: string): Promise<CenterDetailResponse>
export function getCenterStock(id: string): Promise<{ items: StockItem[] }>
export function listCenterEntries(id: string, params?: { cursor?: string }, token?: string): Promise<{ items: GoodsEntry[]; cursor?: string }>
export function createEntry(token: string, centerId: string, body: CreateEntryBody): Promise<{ id: string; transferId?: string }>
export function getGoodsLedger(params: { district: string; cursor?: string }): Promise<{ items: GoodsEntry[]; cursor?: string }>
export function getModerationOrgs(token: string, status?: OrgStatus): Promise<{ items: ModerationOrgItem[] }>
export function moderateOrg(token: string, id: string, body: { action: "verify"; tier: OrgTier; note: string } | { action: "reject" | "suspend"; reason: string } | { action: "reinstate" }): Promise<{ status: OrgStatus }>
// Phase 2
export function listInbound(token: string, centerId: string): Promise<{ items: InboundTransfer[] }>
export function receiveTransfer(token: string, transferId: string, body: { qtyReceived: number; note?: string }): Promise<{ id: string }>
export function flagCenter(id: string, body: { reason: "not_real" | "closed" | "misuse" | "other"; details?: string; turnstileToken?: string }): Promise<{ ok: boolean }>
export function vouchOrg(token: string, voucherOrgId: string, targetOrgId: string): Promise<{ ok: boolean }>   // POST /orgs/{targetOrgId}/vouch  body {voucherOrgId}
// Phase 3
export function listOrgMembers(token: string, orgId: string): Promise<{ items: OrgMember[] }>
export function inviteOrgMember(token: string, orgId: string, body: { email: string }): Promise<{ status: "invited" | "member" }>
export function removeOrgMember(token: string, orgId: string, subOrEmail: string): Promise<{ ok: boolean }>
export function declareDonation(centerId: string, body: { category: string; qty: number; note?: string; turnstileToken?: string }): Promise<{ ref: string }>
export function getDonation(ref: string): Promise<DonationStatus>
export function listCenterDonations(token: string, centerId: string, status?: "declared" | "received" | "not_received"): Promise<{ items: DonationStatus[] }>
export function confirmDonation(token: string, ref: string, body: { qty?: number } | { action: "not_received" }): Promise<{ entryId?: string; ok?: boolean }>
```

Note on vouching: the spec's `POST /orgs/{id}/vouch` needs to know *which* verified org is vouching, since a user may own several — the body carries `{voucherOrgId}` and the server checks the caller owns it and it is `verified`.
