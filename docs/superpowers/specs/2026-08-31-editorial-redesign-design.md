# Editorial redesign — design spec

Date: 2026-08-31 · Status: approved (direction), pending implementation plan

## 1. Goal

Replace the current dashboard-style presentation with a newspaper/editorial
presentation: warm paper background, high-contrast serif typography,
oversized bilingual masthead, ruled column grid, restrained deep-red accent,
no cards/gradients/shadows/decorative icons. The site must remain a
disaster-response tool first: emergency numbers one tap away on every page,
light on the network, readable on a phone in sunlight, honest labelling,
humane copy, full English/Nepali parity.

Non-goals: no change to data fetching (`live.ts`), geo, i18n mechanics or
routing. No new runtime dependencies. The OnlyUtils chat widget's markup is
external, but its theme is ours (`src/chat-widget.ts` injects `--ouc-*`
variables and a stylesheet into its shadow root), so it is restyled to the same
tokens: ink square launcher, paper panel, hairlines, no gradients or motion.

## 2. Principles that override the visual brief

1. **No photography.** No rights-cleared images; photos of victims are a
   dignity problem on a site relatives use to find family. The relief map,
   rendered monochrome, is the front-page plate.
2. **Honest labels.** No `BREAKING`, no `Issue #001`. Section labels name the
   source: `OFFICIAL FIGURES`, `HELP REQUESTS (OPMCM)`, `OFFICIAL UPDATES`.
   Freshness is carried by the masthead edition line.
3. **Emergency line on every page**, directly under the nav, not dismissable,
   `tel:` links, ≥44px targets.
4. **Copy leads with rescue, states missing factually.** Lead headline is a
   sentence generated from live figures. The "absence from a list is not
   proof of safety or harm" note sits beside the search field.
5. **Weight budget.** Fonts subset via Google Fonts `unicode-range`; total
   font transfer ≤ ~250 KB on the English front page (see §3 for the
   measured trade-off). Lucide is removed entirely.

## 3. Design tokens

Tailwind `theme.extend` is replaced (old `nepal.*` palette, `shadow-panel`,
`shadow-lift`, `bg-flag` removed).

```
colors.paper   #F4EFE6   page background
colors.ink     #16130F   primary text
colors.muted   #6B655C   secondary text (≥ 4.5:1 on paper)
colors.rule    #D9D2C5   hairlines
colors.red     #A20D2B   the one accent (~7:1 on paper)
colors.white   #FFFFFF   inputs, notice box interior
```

Nepal blue leaves the UI; it survives only as the relief-camp pin colour on
the map. Rules are always `1px` `rule`; the masthead uses `1px` + `3px` ink
double rule. No border-radius anywhere except the status dot.

Fonts (Google Fonts, `display=swap`, preconnect kept):

| Role | Latin | Devanagari | Tailwind family |
|---|---|---|---|
| Masthead, headlines | Playfair Display 700 / 900 | Noto Serif Devanagari 700 | `font-display` |
| Body, records, standfirst | Source Serif 4 400 / 400i / 600 | Noto Serif Devanagari 400 | `font-serif` |
| Labels, metadata, numerals, UI | system-ui (SF / Segoe / Roboto) | system Devanagari sans (Noto Sans Devanagari on Android) | `font-sans` |

Measured after implementation: Google serves one variable file per family
regardless of weights requested, and Devanagari files are large (Noto Serif
Devanagari ≈ 124 KB, Noto Sans Devanagari ≈ 118 KB, Martel ≈ 44 KB). Martel,
Noto Sans Devanagari and IBM Plex Sans were therefore dropped — three webfont
families, ≈ 232 KB on the English front page (old site ≈ 130 KB).

One stack per role serves both languages: the Latin faces carry no Devanagari
glyphs, so the browser falls through to the Devanagari face per glyph and
Nepali never reaches system sans. Numerals in tables use `tabular-nums`.

Global CSS: `body { background: paper; color: ink }`, `::selection` red/white,
`color-scheme: only light` kept, reduced-motion block kept. No paper texture
(readability + weight).

## 4. Editorial primitives (`src/ui.tsx`)

