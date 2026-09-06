# UX / accessibility / responsive audit (dev.verifiednepal.com, 2026-09-06)

108 page-captures: 27 pages × EN/NE × mobile(390×844)/desktop(1280×900) + toggle/offline/menu probes. Screenshots in shots/ (111 PNGs, `<page>-<lang>-<mobile|desktop>.png`); raw data results-public.json, results-signedin.json.

## 1. Page matrix

Baseline on all pages: no horizontal overflow at 390px; `<html lang>` switches en/ne; skip-link present; `<main>` + `<nav>` landmarks; exactly one H1 (exceptions below); all images have alt; all real-form inputs labelled (exceptions below); 0 console errors (exceptions below). "Contrast" = distinct low-contrast text pairs (one systemic cause, §2-1).

| Page | H1 | Console/failed | Contrast | Tap <44px | Notes |
|---|---|---|---|---|---|
| home / | ✓ | 0 | 15 (muted grey) | "Register organization" 20px; "OnlyUtils" 17px | Hero starts at y=378 on mobile: header 57 + status bar + red emergency banner (176px) push the H1 below half the fold. Desktop heading ALL-CAPS, mobile sentence case. |
| get-help | ✓ | 0 | 0–2 | none | "No account needed. A moderator will review before anything appears publicly" sets the USP expectation up-front. Draft-restore banner works (NE too). |
| give-help | ✓ | 0 | 1–3 | tab pills 28px | Empty-state copy good; tab text on grey 2.23:1. |
| poster | ✓ | 0 | 3–5 | filter chips 36px; phone link 20px | Search input placeholder-only (no label). |
| missing (guide) | ✓ | 0 | 0–2 | — | Good stepwise "Do this first" guidance. |
| search | ✓ | 0 | 0–2 | — | — |
| projects | ✓ | 0 | 0–2 | — | Empty state; one capture showed "You appear to be offline" while online — intermittent (likely API error treated as offline). |
| project detail (404) | no H1 | 1 (expected) | — | — | Error card fine; no H1; title not set. |
| articles | ✓ | 0 | 0–2 | tag chips 40px | — |
| article detail (404) | no H1 | 1–2 | — | — | /view POST fires before existence check. |
| incidents | ✓ | 0 | 0–2 | 77 district checkboxes 16×16 (inside labels) | Mobile: 77 stacked filter rows before any incident; no search/collapse. |
| report-incident | ✓ | 0 | 0–2 | — | — |
| climate | ✓ | 0 | 15–17 | 34 bar segments | Ranking bar labels rgb(90,87,84) on blue rgb(0,56,147) = 1.47:1. Very long, heavy page. |
| donation status | ✓ | 1 (expected 404) | — | — | — |
| audit, ledger, drop-centers, info, privacy | ✓ | 0 | 0–2 | — | Ledger/audit need district/month before showing anything; empty framing clear. |
| desk/login | no H1 | 0 | 0 | — | No nav. Email/Password placeholder-only. Photo credit white/70 over photo. Toggle reads "अङ्ग्रेजी"/"नेपाली" here vs "EN"/"नेपाली" elsewhere. |
| me (signed out) | ✓ | 0 | 1–3 | — | Clear nudge; anonymity note 2.84:1. |
| unknown route | renders home | 0 | — | — | No 404 page; URL stays wrong. |
| me (signed in) | ✓ | 0 | 0–2 | — | Proper empty states + CTA. |
| desk (as helper) | ✓ | 0 | — | — | Helper bounced to /org, no explanation. |
| my-articles, register-org, org | ✓ | 0 | 0–2 | register-org: 77 16px checkboxes | 77-district wall again. |

## 2. Issues (ranked)

