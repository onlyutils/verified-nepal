# Anonymous/public e2e findings (dev.verifiednepal.com, 2026-09-06)

61 screenshots in this folder (sweep-en-*/sweep-ne-* = 17 routes desktop; *-m-* = 390×844).

## 1. Flows tested

| # | URL | Action | Expected | Actual | Result | Shot |
|---|---|---|---|---|---|---|
| 1 | 17 public routes (/, /search, /missing, /poster, /get-help, /give-help, /projects, /articles, /incidents, /audit, /ledger, /climate, /drop-centers, /report-incident, /info, /me, /desk) | Load signed-out, desktop | 200, h1, no JS errors | All render; 0 console errors on every page; /desk → /desk/login | PASS | sweep-en-*.png |
| 2 | same 17 | Toggle नेपाली, then back | Full translation, persists | All h1/body switch; persists via storage | PASS | sweep-ne-*.png |
| 3 | /get-help | Submit empty form | Inline validation | "7 fields need attention" + per-field messages, focus/aria wired | PASS | gethelp-d-02-validation.png |
| 4 | /get-help | "Someone else" → registrant + consent fields | Conditional fields | Appear; beneficiary phone becomes optional | PASS | gethelp-m-03-filled.png |
| 5 | /get-help | Fill valid need, submit | Turnstile → refCode | Widget renders as unchecked checkbox; headless never gets a token. Desktop: request fired anyway → "Something went wrong on our side"; mobile: "1 field needs attention" | BLOCKED (B2) | gethelp-d-04-after-submit.png, gethelp-m-04-after-submit.png |
| 6 | /get-help mobile | Layout | Usable | Clean single column, full-width buttons | PASS | gethelp-m-01-empty.png |
| 7 | /get-help Check status | Bogus code | Not found | API /status/ZZZZ… → 404 | PASS (API) | — |
| 8 | /give-help signed out | Board + offer CTA | Board readable, offer gated | Board loads (/needs?incidentId=general 200); "Register an offer" gated behind Google | PASS | sweep-en-give-help.png, givehelp-d-02-incident-test.png |
| 9 | /poster board | List, filters, search | Public board | 1 poster (junk "kjkj skdjks", phone visible), Missing/Found/Safe filters, search | PASS | poster-d-01-board.png, poster-m-01-board.png |
| 10 | /poster/new | Anonymous builder | Works without account | Client-side only ("Nothing is uploaded"), live 1080×1080 preview, Download | PASS | poster-d-02-create-clicked.png |
| 11 | /search | "Ram" / "राम" / "zzzzqqq" / "R" | Results, Devanagari, empty, min-length | 29 / 50 / "No records match" / "Use at least two characters" | PASS | search-d-01..03.png |
| 12 | /report-incident signed out | Gate | Sign-in required | Clear sign-in card; API 401 | PASS | sweep-en-report-incident.png |
| 13 | /me signed out | Gate | Sign-in card | Card + "Not now" / "Go to home page" | PASS | sweep-en-me.png |
| 14 | /audit, /ledger | Read-only | Masked entries | Audit lists actions (month picker, Print); Ledger requires district, CSV/Print | PASS (see UX) | sweep-en-audit.png, sweep-en-ledger.png, audit-m-01.png, ledger-m-01.png |
| 15 | /incidents, /climate, /drop-centers, /articles | Read-only | Renders | All render; drop-centers empty state; climate charts + message wall | PASS | sweep-en-*.png, *-m-01.png |
| 16 | Home mobile | Hamburger | Drawer | Full drawer incl. guides | PASS | home-m-02-menu.png |
| 17 | API POST /needs no/bogus token | 400 | 400 turnstile token required / verification failed | PASS | — |
| 18 | API POST /projects no token | 400 | 400 turnstile token required | PASS | — |
| 19 | API POST /offers, /me/stories, /incidents/request anon | 401 | 401 | PASS | — |
| 20 | API GET public list endpoints | 200 | 200; none of the blocked submissions exist anywhere | PASS | — |
| 21 | USP: unapproved content invisible | — | Could not create an anonymous need (Turnstile); verified indirectly: /needs lists only published; audit shows publish actions gate STORY/DISPATCH | PARTIAL (positive path covered by moderator/helper runs) | — |

## 2. Bugs

- B1 P2 — /projects empty state claims you are offline while online: src/pages/projects.tsx:169 passes description={t.offline} unconditionally, so an empty list (API 200, items: []) shows "You appear to be offline…". sweep-en-projects.png.
- B2 P1 (UX) — Get-help submits without a Turnstile token and blames the server: unsolved widget + Submit → POST fires → 400 turnstile token required → "Something went wrong on our side… email…". Mobile run instead blocked client-side ("1 field needs attention"). Inconsistent, and the 400 is mapped to an "our side" message. gethelp-d-04-after-submit.png.
- B3 P2 — "Draft restored from 9/6/2026, 3:18:03 PM" banner appears on the same visit right after a failed submit (timestamp = now) and on first load of an empty form. Only show when restoring a prior session's draft with content.
- B4 P2 — Audit actor name duplicated and unmasked: rows show "Only Utils Only Utils" while the page copy says names are masked. sweep-en-audit.png.
- B5 P2 — Public GET endpoints 400 without filters: /needs, /projects (incidentId), /audit (month), /ledger, /goods-ledger (district). UI always passes them; direct/shared API consumers get 400 instead of a default.
- UX-nit — Dev data noise: incident selector on /get-help and /incidents cards show "Test / Test / Description / Descriptions" plus other forks' E2E-0906-admin incidents (published, so not a leak).

## 3. UX observations

- Home is very long (≈4,700px) and front-loads the OPMCM/NDRRMA dashboard; Get help / Give help CTAs are strong on desktop, but "Current situation" stats are 2026-flood-specific while the H1 says "for Nepal". Consider a district/incident switcher near the stats.
- Get-help form is well structured (three cards, clear "Who is this for?"). "Verification required" label with a bare Cloudflare checkbox reads as a form field; duplicated helper sentence under "Describe what is needed"; submit error appears above the button, far from the widget that caused it.
- Give-help signed out: "Not tied to a specific event" silently maps to incidentId=general; first-time visitor sees an empty board with an offline-hint sentence that adds noise.
- Poster board: phone numbers rendered in full on public cards (by design — reviewer should confirm against the privacy principle). "Open"/"Share" secondary buttons visually equal to the phone chip.
- Search: substring matching ("Ram" → Pramila, Ramasamy) inflates counts; consider word-start matching or ranking.
- Ledger has a Turnstile widget inline with the filters on a read-only page (guards CSV download) — looks like a broken control until it resolves. Audit month picker English-only in NE mode; incident kinds/dates on /incidents and country names on /climate, /info also English in NE.
- i18n: the "Skip to main content" link is the only UI string untranslated in NE. Otherwise NE parity complete on all 17 routes.
- Mobile: drawer nav is clean; red emergency bar stacks to 3 rows on 390px (≈150px) before content.
- Empty states consistent (icon + sentence) but several carry offline copy regardless of state.

## 4. Test data created
None persisted — every anonymous submission was blocked by Turnstile; /poster/new is client-side only.

## 5. Environment limitations
- Headless Chrome never receives a Turnstile token (managed widget renders a checkbox challenge); anonymous write paths verified via API 400s only.
- Page.captureScreenshot with captureBeyondViewport hangs on pages embedding the Turnstile iframe; worked around with tall viewports.
- Bash tool returns exit 144 on any command that includes pkill, even when the kill succeeds.
