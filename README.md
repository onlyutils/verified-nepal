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
pnpm build         # static production build in dist/
```

The dev server uses port 8765 because the chat widget's origin allowlist
accepts that origin.

## Repository layout

```
src/App.tsx        all pages/components (dashboard, search, info, privacy)
src/live.ts        live NDRRMA/OPMCM fetching + React context
src/geo.ts         place-name → coordinate lookup, district shapes
src/i18n.ts        en/ne string dictionaries — every string has both
src/helplines.ts   verified emergency numbers (sources in comments)
src/chat-widget.ts branding glue for the embedded chat widget
scripts/sync.mjs   snapshot generator (NDRRMA API → public/data/)
infra/deploy.sh    Cloudflare Pages deploy (maintainer credentials required)
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
