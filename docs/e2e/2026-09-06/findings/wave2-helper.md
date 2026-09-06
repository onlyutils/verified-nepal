# Wave 2 — helper, organization and public-with-codes flows (dev, 2026-09-06/07 night)

All 8 flows exercised through the real UI and confirmed against the API. Screenshots 01–66 in this folder (numbered files with other suffixes belong to an earlier aborted run).

## Results (condensed)
PASS: give-help board filters + incident switcher · helper group form/add items/join/claim/mark done (both /me reflect it) · project update via update code held pending · org take need → private contact → deliver → /ledger under org name; take another → hand back · center stock intake → transfer → receive (public stock + /goods-ledger reflect) · team invite → accept / decline · public drop-centers list/detail · donation status (received + declared) · poster save with photo → edit → mark Found → public board · get-help status for pending/published/fulfilled + renew · article like · home stories strip · /me for the heaviest helper (8 populated sections, clean).
BLOCKED-by-Turnstile (server rejects anon writes correctly): center flag, center donate.
FAIL: give-help board reload shows stale state after group actions (VN-45) · center edit blocked by "+" phone validation (VN-46).

## Bugs
- VN-45 P1 — Stale client-side cache on /give-help: after forming a group / adding items / joining / claiming / marking done, reloading the board can show the pre-action state (items or the whole group gone) until the browser cache is cleared; reproduced 3× across two profiles (06-givehelp-reload-check.png). Likely the GET /needs response being cached (HTTP cache headers and/or the service worker runtime cache) and not invalidated after mutations.
- VN-46 P2 — Center edit fails whenever the stored phone has a leading "+": validPhone() in src/org/use-org.ts:88 strips spaces/hyphens but not "+", so any edit (even hours only) errors "Contact phone must be 7–15 digits" (21–23-center-edit-*.png).
- VN-37 (dup) P2 — "Sent to Sent to {destination}" on every transfer-out entry of public center pages (42-dropcenter-detail.png).
- VN-47 P2 — /org#needs deep-link/reload falls back to Overview: sectionFromHash() allow-list in src/org/org-dashboard.tsx:26 omits "needs".
- nit — POST /needs/:refCode/renew succeeds for fulfilled needs (server) and the UI offers Renew on fulfilled (VN-39).
- nit — Article share count updates only after reload (like is optimistic).

## UX
- Anonymous visitors see live "I'll do this"/"Join"/"Add" buttons on grouped needs; clicking silently no-ops (no sign-in prompt).
- "Form a group" and the org "{org} will handle this" button both appear on a need the same org already took — no mutual exclusivity.
- Declining a team invite removes the row entirely (owner can't see who declined).
- Login for an org-owner test account landed on /org rather than the page the user came from (check the return_to fix on dev-login for org owners).
- Nepali text wraps cleanly on cards and center pages; org nav label is "Drop centers".

## Data changed
Need fe06eb17 (ref SW7F3MEOMPFE): group of 2, 2 items, 1 done · need 07eefca3 fulfilled by org Sindhu Youth Relief Network (ledger row, Nuwakot) · need b73c8bf5 taken then handed back · center d2d6c137: hours/phone edited, Lentils +30 intake, −20 → Kavrepalanchok (received: 226→246), −20 → Lalitpur (mis-click; unconfirmed inbound at center fb594683, harmless) · org 74c53b1e team: helper-10 member, helper-11 declined · project d4f22d9c: 1 pending update · poster 1d796c46 created as "Test Missing Person" (owner helper-01) — needs a realistic rename · article a1568141 likes 2→3, shares 2→3 · needs JVSE5WLSJ76W and HQAC2KPZGS7K renewed.
