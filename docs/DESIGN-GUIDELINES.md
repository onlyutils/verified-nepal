# VerifiedNepal design guidelines

**Status:** adopted 2026-09-03. Source of truth for how every screen in this repository looks and is built.
**Source design:** Figma "Pitch Deck / Verified Nepal", landing page node `44-2776`
([link](https://www.figma.com/design/iwcBWDGaDhtTooMNbWMQtn/Pitch-Deck?node-id=44-2776)). A render is kept at
`docs/design/landing-figma.png`. The Figma covers the landing page; every other surface follows the rules below.
**Companion reading:** `docs/DESIGN-BRIEF.md` (what the product is), `CONTRIBUTING.md`, `src/styles.css` (tokens).

This project is a teaching example. Every rule here has one goal: a student should be able to open any file,
recognise the pattern, and add a screen that looks like it belongs. Keep it simple. Nothing here needs a library
that is not already in `package.json`.

---

## 1. Principles

1. **Calm, official, fast.** People arrive frightened, on cheap phones, in poor signal. The interface is flat, high
   contrast, one typeface, no decoration. Warm off-white and hairline borders do the grouping; nothing floats.
2. **Two colours, two jobs.** Nepal-flag **blue** means *official, verified, primary action*. Nepal-flag **crimson** means
   *emergency, danger, error*. They never swap jobs. Everything else is neutral or a status colour.
3. **Verified is visible.** Anything that came from an official source or passed moderation shows it: a source line,
   a "Verified" badge, a timestamp. Anything unverified says so.
4. **Status is colour + text, never colour alone.** The site must survive grayscale, high contrast and print.
5. **Same components everywhere.** Public pages, forms, the moderator Desk and the organization dashboard all use the
   same shadcn/ui components and the same tokens. There is no "admin theme".
6. **Nepali and English are equal.** Layouts are designed for the longer string. No tracked uppercase in Devanagari
   (the base CSS turns it off under `html[lang="ne"]`).
7. **KISS.** Prefer a shadcn component over a custom one, a Tailwind class over a CSS file, a native element over a
   JavaScript widget. If a pattern is used twice, it becomes a component in `src/components`. If it is used once, it
   stays inline.

---

## 2. Tokens

All tokens are CSS variables in `src/styles.css` (RGB triplets so Tailwind can add alpha) and are exposed through
`tailwind.config.ts`. **Never write a hex colour in a component.** If a colour is missing, add a token.

### 2.1 Colour

| Token (Tailwind name) | Hex | Use |
|---|---|---|
| `background` | `#FFFFFF` | page |
| `foreground` | `#1C1B1A` | text, icons |
| `secondary` / `muted` | `#F7F5F0` | section bands, secondary buttons, table headers |
| `accent` | `#F0EDE8` | icon chips, hover fills |
| `muted-foreground` | `#5A5754` | secondary text, descriptions |
| `subtle` | `#938F8A` | captions, timestamps, eyebrow labels in neutral tone |
| `faint` | `#B8B4AD` | placeholders, text on the dark footer |
| `border` / `input` | `#E5E0D8` | every hairline |
| `primary` | `#003893` | official, verified, primary button, links, focus ring |
| `primary-soft` / `primary-soft-border` | `#EDF1F8` / `#D4DCF0` | status bar, info badges, active nav |
| `destructive` | `#B82020` | emergency bar, danger button, error text, "missing" numbers |
| `destructive-soft` | `#FFF0F0` | danger badge and alert background |
| `success` / `success-soft` | `#2E7D32` / `#E8F5E9` | open, verified, published, fulfilled |
| `warning` / `warning-soft` | `#92400E` / `#FEF3C7` | pending, limited capacity, attention |
| footer | `foreground` | the dark footer is `bg-foreground` with `text-faint` / `text-background` |

The Figma used `#E65100` on `#FFF3E0` for warnings; that pair fails WCAG AA for small text, so the warning pair
above is used instead. High-contrast mode (`html[data-contrast="high"]` or OS preference) darkens every token in
place; components need no extra code.

### 2.2 Typography

One family: **Noto Sans** (Latin) with **Noto Sans Devanagari**, weights 400 / 500 / 600 / 700, loaded from Google
Fonts in `index.html`. Do not add families. Root size is 100 %; the accessibility bar scales it to 150 %, so never set
`font-size` in pixels.

| Role | Classes | Size |
|---|---|---|
| Page title (h1) | `text-3xl sm:text-4xl font-bold tracking-tight` | 30 / 36 px |
| Hero title | `text-4xl lg:text-5xl font-bold uppercase tracking-tight` | 36 / 48 px (uppercase only in the landing hero) |
| Section title (h2) | `text-2xl font-bold tracking-tight` | 24 px |
| Card title (h3) | `text-lg font-bold` or `text-base font-semibold` | 18 / 16 px |
| Lead paragraph | `text-lg text-muted-foreground` | 18 px |
| Body | `text-base` (default) | 16 px |
| Table, form, meta | `text-sm` | 14 px |
| Caption, badge | `text-xs` | 12 px |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.1em] text-primary` (or `text-subtle`) | 12 px |
| Numbers | add `tabular-nums`; big figures `text-3xl font-bold` | |
| Codes | `font-mono tracking-widest` | |

Minimum rendered size is 12 px. Nepali numerals come from `formatNumber` in `src/lib/format.ts`.

### 2.3 Spacing, radius, elevation

- Spacing is Tailwind's 4 px scale. Card padding `p-5` (20 px) or `p-6`; list rows `py-4`; section bands `py-12 lg:py-16`;
  page gutter `px-4 sm:px-6 lg:px-8`; content width `max-w-7xl` (1280 px) for public pages.
- Radius: `--radius` is 8 px. Buttons, inputs, badges and chips use `rounded-md` / `rounded-lg`. Cards and panels
  use `rounded-xl` (12 px). Dots and avatars are `rounded-full`. Nothing else.
- Elevation: none on cards. Borders do the work (`border`, `border-2` for the hero action cards). The only shadows are
  the ones shadcn puts on dialogs, sheets and dropdowns.
- Motion: only shadcn's open/close transitions. `prefers-reduced-motion` is respected globally.

### 2.4 Icons

`lucide-react`, 16 px inside buttons and badges (`[&_svg]:size-4` is built into `Button`), 20 px in icon chips,
24 px in the emergency tiles. Decorative icons get `aria-hidden="true"`; an icon-only button gets `aria-label`.

---

## 3. Components

### 3.1 shadcn/ui (`src/components/ui`)

Generated by the shadcn CLI, style `new-york`, configured in `components.json`. Add more with

```bash
npx shadcn@latest add <name>
```

(the shadcn MCP server is configured in `.mcp.json` for agents; it uses the same registry). Installed and expected
to be used:

| Component | Use for |
|---|---|
| `Button` | every action. `default` = blue primary, `secondary` = off-white with border (the Figma "Request help" style), `outline`, `ghost`, `destructive`, `link`. Sizes are 44 px tall by default (tap target). Links that look like buttons: `<Button asChild><a href>` |
| `Card` | any bordered panel: action cards, stat tiles, list containers, sign-in gate |
| `Badge` | statuses and categories. Variants `success`, `warning`, `info`, `danger`, `secondary`, `outline`. Prefer `StatusBadge` for statuses |
| `Input`, `Textarea`, `Label`, `Checkbox` | forms. Always pair a `Label` with an id |
| `NativeSelect` | pickers. Native on purpose (best on low-end Android, zero JS). `NativeSelectOption` for options |
| `Table` | any dense list on desktop: queues, ledgers, audit, goods entries |
| `Tabs` | switching views inside a page (e.g. Needs / Offers). Not for top-level navigation |
| `Dialog` | confirmations and short forms. Destructive confirmations always use a `Dialog` with the reason field inside |
| `Sheet` | mobile navigation drawer, long side forms on the dashboards |
| `DropdownMenu` | the account menu in `AppShell`, row overflow actions |
| `Alert` | inline error / success / notice blocks. `variant="destructive"` for errors |
| `Skeleton` | loading placeholders when a layout is known; otherwise `LoadingState` |
| `Separator` | rules between groups |

Edit these files only to change a **variant or size for the whole site**; never for one screen. Local tweaks go in
`className` at the call site.

### 3.2 App components (`src/components`)

| Component | Purpose |
|---|---|
| `Logo` | mark + language-aware wordmark. The mark is not final; do not restyle it |
| `PageHeader`, `SectionHeader`, `Eyebrow` | page and section openings (one `h1` per page, no skipped levels) |
| `StatCard` | big number + label; `tone="danger"` for missing counts |
| `StatusBadge` + `toneForStatus` | the single status idiom (§4) |
| `EmptyState`, `LoadingState` | idle and loading placeholders with the same footprint |
| `CodeDisplay` | ref / claim / update codes, each in its own colour, with copy |
| `AppShell` | shell for signed-in work surfaces (Desk, My organization): top bar, sidebar or tab strip, account menu |
| `layout.tsx` | public site header, status bar, emergency bar, footer, accessibility bar |
| `relief-map.tsx` | Leaflet map plate and location list |
| `error-boundary.tsx` | per-route error boundary with retry |
| `legacy.tsx` | **deprecated** newsprint primitives kept only until every import is migrated (§8) |

---

## 4. Status system

| Tone | Meaning | Examples |
|---|---|---|
| `success` | done, open, trusted | open, verified, published, fulfilled, completed, received |
| `info` | in motion, official | matched, in progress, live data |
| `warning` | waiting on someone | pending, limited capacity, awaiting confirmation |
| `danger` | problem | missing, rejected, suspended, closed, flagged, not received |
| `neutral` | inert | archived, draft, snapshot |

Always `StatusBadge tone={toneForStatus(status)}` with a **translated** label; raw API values (`in_progress`) never
reach the screen. The badge has a dot and text, so it works without colour.

Codes: `ref` (blue), `claim` (green), `update` (amber) via `CodeDisplay`. Emergency numbers are `text-destructive`
bold, tel: links, 44 px tall.

---

## 5. Layout patterns

### 5.1 Public site shell (`src/components/layout.tsx`)

Top to bottom, as in the Figma:

1. **Header** (56 px, white, hairline below): logo lockup with tagline on the left; on the right `नेपाली`/`EN` toggle
   (outlined pill) and the `Aa` accessibility button. Below `lg` the primary nav collapses into a `Sheet` opened by a
   menu button.
2. **Status bar** (36 px, `bg-primary-soft`, `border-primary-soft-border`): blue live dot, "Official data snapshot ·
   Updated HH:MM NPT, D Mon YYYY" (or "Live"), then quick links right-aligned: Drop centers → · Projects → ·
   Dispatches → · Ledger → · Audit →.
3. **Emergency bar** (`bg-destructive`, white text): warning icon, "In immediate danger? Call **1234**", pill buttons
   Police 100 / Ambulance 102 (tel: links); on the right an outlined white button "Donate on PM Disaster Relief Fund ↗".
   Present on every public page.
4. **Main** (`id="main"`, `tabIndex={-1}`), then **Footer**: `bg-foreground`, four columns (about, Official links,
   Accountability, About), bottom line with the live dot + updated time and "Powered by OnlyUtils".

Primary navigation lives in the header sheet (mobile) and as text links in the status bar (desktop). Find a person,
Get help and Give help are the hero actions, not nav items.

### 5.2 Landing page (`src/pages/home.tsx`) — implement the Figma 1:1

1. Hero: left column eyebrow "Rasuwa / Bhote Koshi Flash Flood · 2026", uppercase title "Independent mirror of official
   NDRRMA data", lead paragraph. Right column four action cards: **Find someone** (blue filled, white button),
   **Report a missing person**, **I need help**, **I want to help** (white, `border-2`, icon chip, secondary button).
2. **Current situation** band (`bg-secondary`): h2 + source/updated on the right; four `StatCard`s (rescued, missing in
   red, verified records, active relief locations); "View complete situation report →" and the disclaimer line.
3. **Find relief near you**: h2, district `NativeSelect` + search `Input`, a bordered list of locations with name,
   `StatusBadge`, "type · district", "View details →"; the map plate fills the right half on desktop.
4. **Latest official update**: eyebrow + "Read all official updates →"; a bordered list of update rows with category
   badge, title, summary, source line (shield icon + source · time · Verified badge), "Read update →".
5. **Emergency contacts** card: red dot eyebrow, 1234 hero tile (`bg-foreground`, phone button in red), three big tiles
   100 / 102 / 101, six small tiles for the other numbers.
6. **Public notice** card: Prime Minister Disaster Relief Fund, red "Donate now ↗" and outlined "Verify on the Prime
   Minister's Office appeal ↗", warning line, QR code on the right.

Mobile (320–767 px): everything stacks; action cards keep the icon and title on one row with the button full width
beneath; stat cards go 2-up; the map sits below the list.

### 5.3 Content pages (forms, lists, detail)

`max-w-3xl` for forms and reading, `max-w-7xl` for lists. Open with `PageHeader`. Forms are grouped into `Card`s with
a `CardHeader` title per group; every field has a `Label`; errors are an `Alert variant="destructive"` at the top
plus `text-destructive text-sm` under the field; the submit button is `size="lg"` and full width on mobile. After a
submission, show a **What happens next** card and the code with `CodeDisplay`.

Lists are `Card`s containing rows (`divide-y`) on mobile and a `Table` on `md` and up. Filters sit in one row above
the list (`NativeSelect`, `Input` with search icon). Empty results use `EmptyState`.

### 5.4 Dashboards (Desk, My organization)

Both use `AppShell`. Sidebar on desktop, tab strip on mobile. Each section opens with `PageHeader as="h2"`
(the shell provides the `h1`-level title), then a stat row (`StatCard`) where counts help, then a `Table` (desktop)
or row cards (mobile). Row actions are buttons on the right; anything destructive or irreversible opens a `Dialog`
with a required reason. Feedback is an `Alert` at the top of the section (success auto-dismisses after 6 s, error
stays). Scope is a `Badge variant="info"` under the shell title.

Sign-in gates (signed out, wrong role, guidelines acknowledgement) are a centered `Card` (`max-w-md`) with the logo,
title, one paragraph and one primary button.

### 5.5 Chat assistant (`src/lib/chat-widget.ts`)

The OnlyUtils widget is themed through CSS variables to these tokens: blue header, 12 px radius, Noto Sans,
assistant bubbles on `secondary`, user bubbles in `primary`, launcher is the brand mark on a blue circle, 56 px,
lifted above the page controls on mobile.

### 5.6 Print

`@media print` hides navigation and chrome (`print:hidden`), removes colours from links and keeps tables at 100 %
width. Claim sheets, ledger and drop-center needs lists must read on A4 in black and white; that is why statuses are
never colour alone.

---

## 6. Accessibility

- WCAG 2.2 AA. All token pairs above meet 4.5:1 for text; `subtle` on `background` is 3.5:1 and is therefore only
  used at 12 px bold or for non-essential captions.
- Focus ring is 2 px `ring` (blue) with a 2 px offset on every interactive element; it is baked into `Button`,
  `Input`, `NativeSelect` and `AppShell` nav.
- Tap targets are at least 44 px (`Button` default height, `min-h-11` on custom controls).
- One `h1` per page (`PageHeader`); headings do not skip levels.
- Every form control has a visible `Label`. Live regions: loading and result counts use `role="status"`.
- Dialogs are shadcn `Dialog` (focus trap, Esc, backdrop). Do not build custom modals.
- Language: `lang` attributes on mixed-language text (the `Logo` does this).

---

## 7. Content

Plain language, verbs first, both languages for every string. Strings live in `src/i18n/*.ts`, grouped by area
(`shell`, `forms`, `orgs`, `centers`, `desk`, `desk-orgs`, `ui`, `map`, and the core `index.ts`). Add new strings to
the file for your area; do not create per-component string files. Sentence case for titles and buttons; uppercase only
through the `Eyebrow` component. Never show a raw machine value.

---

## 8. Migration rules (from the newsprint design)

Until every page is migrated, `src/components/legacy.tsx` and the Tailwind aliases `paper`, `ink`, `rule`, `red`,
`blue`, `font-display`, `font-serif` keep old code compiling. In any file you touch:

| Old | New |
|---|---|
| `text-ink` / `bg-paper` / `border-rule` | `text-foreground` / `bg-background` / `border` |
| `text-red`, `text-blue` | `text-destructive`, `text-primary` |
| `font-serif`, `font-display`, `font-sans`, `italic` | remove (one family, no italics for emphasis) |
| `SquareButton` | `Button` (`tone="primary"` → default, `red` → `destructive`, `outline` → `secondary`) |
| `SectionLabel` | `Eyebrow` or `SectionHeader` |
| `Headline level={1}` | `PageHeader` |
| `Standfirst` | `<p className="text-lg text-muted-foreground">` |
| `StatusMark` / `ProjectStatusMark` | `StatusBadge tone={toneForStatus(...)}` |
| `RuledTable` | `Table`, or a `dl` with `divide-y` |
| `Rule` | `Separator` or a `border-t` |
| hand-made `<button>` tabs | `Tabs` (in-page) or `AppShell` nav |
| custom `<dialog>` | shadcn `Dialog` |
| `<select>` | `NativeSelect` |

Delete an export from `legacy.tsx` as soon as nothing imports it. The aliases in `tailwind.config.ts` go last.

---

## 9. Checklist for a new screen

1. Route added in `src/App.tsx`; page file in `src/pages` (public), `src/desk` or `src/org` (signed in).
2. Opens with `PageHeader`; content in `Card`s; actions are `Button`s; statuses are `StatusBadge`s.
3. Loading → `LoadingState`/`Skeleton`, empty → `EmptyState`, error → `Alert variant="destructive"` with retry.
4. Works at 320 px, at 150 % text, in high contrast, in Nepali. No horizontal scroll.
5. Strings in the right `src/i18n` file, both languages.
6. `pnpm typecheck && pnpm test && pnpm build` pass.