`Panel`, `Kicker`, `SourceCaption` are deleted and replaced by:

| Primitive | Renders |
|---|---|
| `Rule` | `<hr>` hairline; `variant="double"` for masthead-style |
| `SectionLabel` | small caps, tracked, `font-sans`, optional red dot, hairline beneath |
| `Headline` | `font-display`, levels 1–3 (front-page lead ≈ 2.6–3.4rem, secondary ≈ 1.6rem, supporting ≈ 1.15rem) |
| `Standfirst` | `font-serif` italic, muted |
| `Byline` | `font-sans` small: `From NDRRMA data · updated 17:42 NPT` (replaces `SourceCaption`) |
| `SquareButton` | square geometry, 1px ink border, uppercase tracked label, `tone="primary"` = ink fill / paper text, `tone="red"` = red fill; external links get a trailing `↗` glyph, never an icon |
| `StatusMark` | `● VERIFIED` / `● MISSING` / `● PENDING` — dot + small caps; red dot only for missing/urgent |
| `RuledTable` | `<table>` with hairline rows, label column left, tabular numerals right |

Everything else is composed from these plus Tailwind grid utilities.

## 5. Shell (`src/layout.tsx`, `src/App.tsx`)

**Masthead** (replaces `Header`; not sticky):

```
──────────────────────────────────────────────────────────────── (1px)
RASUWA · NUWAKOT ·        VERIFIED NEPAL          EDITION · 31 AUG 2026
SINDHUPALCHOK              भेरिफाइड नेपाल          Day 6 · ● LIVE 17:42
Bhote Koshi flash flood  Independent mirror of official NDRRMA data
════════════════════════════════════════════════════════════════ (3px)
FRONT PAGE   FIND A PERSON   HELP & INFO                 EN | नेपाली
──────────────────────────────────────────────────────────────── (1px)
● EMERGENCY   1234 NEOC hotline · 100 Police · 102 Ambulance
──────────────────────────────────────────────────────────────── (1px)
```

- Wordmark: `VERIFIED NEPAL` in `font-display` 900, ~4.5rem desktop / ~2.4rem
  mobile, letter-spaced; `भेरिफाइड नेपाल` beneath in Noto Serif Devanagari,
  always visible regardless of language. Clicking navigates home.
- Left slot: affected districts (from `regionOptions`) + `t.floodName`.
- Right slot: `EDITION · {date}` / `Day {n} · {● LIVE hh:mm | ○ SNAPSHOT dd Mon}`.
  `n = floor((now − 2026-08-26T00:00+05:45) / 1d) + 1`. Live/snapshot uses
  `useLiveData()`; the red dot is static (no `animate-ping`).
- Nav row: text links, active item underlined 2px ink; horizontal scroll on
  mobile. Labels: `Front page / मुख्य पृष्ठ`, `Find a person`, `Help & info`.
  GitHub link moves to the footer. Language toggle: `EN | नेपाली`, active
  weight 600 + underline (no filled button).
- Emergency line: `EmergencyStrip` rewritten — rendered on every page, red
  small-caps `EMERGENCY` + dot, numbers in `font-sans` 600 as `tel:` links
  with the label muted. Dismiss button and `sessionStorage` key removed.
- Mobile: districts slot hidden; edition slot collapses to one line under
  the wordmark.

**Footer** → colophon on paper, hairline above:

```
verifiedNepal is an independent, volunteer-run mirror of … (t.aboutBody)
SOURCE NDRRMA — Government of Nepal · Last synced 31 Aug 2026 17:40 · ● Live
Contribute on GitHub ↗ · Contact verifiednepal01@gmail.com · Privacy & Terms
Powered by OnlyUtils                                       Set in Playfair Display, Source Serif & Martel
```

Navy background, logo image, and `LiveStatusBadge`'s coloured dots go;
`LiveStatusBadge` is restyled (ink text, red dot live / hollow dot snapshot)
and reused in masthead + footer.

`App.tsx`: remove the `h-1 bg-flag` stripe; `main` max-width 80rem; page
padding unchanged. `EmergencyStrip` moves under the masthead for all pages.

## 6. Front page (`src/dashboard.tsx`)

