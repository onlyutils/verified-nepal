# verifiedNepal

An independent, volunteer-run public-service dashboard for the **2026 Rasuwa /
Bhote Koshi flash flood** in Nepal. It mirrors official public data so that
affected people, relatives, and donors get one fast, bilingual (English /
नेपाली), mobile-first view of the response:

- **Live figures** — rescued, missing, forces deployed — fetched in the
  browser from NDRRMA's public API every 5 minutes, with a bundled snapshot
  as offline fallback and a visible live/snapshot indicator.
- **Find a person** — name search (English or Devanagari, order-independent,
  diacritic-folded) across the officially verified rescued list *and* the
  missing-persons list.
- **Verified emergency contacts** — national disaster hotline 1234 and the
  flood-specific MoHA/MoFA control rooms, all checked against primary
  sources.
- **Relief map** — affected locations and relief camps with a district
  filter.
- **Official actions & updates** — deep links into the Government of Nepal's
  OPMCM rescue portal (report a missing person, ask for help) and its live
  coordination stats and updates feed.
- **AI assistant** — a chat widget grounded in the same live data (powered by
  [OnlyUtils](https://onlyutils.com)).
- **Mutual-aid portal** — request help (`/get-help`) or offer help (`/give-help`) by category and district; moderators match needs to offers and issue claim codes. Redeemed claims appear on a public, masked ledger. Helpers can browse community projects (`/projects`) with photo updates and dispatches, while district-scoped moderators work a queue at `/desk` and every action is recorded in a public masked audit log (`/audit`).

This is **not** a government website. It exists to make already-public
disaster information easier to read. Verify individual records on the
official pages linked throughout the site, and rely on official hotlines for
any emergency decision.

## Data sources

| Source | What | How |
|---|---|---|
| [NDRRMA rescues API](https://ndrrma.gov.np/api/v1/rescues/) | rescued/missing counts, person records, locations, official messages | browser fetch (CORS-open) + `pnpm sync` snapshot |
| [OPMCM rescue portal API](https://rescue.opmcm.gov.np/) | help-request coordination stats, government effort updates | browser fetch (CORS-open) |

`public/data/*.json` is the build-time snapshot written by `pnpm sync`; the
running app prefers live responses and falls back to the snapshot.

## Local development

```bash
pnpm install       # dependencies
pnpm sync          # refresh the local data snapshot (optional)
pnpm dev           # http://localhost:8765
pnpm typecheck     # TypeScript checks
pnpm test          # frontend unit checks (node --test)
pnpm build         # static production build in dist/
```

Copy `.env.example` to `.env` for the optional portal/auth wiring (`VITE_API_BASE`, `VITE_OU_CLIENT_ID`); with an empty `.env` the app renders the read-only snapshot with live NDRRMA fallback. The dev server uses port 8765 because the chat widget's origin allowlist accepts that origin.

### Backend

```bash
cd server && pnpm install && pnpm test   # fully offline — fake JWKS/DynamoDB, no AWS credentials needed
```

See [`server/README.md`](server/README.md) for env vars and routes.

## Repository layout

```
src/App.tsx              routing shell — maps URL paths to pages and sets language/robots state
src/layout.tsx           masthead, nav, emergency line, footer
src/ui.tsx               editorial primitives (Rule, SectionLabel, Headline, SquareButton, RuledTable, …)
src/dashboard.tsx        front-page dashboard composition
src/find-person.tsx      name search across rescued/missing lists
src/relief-map.tsx       Leaflet map plate and affected locations
src/info-help.tsx        Info / Help page
src/privacy.tsx          Privacy & Disclaimer page
src/pages/get-help.tsx   mutual-aid: submit a need (category/district/ward) with Turnstile
src/pages/give-help.tsx  mutual-aid: offer help, browse needs/offers, flag inaccurate listings
src/pages/projects.tsx   project registry list (filters by district/status)
src/pages/project-detail.tsx  project detail (photos/updates, published-only)
src/pages/project-register.tsx  anonymous project registration (Turnstile, returns updateCode)
src/pages/project-update.tsx    committee project update / photo upload (updateCode or moderator)
src/pages/dispatches.tsx community dispatches list (published, tag filter)
src/pages/dispatch-detail.tsx  dispatch detail view
src/pages/ledger.tsx     public masked ledger of redeemed claims
src/pages/audit.tsx      public masked audit log (month + cursor, public)
src/desk.tsx             moderator/admin desk at /desk (queue, claims, flags, projects, dispatches, user/role admin)
src/auth.tsx             OnlyUtils OAuth Authorization Code + PKCE sign-in, token storage, useGoogleAuth hook
src/api.ts               typed fetch client for the Lambda backend (needs/offers/claims/ledger/projects/dispatches/admin)
src/live.ts              live NDRRMA/OPMCM fetching + React context and LiveStatusBadge
src/geo.ts               place-name → coordinate lookup, district shapes
src/i18n.ts              en/ne string dictionaries — every string has both
src/helplines.ts         verified emergency numbers (sources in comments)
src/edition.ts           edition line helpers (response day, lead headline, fillTemplate)
src/chat-widget.ts       branding glue for the embedded OnlyUtils chat widget
src/lib/sw-rules.ts      service-worker cache classifier (hasAuthHeader, cache helpers)
src/components/ui/*      shadcn-style primitives (button, card, dialog, input, label, select, separator, table, textarea, badge)
src/*.test.ts            frontend unit tests (edition, sw-rules, projects, phase2) — run via pnpm test
server/                  Lambda API (Node 22, ESM) — see server/README.md
docs/GOVERNANCE.md       portal governance, roles, district scoping, audit-log policy
docs/MODERATION-GUIDELINES.md  moderator handbook (verification, masking, rejection reasons)
docs/DESIGN-BRIEF.md      UI/UX redesign brief — every page, flow, state and constraint for the designer
scripts/sync.mjs         snapshot generator (NDRRMA API → public/data/)
scripts/build-geo.py     geometry builder for relief map (Overpass/OSM → public/data/geo/)
infra/deploy.sh          Cloudflare Pages deploy (dev/prod, maintainer credentials required)
.github/workflows/ci.yml         CI — typecheck, frontend + backend tests, build
.github/workflows/deploy-dev.yml auto-deploy to dev on push to main
.github/workflows/deploy-prod.yml manual prod deploy (owner-only)
```

## Privacy posture

The dashboard is aggregate-only. Person records are never listed or browsable
in bulk: they appear only through an explicit name search, the search view
sets `noindex`, and `robots.txt` disallows `/search` and `/data/`. The site
sets no cookies and runs no analytics. See the in-app Privacy & Disclaimer
page for the full policy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Corrections to data, translations,
and accessibility fixes are especially welcome. Please never add unverified
emergency numbers or unofficial donation channels — see the hard rules there.

## License

[MIT](LICENSE). The mirrored datasets remain the property of their
respective official sources.