P1
1. Muted text fails WCAG AA everywhere. `--muted-foreground` = rgb(147,143,138): 3.21:1 on white, 2.95:1 on cream rgb(247,245,240). 188 occurrences (captions, helper text, timestamps, "Not available"). Fix: darken token to ≈rgb(112,108,103) (4.6:1). One CSS-variable change. Evidence: home-en-desktop.png, articles-en-mobile.png.
2. Climate ranking values unreadable (1.47:1) — climate-en-mobile.png. Fix: white labels on bars or labels outside.
3. Unknown routes silently render home (not-found-*.png identical to home). Fix: real 404 view with "Back to front page".

P2
4. Emergency banner + status bar take 213px of the 844px mobile viewport on every page; H1 at y≈378 (get-help-en-mobile.png). Suggest single compact row after first screen / sticky-compact on scroll.
5. 77-district checkbox wall on /incidents and /register-organization — ~4,600px scroll before content on mobile. Fix: searchable multi-select / "show more"; list above filter on mobile.
6. desk/login and 404 states have no H1; login inputs placeholder-only. Fix: h1 on CardTitle, visually-hidden labels.
7. Language toggle label inconsistent: "EN" vs "अङ्ग्रेजी"; header shows "नेपाली" in EN but "EN" in NE (name vs code). Pick one convention.
8. Article detail fires /view for a non-existent id — metric noise.
9. Helper visiting /desk is redirected to /org with no message.
10. Small targets: footer "Register organization" 20px, "OnlyUtils" 17px, give-help tab pills 28px, poster phone links 20px. Fix: min-height 44px.

UX-nits
11. Desktop home hero ALL CAPS vs mobile sentence case.
12. /projects intermittently shows "You appear to be offline" while online.
13. Mobile menu lists 20 items flat, mixing pages, account actions and guides; group with headings.
14. Login photo-credit ~2.5:1 over imagery (clickable).
15. "Aa" text-size trigger means nothing in Nepali mode; icon + tooltip.

## 3. Cross-page patterns

- Language toggle persists across navigation and reloads (localStorage verifiednepal:language); document.title localises. Nepali coverage essentially complete (Devanagari:Latin ≈ 25:1 on content pages). Exceptions: login photo credit English in NE; climate page ~70% Latin in NE (country names, dataset text).
- Devanagari renders cleanly (Noto Sans Devanagari; conjuncts fine, no clipped matras at h1 size). Wordmark mixed-script alignment fine.
- Header/nav/footer identical across pages; desk/login drops the nav (only exit is the logo).
- Empty states: consistent inbox icon + sentence + CTA on /me; plain-text on lists. Error pages: red-bordered card with "Try again".
- Focus visibility: 3px brand-blue/white outline on CTAs; no outline:none found.
- Offline: service worker active; full shell and forms load with network off; status bar switches to "Official data snapshot · Updated …" — a genuinely good offline story (offline-get-help-mobile.png, offline-home-mobile.png).
- Page weight: initial JS on cold desktop home ≈400KB; needs a proper Lighthouse pass.

## 4. What's working well (don't change)

- Expectation-setting copy on every intake form — the USP made visible.
- Skip link, landmarks, one H1 per page, labelled inputs on real forms, alt everywhere, no console errors on normal pages.
- Emergency numbers are tappable tel: links, visible everywhere.
- Full bilingual parity with persistence.
- Offline-first shell with honest "snapshot" labelling.
- Dev-only test sign-in: "OR" divider + "(dev only)" caption clear in both languages (desk-login-ne-mobile.png).

## 5. Environment limitations

- Contrast computed from computed styles with alpha compositing; gradients/images approximated.
- Some mobile shots scrolled to first CTA by the focus check (home-en-mobile.png); home-ne-mobile.png shows the true top.
- Radix checkboxes (16px) sit inside labels — functional, sizing sub-spec.
- Detail pages tested only in 404 state (no published projects/articles at capture time); poster board had 1 item.
- Depth-1 crawl: 34 internal links, all 200 (SPA returns 200 for any path).
- Signed-in pages viewed as helper-beta-tester; nothing submitted or changed.