Order and layout (desktop 12-col, gutters 2rem; mobile single column in the
same order):

1. **Lead** — `lg:grid-cols-[7fr_5fr]`, hairline between columns.
   - Left: `SectionLabel OFFICIAL FIGURES`; `Headline` level 1 built from
     live data: en `"{rescued} people rescued from the Bhote Koshi flood; {missing} still missing"`
     (missing-unavailable variant: `"{rescued} people rescued from the Bhote Koshi flood"`),
     ne equivalent; `Byline` (source + updated); `Standfirst` =
     `t.rescuedVerifiedCopy`; official messages (`liveData.messages`) as a
     `font-serif` deck with a left hairline.
   - Right: `SectionLabel BY THE NUMBERS`; `RuledTable` rows Rescued /
     Missing (red label) / Out of reach / Force deployed / Verified records;
     below it the **primary CTA** `SquareButton tone="red"`
     `DONATE TO THE PM DISASTER RELIEF FUND ↗` → `pmdrfUrl`, then secondary
     `SquareButton` `FIND A PERSON` → navigate("search").
2. **Map plate** — full width, 1px ink border, `ReliefMap` with district
   filter rendered as a text row (`All · Rasuwa · Nuwakot · Sindhupalchok`,
   active underlined) replacing the `<select>` on desktop; `<select>` kept
   on mobile. Caption beneath in `font-sans` small: legend + `t.mapCredit`.
   `AffectedLocations` list becomes a ruled two-column list beneath the
   plate on desktop (not a side panel).
3. **Three columns** — hairlines between; stack on mobile.
   - `MISSING PERSONS`: one sentence, inline name input + `SquareButton`
     `SEARCH`; submitting stores the query in `sessionStorage`
     `vn:search-prefill` and calls `navigate("search")` (`FindPerson` reads
     and clears the key on mount); the "absence is not proof" note;
     `REPORT A MISSING PERSON ↗`.
   - `HELP REQUESTS (OPMCM)`: `RuledTable` open / critical (red) / in
     progress / resolved / help offers; `ASK FOR HELP ↗`. Hidden when
     `opmcmStats === null`.
   - `OFFICIAL UPDATES`: up to 3 items as headline-level-3 + date, hairline
     separated; `OPMCM ↗` link. Hidden when empty.
4. **Emergency contacts** — `SectionLabel`, `RuledTable` two columns on
   mobile / 2×N on desktop; each row is a `tel:` link, number in red 600.
5. **Public notice** — relief fund: double-ruled box on white,
   `SectionLabel PUBLIC NOTICE`, headline, body, QR (`pmdrf-qr.svg`) right,
   `DONATE ↗` + `VERIFY ON THE PMO APPEAL ↗`, fake-QR warning in serif
   italic. Kept because it carries the QR and warning; the lead CTA links to
   the same place.
6. **Tables row** — `STATUS OF VERIFIED RECORDS` and `BY NATIONALITY`, each a
   `RuledTable` with a hairline proportion bar (ink; top row red) inside the
   row. No colour legend dots.
7. **Ask the desk** — one ruled line: label, one sentence, `SquareButton`
   `OPEN THE ASSISTANT` → `openChatWidget`. Region select removed here (the
   map filter already writes `vn:region`).

Removed from the front page: `Hero`, `HeroLiveIndicator`, `AgentCta` panel,
`OfficialActionCtas` tiles, `DonateCta` banner (replaced by 5), all
gradients/shadows/hover-translate.

## 7. Find a person (`src/find-person.tsx`)

- Header: `SectionLabel MISSING & RESCUED PERSONS`, `Headline` level 2,
  intro as `Standfirst`.
- Search row: label small caps; input with 1px ink bottom rule + hairline
  sides (white fill for affordance), 48px tall; the disclaimer block
  (`DisclaimerBlock`) renders as a hairline-left aside *beside* the field on
  desktop, beneath on mobile, always visible (not only after search).
