# Contributing to verifiedNepal

Thanks for helping. This site is used by people in an active disaster, often
on slow phones under stress — that shapes every rule below.

## Hard rules (PRs violating these are closed)

1. **No unverified emergency information.** Helpline numbers, control-room
   contacts, and official links only change with a primary source
   (a `.gov.np` page, an official press release, or the operating
   organization's own site) cited in the PR description. "Everyone knows
   it's X" is not a source — this repo once caught a widely-repeated number
   that doesn't exist.
2. **Only official donation channels.** The site links the PMDRF gateway and
   nothing else. Never add another payment channel, wallet, QR code, or
   fundraiser, whatever the cause.
3. **No personal data beyond the official mirrors.** Person records come
   verbatim from official public APIs. Never add scraped social-media data,
   crowdsourced sightings, or any other PII.
4. **No new runtime dependencies** without discussion in an issue first.
   The bundle must stay small for disaster-zone connections.
5. **Bilingual always.** Every user-visible string needs both `en` and `ne`
   entries in `src/i18n.ts`, written as natural Nepali (get a review from a
   Nepali speaker if unsure).
6. **Accessibility is not optional.** Keep the existing patterns: skip link,
   `aria-*` attributes, focus-visible rings, ≥44px touch targets,
   `prefers-reduced-motion` handling.
7. **No secrets in the repo.** Deploy credentials live outside the repo;
   example values in docs use `<angle-bracket>` placeholders.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:8765
```

`pnpm sync` refreshes the bundled data snapshot from the NDRRMA API — you
generally don't need it; the app fetches live data in the browser anyway.

Before pushing:

```bash
pnpm typecheck && pnpm build
```

Both must pass; there is no CI safety net you can lean on yet.

## Pull requests

- Branch from `main`; `main` is protected — all changes land via PR.
- Keep PRs small and single-purpose. UI change? Include a screenshot
  (mobile width too).
- Describe *why*, cite sources for any factual change (numbers, contacts,
  coordinates, translations).
- Coordinates: only add places you can source (OSM/Nominatim, official
  gazettes, or corroborated news). If a place can't be located, leave it
  unmapped — this site marks approximations explicitly and never guesses.
- Commit messages: imperative, plain ("fix: …", "feat: …"). No AI
  co-author trailers.

## Code style

Match what's there: one-file UI (`src/App.tsx`) with small function
components, Tailwind utility classes, no CSS-in-JS, TypeScript strict.
Comments explain constraints, not restate code.

## Reporting issues

Data wrong or stale? Open an issue with the official source showing the
correct value. Security/privacy concern? Open an issue marked clearly, or
contact the maintainer — do not post exploits publicly first.
