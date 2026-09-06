# Helper-role e2e findings (dev.verifiednepal.com, 2026-09-06)

Result: 19 PASS, 1 FAIL, 3 BLOCKED. Screenshots: 44 PNGs in this folder (numbered 01–44).

## 1. Flows tested

| # | Step | URL | Action | Expected | Actual | Result | Shot |
|---|---|---|---|---|---|---|---|
| 1 | Signed-out give-help | /give-help | Load | Board + sign-in prompt | Empty board, inline "Continue with Google" card, header "Sign in" | PASS | 01 |
| 2 | Header Sign in | /desk/login | Click | Login page | Google + "OR" + test form "(dev only)" | PASS | 02 |
| 3 | Test sign-in | /desk/login | Submit creds | Back to /give-help | Landed on /org, `vn:return_to` null | FAIL (B1) | 03, 04 |
| 4 | /me empty | /me | Load | Empty CTAs | Correct, desktop+mobile | PASS | 05, 06 |
| 5 | /give-help signed in | /give-help | Load | "Register an offer" | OK | PASS | 07, 08 |
| 6 | Offer dialog | /give-help | Open | Form | Opens; stale "Sign in with Google" copy | PASS (B5) | 09 |
| 7 | Submit offer | /give-help | Goods, Kathmandu | Pending + reference | Ref d821d6e3… shown | PASS | 10, 11 |
| 8 | Offer hidden | API | GET /offers?incidentId=test | absent | items: []; /me/dashboard pending | PASS | — |
| 9 | Offers tab | /give-help | Click | list | Renders, empty | PASS | 12 |
| 10 | My articles | /me/articles | Load | list | OK | PASS | 13 |
| 11 | Register org | /register-organization | Fill + submit | Pending org | Dashboard 64d3b48a…, "Unverified — publicly visible as unverified" | PASS | 15–18 |
| 12 | Org Needs tab | /org#needs | Click | gated | "Only verified organizations can take requests" | PASS (take/deliver BLOCKED) | 40 |
| 13 | Project register | /projects/register | Fill all, submit | Pending project | Turnstile never solves; "Something went wrong on our side"; API 400 turnstile token required | BLOCKED + B2 | 14, 19, 20, 23 |
| 14 | New article | /me/articles/:id/edit | Click New | Draft editor | Draft autosaved | PASS | 25 |
| 15 | Paragraph/tag/name | editor | + → Paragraph, tag | saved | OK | PASS | 26, 27 |
| 16 | Submit w/o cover | editor | Submit | validation | "Still needed: a cover image" | PASS | 28 |
| 17 | Cover upload | editor | 105 KB PNG | CDN preview | cdn.dev.verifiednepal.com/media/…/cover.png renders; then "cover source" required | PASS | 29, 30 |
| 18 | Submit for review | editor | fill source, submit | pending, read-only | "under review… Editing is unavailable"; list Pending | PASS | 31, 32 |
| 19 | Article hidden | API | /dispatches | absent | 0 matches | PASS | — |
| 20 | Story | API/UI | POST /me/stories | ineligible | 403 story_not_eligible; /me explains | PASS (by design) | 33 |
| 21 | Helper group split/claim | /give-help | needs a published need | — | 0 published needs in any incident at test time | BLOCKED | — |
| 22 | /me populated | /me | Load | items with status | Pending/Published/Rejected badges, incidents, org shortcut | PASS | 33, 34 |
| 23 | Expired token silent refresh | /me | set exp past, reload | transparent | Signed in, new exp, refresh rotated | PASS | 36 |
| 24 | API refresh | API | POST /auth/refresh | new pair | 200 | PASS | — |
| 25 | Garbage bearer | API | bad JWT | 401 | 401 unknown kid | PASS | — |
| 26 | Sign out | avatar menu | click | tokens cleared | ou_tokens gone, signed-out header | PASS | 41, 42 |
| 27 | /me signed out | /me | Load | prompt | "Sign in to see your things" (Google only) | PASS | 43 |

## 2. Bugs

- B1 P1 — Test-account sign-in ignores `vn:return_to`: /give-help → header Sign in → test form lands on /org "No organization yet". `signInWithPassword` never reads `vn:return_to`; DeskLogin then `navigate("desk")` and /desk bounces helpers to /org. The header → /desk/login route also drops `return_to` for Google (`signIn()` clears it when pathname starts with /desk). Shots 03, 04.
- B2 P2 — /projects/register with Turnstile unsolved shows generic "Something went wrong on our side" (API says 400 turnstile token required); submit is enabled before the challenge completes. Shots 20, 23.
- B3 P2 — Pending article still shows "Edit", which opens a read-only page. Shot 32.
- B4 UX-nit — /me "Your story" block is a dead end for new helpers (no path to eligibility). Shot 33.
- B5 UX-nit — Offer dialog header says "Sign in with Google to register help…" while already signed in. Shot 09.

## 3. UX observations

- 77-district checkbox walls in the offer and org forms (≈3 screens of scrolling on mobile).
- Article title input has no visible field border.
- Cover image + cover source only flagged as required on submit (not upfront).
- Offer success card sits below the fold with no toast; org success/validation messages likewise.
- "Unverified — publicly visible as unverified" contradicts the "nothing public until approved" model.
- Avatar menu has only "Sign out"; signed-out /me offers Google only.
- Red emergency bar takes ~25% of the first mobile viewport on every page.
- Mobile /me layout is clean and readable.

## 4. Test data (E2E-0906-helper)

offer d821d6e3-9b35-4e43-b11d-87af16fac851 (pending); org 64d3b48a-1b45-4371-9cc6-812724e42612 (unverified); article 10be1d0b-b354-4b46-acf0-d446a858cde8 (pending), cover ou_file_34K2jjBvGvWEScR58UFTe. Other forks also used this account (a published + a rejected offer, a mod article, two incidents).

## 5. Environment limitations

Cloudflare Turnstile checkbox never yields a token in headless Chrome (real CDP clicks tried) → project creation and all anonymous writes untestable by browser automation; API enforcement verified. No published need existed in any incident at test time → helper-group split/claim untested. Org stayed unverified → take/deliver untested. Suggestion: a Turnstile test sitekey (always-pass) on dev if agent E2E must cover anonymous forms.