- Prefill: read `sessionStorage['vn:search-prefill']` once on mount, clear it.
- Results: hairline-separated `<article>` entries. Name as `Headline` level
  3 (Devanagari name first when present, Latin beneath in muted serif),
  `StatusMark` right-aligned, fields as a 2-col `<dl>` with small-caps
  labels, footer line `Source · Last synced · Verify on NDRRMA ↗`.
- Loading / empty / no-match states are plain serif paragraphs between
  rules; no dashed boxes.

## 8. Help & info (`src/info-help.tsx`)

Single measure (~44rem) in the same order: `EmergencyContacts` (shared),
public notice (shared), `About this mirror` and `Data source and sync` as
text columns with headline level 3, `OFFICIAL LINKS` and `RELIEF RESPONSE`
as ruled link lists with `↗`. `InfoPanel`/`ExternalCard` deleted.

## 9. Privacy & Terms (`src/privacy.tsx`)

Text unchanged. Layout: `lg:grid-cols-[1fr_18rem]` — main column serif body
with numbered section heads in `font-display` level 3; Nepali key-points
summary in the right column under `SectionLabel नेपालीमा सारांश`, sticky on
desktop. Effective date as `Byline`.

## 10. Map (`src/relief-map.tsx`, `src/styles.css`)

- `.leaflet-tile-pane { filter: grayscale(1) sepia(.15) contrast(1.05) }`.
- Container: paper background while tiles load, 1px ink border, no shadow.
- Tooltips: paper background, 1px ink border, ink text, `font-sans`.
- Zoom control: white, 1px ink border, square.
- Pins unchanged in shape; rescue pin red `#A20D2B`, relief-camp pin ink
  (blue dropped). Active pin: static stronger drop shadow, no drop
  animation.
- "Open in Google Maps" and "Show all" overlays become `SquareButton`s.
- Legend moves into the caption under the plate.

## 11. Copy / i18n additions (`src/i18n.ts`, both languages)

`edition`, `dayOf` (`Day {n} of the response`), `leadHeadline`,
`leadHeadlineNoMissing`, `byTheNumbers`, `officialFigures`, `fromSourceData`,
`helpRequestsOpmcm`, `publicNotice`, `askTheDesk`, `donateLeadCta`,
`missingPersonsLabel`, `searchLead`, `searchButton`, `nameLabel`,
`absenceNote` (move the existing sentence out of `noMatch` so it can stand
alone), `statusOfRecords`, `byNationality`, `emergencyLabel`, `setIn`
(colophon), `neSummaryTitle`, `effectiveDate`, `mapPlateCaption`. The
implementation plan is authoritative for exact key names.
Nav key `dashboard` label changes to `Front page` / `मुख्य पृष्ठ`. Remove
keys that no longer render (`agentKicker`, `dismissEmergency`, etc.) once
the components are gone; the TypeScript `labels` shape is the check.

## 12. Accessibility & performance acceptance

- Every interactive element ≥ 44×44px; focus ring 2px red offset 2px.
- Contrast: ink/paper ≥ 15:1, muted/paper ≥ 4.5:1, red/paper ≥ 6:1
  (verify with a contrast checker before merge).
- Heading order valid per page; masthead wordmark is not an `h1` (the lead
  headline is).
- `prefers-reduced-motion` honoured (no motion is added anyway).
- Lighthouse mobile on `/`: Performance ≥ 90, Accessibility 100; font
  transfer ≤ ~150 KB (check Network tab, English page).
- Nepali pass: every page screenshotted in `ne` with no fallback-sans
  Devanagari.
- `pnpm typecheck` and `pnpm build` clean; the existing CI (typecheck +
  build on PR) is the gate.

## 13. Delivery

Branch `redesign/editorial` from `refactor/split-app-components` (depends on
the component split, PR #1). One commit per phase:

1. Foundation — tokens, fonts, global CSS, primitives.
2. Shell — masthead, nav, emergency line, footer, `App.tsx`.
3. Front page.
4. Find a person.
5. Help & info + Privacy.
6. Map treatment.
7. Mobile / Nepali / a11y / weight pass.

Implementation is delegated to Codex (`codex exec`) per phase with this spec
as context; each phase is reviewed and verified (typecheck, build, browser
screenshots at 390px and 1280px in en + ne) before the next starts.
