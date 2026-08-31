# Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-present verifiedNepal as a newspaper-style editorial publication (paper background, serif typography, bilingual masthead, ruled column grid, single deep-red accent) without touching data fetching, routing, or i18n mechanics.

**Architecture:** A small set of editorial primitives in `src/ui.tsx` replaces the card/panel idiom; each page module is recomposed on a ruled grid using those primitives. Pure helpers for the masthead edition line live in `src/edition.ts` with a `node --test` check. Old tokens/primitives are kept alive until the final cleanup task so every task typechecks and builds on its own.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind 3.4, react-leaflet 4, Google Fonts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-31-editorial-redesign-design.md`

## Global Constraints

- Branch `redesign/editorial`; one commit per task; plain commit messages (no `Co-Authored-By` / `Claude-Session` trailers).
- No new runtime or dev dependencies.
- Every string rendered to users has an `en` and `ne` entry in `src/i18n.ts` (the `satisfies Record<Language, Record<string, string>>` clause enforces key parity via `labels[language]` typing).
- Colours: only `paper #F4EFE6`, `ink #16130F`, `muted #6B655C`, `rule #D9D2C5`, `red #A20D2B`, `white #FFFFFF`. No other Tailwind palette colours (`emerald-*`, `amber-*`, `sky-*`, `nepal-*`) survive past Task 8.
- No `rounded-*` except the 8px status/live dots (`rounded-full` on `h-2 w-2`). No `shadow-*`, no gradients, no `animate-*`, no `hover:-translate-*`.
- Every interactive element ≥ 44×44px (`min-h-11` + horizontal padding); focus style `focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper`.
- External links: `target="_blank" rel="noopener noreferrer"` and a trailing `↗` glyph, never an icon component.
- Verification per task: `pnpm typecheck && pnpm build` clean, then `pnpm dev` and screenshots at 390×844 and 1280×900 in `en` and `ne` (toggle via the masthead nav) — inspect for fallback-sans Devanagari, overflow, and contrast.
- Fonts: Playfair Display, Noto Serif Devanagari, Source Serif 4, Martel, IBM Plex Sans, Noto Sans Devanagari — only the weights listed in Task 1.

---

### Task 1: Foundation — tokens, fonts, global CSS, editorial primitives

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `index.html:9-13` (font `<link>`s), `index.html:6` (`theme-color`)
- Modify: `src/styles.css`
- Modify: `src/ui.tsx` (add primitives; keep `Kicker`, `Panel`, `SourceCaption` until Task 8)

**Interfaces:**
- Produces (from `src/ui.tsx`):
  - `focusRing: string` (shared focus-visible classes)
  - `Rule({ variant?: "single" | "double"; className?: string })`
  - `SectionLabel({ children; as?: "h2" | "h3" | "p"; id?: string; dot?: boolean; className?: string })`
  - `Headline({ level: 1 | 2 | 3; as?: "h1" | "h2" | "h3" | "p"; id?: string; className?: string; children })`
  - `Standfirst({ children; className?: string })`
  - `Byline({ language: Language; source?: string; updatedAt?: string | null; className?: string })`
  - `SquareButton({ href?: string; onClick?: () => void; type?: "button" | "submit"; tone?: "outline" | "primary" | "red"; external?: boolean; className?: string; children })`
  - `StatusMark({ tone: "verified" | "missing" | "pending" | "neutral"; children })`
  - `RuledTable({ caption: string; rows: Array<{ key: string; label: ReactNode; value: ReactNode; red?: boolean; bar?: number }> ; className?: string })`
- Produces Tailwind tokens: `bg-paper text-ink text-muted border-rule bg-red text-red border-ink font-display font-serif font-sans`.

- [ ] **Step 1: Replace the Tailwind theme**

Replace the whole `theme.extend` block in `tailwind.config.ts` with:

```ts
    extend: {
      colors: {
        paper: "#F4EFE6",
        ink: "#16130F",
        muted: "#6B655C",
        rule: "#D9D2C5",
        red: "#A20D2B",
        white: "#FFFFFF",
        // ponytail: legacy palette kept until Task 8 so untouched pages still render.
        nepal: {
          crimson: "#DC143C",
          crimsonDeep: "#A20D2B",
          crimsonSoft: "#FFF1F4",
          blue: "#003893",
          blueDeep: "#001B47",
          blueSoft: "#EEF2FB",
          ink: "#0B1220",
          slate: "#4A5568",
          line: "#DCE3F0",
          mist: "#F5F7FC",
          onDark: "#C8D4EA",
          onDarkMuted: "#93A7CA",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Serif Devanagari"', "Georgia", "serif"],
        serif: ['"Source Serif 4"', "Martel", '"Noto Serif Devanagari"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', '"Noto Sans Devanagari"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        display: "-0.035em",
      },
      boxShadow: {
        // ponytail: legacy, removed in Task 8.
        panel: "0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 32px -18px rgba(0, 27, 71, 0.35)",
        lift: "0 20px 48px -24px rgba(0, 27, 71, 0.55)",
      },
      backgroundImage: {
        flag: "linear-gradient(90deg, #003893 0%, #003893 42%, #DC143C 42%, #DC143C 100%)",
      },
    },
```

Latin faces carry no Devanagari glyphs, so the browser falls through to the Devanagari face per glyph — one stack per role serves both languages.

- [ ] **Step 2: Load the fonts**

In `index.html`, replace the single Noto Sans Devanagari `<link href=...>` with:

```html
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Noto+Serif+Devanagari:wght@400;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Martel:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap"
    rel="stylesheet"
  />
```

and change `<meta name="theme-color" content="#DC143C" />` to `content="#F4EFE6"`.

- [ ] **Step 3: Global CSS**

Replace `src/styles.css` from the top through the `::selection` rule (keep everything from `/* --- Leaflet --- */` onward unchanged for now) with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* "only" opts out of Chrome auto-dark, which would invert the paper. */
  color-scheme: only light;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  background: #f4efe6;
  color: #16130f;
  font-family: "Source Serif 4", Martel, "Noto Serif Devanagari", Georgia, serif;
}

button,
input,
textarea,
select {
  font: inherit;
}

::selection {
  background: #a20d2b;
  color: #f4efe6;
}

/* Thin scrollbars for the ruled lists. */
.overflow-auto {
  scrollbar-width: thin;
  scrollbar-color: #d9d2c5 transparent;
}
```

- [ ] **Step 4: Add the primitives to `src/ui.tsx`**

Append after the existing exports (do not delete `Kicker`, `Panel`, `SourceCaption` yet):

```tsx
import type { ReactNode } from "react";

export const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export function Rule({ variant = "single", className = "" }: { variant?: "single" | "double"; className?: string }) {
  if (variant === "double") {
    return (
      <div className={`border-t border-ink ${className}`} aria-hidden="true">
        <div className="mt-[3px] border-t-[3px] border-ink" />
      </div>
    );
  }
  return <hr className={`m-0 border-0 border-t border-rule ${className}`} />;
}

export function SectionLabel({
  children,
  as: Tag = "h2",
  id,
  dot = false,
  className = "",
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "p";
  id?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={`flex items-center gap-2 border-b border-rule pb-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink ${className}`}
    >
      {dot ? <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

const headlineSize = {
  1: "text-[2.25rem] leading-[1.05] sm:text-[3rem] lg:text-[3.4rem]",
  2: "text-[1.75rem] leading-[1.1] sm:text-[2.1rem]",
  3: "text-[1.2rem] leading-[1.25]",
} as const;

export function Headline({
  level,
  as,
  id,
  className = "",
  children,
}: {
  level: 1 | 2 | 3;
  as?: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as ?? (`h${level}` as "h1" | "h2" | "h3");
  return (
    <Tag id={id} className={`font-display font-bold tracking-[-0.01em] text-ink ${headlineSize[level]} ${className}`}>
      {children}
    </Tag>
  );
}

export function Standfirst({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-serif text-[1.05rem] italic leading-7 text-muted ${className}`}>{children}</p>;
}

export function Byline({
  language,
  source = "NDRRMA",
  updatedAt,
  className = "",
}: {
  language: Language;
  source?: string;
  updatedAt?: string | null;
  className?: string;
}) {
  const t = labels[language];
  const liveData = useLiveData();
  const time = updatedAt ?? (liveData.isLive && liveData.updatedAt ? liveData.updatedAt : data.meta.synced_at);
  return (
    <p className={`font-sans text-[0.68rem] uppercase leading-5 tracking-[0.14em] text-muted ${className}`}>
      {t.fromSourceData.replace("{source}", source)} <span aria-hidden="true">·</span>{" "}
      {t.sourceCaptionUpdated} {formatCaptionTime(time, language)}
    </p>
  );
}

const buttonTone = {
  outline: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  primary: "border-ink bg-ink text-paper hover:border-red hover:bg-red",
  red: "border-red bg-red text-paper hover:border-ink hover:bg-ink",
} as const;

export function SquareButton({
  href,
  onClick,
  type = "button",
  tone = "outline",
  external = false,
  className = "",
  children,
}: {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "outline" | "primary" | "red";
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 border px-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors ${buttonTone[tone]} ${focusRing} ${className}`;
  const content = (
    <>
      {children}
      {external ? <span aria-hidden="true">↗</span> : null}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

const statusDot = {
  verified: "bg-ink",
  missing: "bg-red",
  pending: "border border-ink bg-transparent",
  neutral: "bg-muted",
} as const;

export function StatusMark({
  tone,
  children,
}: {
  tone: "verified" | "missing" | "pending" | "neutral";
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
      <span className={`h-2 w-2 rounded-full ${statusDot[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function RuledTable({
  caption,
  rows,
  className = "",
}: {
  caption: string;
  rows: Array<{ key: string; label: ReactNode; value: ReactNode; red?: boolean; bar?: number }>;
  className?: string;
}) {
  return (
    <table className={`w-full border-collapse font-sans text-sm ${className}`}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-rule">
            <th scope="row" className={`py-2.5 pr-3 text-left font-normal ${row.red ? "text-red" : "text-muted"}`}>
              {row.label}
              {row.bar !== undefined ? (
                <span
                  className={`mt-1.5 block h-px ${row.red ? "bg-red" : "bg-ink"}`}
                  style={{ width: `${Math.max(Math.min(row.bar, 1), 0.01) * 100}%` }}
                  aria-hidden="true"
                />
              ) : null}
            </th>
            <td className="py-2.5 text-right align-top font-semibold tabular-nums text-ink">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Move the `import type { ReactNode } from "react";` line to the top of the file with the other imports. `Byline` uses the new i18n key `fromSourceData`; add it now to both dictionaries in `src/i18n.ts` (en: `"From {source} data"`, ne: `"{source} तथ्यांकबाट"`), placed right after `sourceCaptionUpdated`.

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm build`
Expected: both clean. Start `pnpm dev`, load `/`: body is ivory and body text is now a serif (the old panels still render — that is expected until later tasks). Open DevTools → Network → filter `fonts.gstatic.com`: only the weights above load.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts index.html src/styles.css src/ui.tsx src/i18n.ts
git commit -m "feat(redesign): editorial tokens, fonts and primitives"
```

---

### Task 2: Edition helpers and i18n strings

**Files:**
- Create: `src/edition.ts`
- Create: `src/edition.test.ts`
- Modify: `tsconfig.app.json` (exclude test files)
- Modify: `package.json` (`test` script)
- Modify: `src/i18n.ts` (new keys, both languages)

**Interfaces:**
- Produces (`src/edition.ts`):
  - `responseDay(now?: Date): number` — 1 on 26 Aug 2026 NPT, +1 per NPT midnight
  - `fillTemplate(template: string, vars: Record<string, string>): string`
  - `leadHeadline(t: { leadHeadline: string; leadHeadlineNoMissing: string }, rescued: string, missing: string | null): string`
  - `formatEditionDate(now: Date, language: Language): string` — `31 August 2026` / Nepali locale equivalent
- Produces i18n keys listed in Step 3; later tasks reference them by name.

- [ ] **Step 1: Write the failing test**

Create `src/edition.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { fillTemplate, leadHeadline, responseDay } from "./edition.ts";

test("responseDay counts from 26 Aug 2026 in Nepal time", () => {
  assert.equal(responseDay(new Date("2026-08-26T00:00:00+05:45")), 1);
  assert.equal(responseDay(new Date("2026-08-26T23:59:00+05:45")), 1);
  assert.equal(responseDay(new Date("2026-08-27T00:01:00+05:45")), 2);
  assert.equal(responseDay(new Date("2026-08-31T17:45:00+05:45")), 6);
  // Never below 1, even if a clock is behind.
  assert.equal(responseDay(new Date("2026-08-20T00:00:00+05:45")), 1);
});

test("fillTemplate replaces every placeholder and leaves unknown ones", () => {
  assert.equal(fillTemplate("{a} and {b} and {a}", { a: "1", b: "2" }), "1 and 2 and 1");
  assert.equal(fillTemplate("{a} {zzz}", { a: "1" }), "1 {zzz}");
});

test("leadHeadline picks the no-missing variant when missing is null", () => {
  const t = { leadHeadline: "{rescued} rescued; {missing} missing", leadHeadlineNoMissing: "{rescued} rescued" };
  assert.equal(leadHeadline(t, "2,189", "54"), "2,189 rescued; 54 missing");
  assert.equal(leadHeadline(t, "2,189", null), "2,189 rescued");
});
```

Add to `package.json` scripts: `"test": "node --experimental-strip-types --test src/*.test.ts"`.

In `tsconfig.app.json` add `"exclude": ["src/**/*.test.ts"]` after `"include": ["src"]` (no `@types/node` in the project; Node strips types without checking).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './edition.ts'`.

- [ ] **Step 3: Implement `src/edition.ts`**

```ts
import type { Language } from "./types";

/** The Bhote Koshi flood: 26 Aug 2026, Nepal time. */
const responseStart = Date.parse("2026-08-26T00:00:00+05:45");
const dayMs = 86_400_000;

export function responseDay(now: Date = new Date()) {
  return Math.max(1, Math.floor((now.getTime() - responseStart) / dayMs) + 1);
}

export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export function leadHeadline(
  t: { leadHeadline: string; leadHeadlineNoMissing: string },
  rescued: string,
  missing: string | null,
) {
  return missing === null
    ? fillTemplate(t.leadHeadlineNoMissing, { rescued })
    : fillTemplate(t.leadHeadline, { rescued, missing });
}

export function formatEditionDate(now: Date, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(now);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test`
Expected: `# pass 3`.

- [ ] **Step 5: Add the i18n keys**

In `src/i18n.ts`, change `dashboard` to `"Front page"` (en) / `"मुख्य पृष्ठ"` (ne), and add to **both** dictionaries (insert before `privacyTitle`):

```ts
    // en
    edition: "Edition",
    dayOf: "Day {n} of the response",
    officialFigures: "Official figures",
    leadHeadline: "{rescued} people rescued from the Bhote Koshi flood; {missing} still missing",
    leadHeadlineNoMissing: "{rescued} people rescued from the Bhote Koshi flood",
    byTheNumbers: "By the numbers",
    donateLeadCta: "Donate to the PM Disaster Relief Fund",
    missingPersonsLabel: "Missing persons",
    searchLead: "Search the officially verified rescued and missing lists by name.",
    searchButton: "Search",
    absenceNote: "Absence from these lists is not proof of safety or harm.",
    helpRequestsOpmcm: "Help requests (OPMCM)",
    publicNotice: "Public notice",
    statusOfRecords: "Status of verified records",
    byNationality: "By nationality",
    askTheDesk: "Ask the desk",
    emergencyLabel: "Emergency",
    setIn: "Set in Playfair Display, Source Serif and Martel",
    neSummaryTitle: "नेपालीमा सारांश",
    effectiveDate: "Effective date",
    mapPlateCaption: "Rescue locations and relief camps along the Bhote Koshi–Trishuli corridor.",
    nameLabel: "Name",
```

```ts
    // ne
    edition: "संस्करण",
    dayOf: "उद्धार कार्यको {n}औं दिन",
    officialFigures: "आधिकारिक तथ्यांक",
    leadHeadline: "भोटेकोशी बाढीबाट {rescued} जनाको उद्धार; {missing} जना अझै बेपत्ता",
    leadHeadlineNoMissing: "भोटेकोशी बाढीबाट {rescued} जनाको उद्धार",
    byTheNumbers: "तथ्यांकमा",
    donateLeadCta: "प्रधानमन्त्री विपद् राहत कोषमा सहयोग गर्नुहोस्",
    missingPersonsLabel: "बेपत्ता व्यक्तिहरू",
    searchLead: "आधिकारिक रूपमा प्रमाणित उद्धार र बेपत्ता सूचीमा नामबाट खोज्नुहोस्।",
    searchButton: "खोज्नुहोस्",
    absenceNote: "यी सूचीमा नभेटिनु सुरक्षित वा असुरक्षित भएको प्रमाण होइन।",
    helpRequestsOpmcm: "सहयोग अनुरोध (प्रधानमन्त्री कार्यालय)",
    publicNotice: "सार्वजनिक सूचना",
    statusOfRecords: "प्रमाणित अभिलेखको स्थिति",
    byNationality: "राष्ट्रियता अनुसार",
    askTheDesk: "सहायकसँग सोध्नुहोस्",
    emergencyLabel: "आपतकालीन",
    setIn: "Playfair Display, Source Serif र Martel मा टाइपसेट",
    neSummaryTitle: "नेपालीमा सारांश",
    effectiveDate: "प्रभावकारी मिति",
    mapPlateCaption: "भोटेकोशी–त्रिशूली क्षेत्रका उद्धार स्थान र राहत शिविर।",
    nameLabel: "नाम",
```

Also shorten `noMatch` in both languages to drop the "absence" sentence, which now lives in `absenceNote`:
- en: `"No match found. Official rescued and missing-person lists are still being updated. Check the official NDRRMA page and contact the authorities."`
- ne: `"कुनै मिल्दो नतिजा भेटिएन। आधिकारिक उद्धार र बेपत्ता व्यक्तिका सूचीहरू अझै अद्यावधिक भइरहेका छन्। आधिकारिक NDRRMA पेज हेर्नुहोस् र सम्बन्धित निकायमा सम्पर्क गर्नुहोस्।"`

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all clean.

```bash
git add src/edition.ts src/edition.test.ts tsconfig.app.json package.json src/i18n.ts
git commit -m "feat(redesign): edition helpers and editorial copy"
```

---

### Task 3: Shell — masthead, nav, emergency line, colophon footer

**Files:**
- Modify: `src/layout.tsx` (rewrite)
- Modify: `src/App.tsx:63-83`
- Modify: `src/live.ts:137-156` (`LiveStatusBadge` styling)

**Interfaces:**
- Consumes: `Rule`, `SquareButton` (Task 1); `responseDay`, `fillTemplate`, `formatEditionDate` (Task 2); `regionOptions` from `src/region.tsx`; `districtLabels` from `src/geo.ts`.
- Produces (`src/layout.tsx`): `Masthead({ page, language, setLanguage, navigate })`, `EmergencyLine({ language })`, `Footer({ language, navigate })`. `Header` and `EmergencyStrip` are removed.

- [ ] **Step 1: Restyle `LiveStatusBadge` in `src/live.ts`**

Replace the `createElement("span", { className: ... }, createElement("span", {...dot}), label)` body so the outer span has
`className: \`inline-flex items-center gap-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink ${className}\``
and the dot has
`className: \`h-2 w-2 rounded-full ${liveData.isLive ? "bg-red" : "border border-ink bg-transparent"}\``.
Nothing else in the function changes.

- [ ] **Step 2: Rewrite `src/layout.tsx`**

```tsx
import { data } from "./data";
import { fillTemplate, formatEditionDate, responseDay } from "./edition";
import { districtLabels } from "./geo";
import { labels } from "./i18n";
import { LiveStatusBadge } from "./live";
import { regionOptions } from "./region";
import type { Language, Page } from "./types";
import { focusRing, Rule } from "./ui";
import { githubUrl, onlyUtilsUrl, pmoAppealUrl } from "./urls";
import { formatDateTime, formatNumber } from "./utils";

const shell = "mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8";
const navPages = ["dashboard", "search", "info"] as const;

export function Masthead({
  page,
  language,
  setLanguage,
  navigate,
}: {
  page: Page;
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
}) {
  const t = labels[language];
  const districts = regionOptions.map((district) => districtLabels[district][language]).join(" · ");

  return (
    <header className={shell}>
      <Rule className="mt-3" />
      <div className="grid items-end gap-4 py-5 text-center lg:grid-cols-[1fr_auto_1fr] lg:text-left">
        <p className="hidden font-sans text-[0.68rem] uppercase leading-5 tracking-[0.14em] text-muted lg:block">
          {districts}
          <br />
          {t.floodName}
        </p>
        <button type="button" onClick={() => navigate("dashboard")} className={`mx-auto block ${focusRing}`}>
          <span className="block font-display text-[2.4rem] font-black uppercase leading-none tracking-[0.06em] text-ink sm:text-[3.6rem] lg:text-[4.5rem]">
            Verified Nepal
          </span>
          <span lang="ne" className="mt-2 block font-display text-lg leading-none text-ink sm:text-xl">
            भेरिफाइड नेपाल
          </span>
          <span className="mt-3 block font-serif text-sm italic text-muted">{t.unofficial}</span>
        </button>
        <EditionLine language={language} />
      </div>
      <Rule variant="double" />
      <nav
        aria-label="Primary navigation"
        className="flex items-center gap-5 overflow-x-auto font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em]"
      >
        {navPages.map((item) => {
          const active = page === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => navigate(item)}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 transition-colors ${
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              } ${focusRing}`}
            >
              {t[item]}
            </button>
          );
        })}
        <div className="ml-auto flex shrink-0 items-center gap-2" aria-label={t.language}>
          <LanguageButton active={language === "en"} onClick={() => setLanguage("en")}>
            EN
          </LanguageButton>
          <span aria-hidden="true" className="text-rule">
            |
          </span>
          <LanguageButton active={language === "ne"} onClick={() => setLanguage("ne")}>
            <span lang="ne">नेपाली</span>
          </LanguageButton>
        </div>
      </nav>
      <Rule />
    </header>
  );
}

function EditionLine({ language }: { language: Language }) {
  const t = labels[language];
  const now = new Date();
  return (
    <div className="font-sans text-[0.68rem] uppercase leading-5 tracking-[0.14em] text-muted lg:text-right">
      <p>
        <span className="font-semibold text-ink">{t.edition}</span> <span aria-hidden="true">·</span>{" "}
        {formatEditionDate(now, language)}
      </p>
      <p>{fillTemplate(t.dayOf, { n: formatNumber(responseDay(now), language) })}</p>
      <LiveStatusBadge language={language} className="mt-1 justify-center lg:justify-end" />
    </div>
  );
}

function LanguageButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 min-w-11 border-b-2 px-1 transition-colors ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      } ${focusRing}`}
    >
      {children}
    </button>
  );
}

export function EmergencyLine({ language }: { language: Language }) {
  const t = labels[language];
  const numbers: Array<[string, string]> = [
    ["1234", t.neocShort],
    ["100", t.policeShort],
    ["102", t.ambulanceShort],
  ];

  return (
    <aside aria-label={t.emergencyStripLabel} className={shell}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-0 border-b border-rule font-sans text-[0.72rem] uppercase tracking-[0.14em]">
        <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-red">
          <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" />
          {t.emergencyLabel}
        </span>
        {numbers.map(([number, label]) => (
          <a key={number} href={`tel:${number}`} className={`inline-flex min-h-11 items-center gap-1.5 text-ink ${focusRing}`}>
            <span className="font-semibold tabular-nums">{number}</span>
            <span className="normal-case tracking-normal text-muted">{label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}

export function Footer({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const link = `underline decoration-rule underline-offset-4 hover:decoration-ink ${focusRing}`;

  return (
    <footer className={`${shell} pb-10`}>
      <Rule variant="double" />
      <div className="grid gap-8 py-8 font-serif text-sm leading-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <p className="max-w-md text-ink">
          <span className="font-display text-base font-bold">verifiedNepal</span> — {t.aboutBody}
        </p>
        <div className="font-sans text-[0.72rem] uppercase leading-6 tracking-[0.14em] text-muted">
          <p className="font-semibold text-ink">{t.source}</p>
          <p className="normal-case tracking-normal">{t.sourceName}</p>
          <p className="normal-case tracking-normal">
            {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
          </p>
          <LiveStatusBadge language={language} className="mt-1" />
        </div>
        <div className="font-sans text-[0.72rem] uppercase leading-6 tracking-[0.14em] text-muted">
          <p className="font-semibold text-ink">{t.contactsTitle}</p>
          <a className={`block ${link}`} href="https://ndrrma.gov.np" target="_blank" rel="noopener noreferrer">
            NDRRMA <span aria-hidden="true">↗</span>
          </a>
          <a className={`block ${link}`} href={pmoAppealUrl} target="_blank" rel="noopener noreferrer">
            {t.donateTitle} <span aria-hidden="true">↗</span>
          </a>
          <a className={`block ${link}`} href={githubUrl} target="_blank" rel="noopener noreferrer">
            {t.contributeLink} <span aria-hidden="true">↗</span>
          </a>
          <a className={`block ${link}`} href="mailto:verifiednepal01@gmail.com">
            {t.contactUs}: verifiednepal01@gmail.com
          </a>
          <button type="button" onClick={() => navigate("privacy")} className={`block ${link}`}>
            {t.privacyTitle}
          </button>
        </div>
      </div>
      <Rule />
      <div className="flex flex-col gap-2 pt-4 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t.unofficial} <span aria-hidden="true">·</span> {t.poweredBy}{" "}
          <a href={onlyUtilsUrl} target="_blank" rel="noopener noreferrer" className={`text-ink ${link}`}>
            OnlyUtils
          </a>
        </p>
        <p>{t.setIn}</p>
      </div>
    </footer>
  );
}
```

`contributeCta` is intentionally dropped from the footer (the link label carries it); it is deleted from i18n in Task 8.

- [ ] **Step 3: Compose the shell in `src/App.tsx`**

Replace the import line `import { EmergencyStrip, Footer, Header } from "./layout";` with `import { EmergencyLine, Footer, Masthead } from "./layout";` and replace the returned JSX with:

```tsx
    <LiveDataProvider>
      <div className="min-h-dvh bg-paper font-serif text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          Skip to main content
        </a>
        <Masthead page={page} language={language} setLanguage={setLanguage} navigate={navigate} />
        <EmergencyLine language={language} />
        <main id="main" className="mx-auto w-full max-w-[80rem] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          {page === "dashboard" ? <Dashboard language={language} /> : null}
          {page === "search" ? <FindPerson language={language} /> : null}
          {page === "info" ? <InfoHelp language={language} /> : null}
          {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
        </main>
        <Footer language={language} navigate={navigate} />
      </div>
    </LiveDataProvider>
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm build`. Then in the browser at 1280px: masthead shows districts left, wordmark centre with Devanagari line beneath, edition/day/live right; double rule; nav row; emergency line on `/`, `/search`, `/info`, `/privacy`. At 390px: districts hidden, wordmark ~2.4rem, no horizontal page scroll (nav scrolls inside itself). Toggle `नेपाली`: wordmark line and nav render in Devanagari serif/sans, not system fallback.

- [ ] **Step 5: Commit**

```bash
git add src/layout.tsx src/App.tsx src/live.ts
git commit -m "feat(redesign): masthead, nav, emergency line and colophon"
```

---

### Task 4: Map plate and district filter

**Files:**
- Modify: `src/region.tsx` (add `DistrictFilter`; restyle `RegionSelect`)
- Modify: `src/relief-map.tsx` (rewrite render of `ReliefMap` and `AffectedLocations`; pins/colours)
- Modify: `src/styles.css` (Leaflet block)

**Interfaces:**
- Consumes: `SectionLabel`, `SquareButton`, `Byline`, `Rule` (Task 1).
- Produces: `DistrictFilter({ language, value, onChange })` in `src/region.tsx`. `ReliefMap` and `AffectedLocations` keep their existing prop signatures.

- [ ] **Step 1: `DistrictFilter` + `RegionSelect` restyle in `src/region.tsx`**

Add after `regionOptions`:

```tsx
export function DistrictFilter({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (region: string) => void;
}) {
  const t = labels[language];
  const options: Array<[string, string]> = [
    ["", t.allAreas],
    ...regionOptions.map((district) => [district, districtLabels[district][language]] as [string, string]),
  ];
  return (
    <div role="group" aria-label={t.whichArea} className="flex flex-wrap gap-x-5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em]">
      {options.map(([option, label]) => (
        <button
          key={option || "all"}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-11 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
            value === option ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

In `RegionSelect`, replace the `<span>` and `<select>` classNames:
- span: `compact ? "sr-only" : "block font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted"`
- select: `` `min-h-11 w-full border border-ink bg-white px-3 font-sans text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${compact ? "" : "mt-2"}` ``

- [ ] **Step 2: Rewrite the render of `ReliefMap` in `src/relief-map.tsx`**

Change imports: drop `MapPin` and `Panel, SourceCaption`; add `import { Byline, Rule, SectionLabel, SquareButton } from "./ui";` and `import { DistrictFilter, locationMatchesRegion, RegionSelect } from "./region";`.

Replace `makeIcon`'s colour line with `const color = kind === "rescue" ? "#A20D2B" : "#16130F";`.

Replace everything `ReliefMap` returns (from `return (` to the closing `);`) with:

```tsx
  return (
    <figure aria-labelledby="map-heading" className="m-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel id="map-heading" className="flex-1 border-b-0 pb-0">
          {t.reliefMap}
        </SectionLabel>
        <div className="hidden sm:block">
          <DistrictFilter language={language} value={region} onChange={onRegionChange} />
        </div>
        <div className="w-full sm:hidden">
          <RegionSelect language={language} value={region} onChange={onRegionChange} compact />
        </div>
        {selected !== null ? (
          <SquareButton onClick={() => onSelect(null)}>{t.clearSelection}</SquareButton>
        ) : null}
      </div>
      <Rule className="mt-2" />
      <div className="relative mt-4 h-[20rem] overflow-hidden border border-ink bg-paper lg:h-[30rem]">
        <MapContainer
          center={center}
          zoom={zoom}
          dragging={mapUnlocked}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          />
          <MapFocus selectedCenter={selectedPlace ? [selectedPlace.lat, selectedPlace.lng] : null} />
          <MapDragging enabled={mapUnlocked} />

          {activeDistricts.map((district) => {
            const isActive = selectedPlace?.district === district;
            return districtShapes[district]?.map((ring, index) => (
              <Polygon
                key={`${district}-${index}`}
                positions={ring}
                pathOptions={{
                  color: isActive ? "#A20D2B" : "#F4EFE6",
                  weight: isActive ? 3 : 1,
                  opacity: isActive ? 1 : 0.6,
                  fillColor: "#16130F",
                  fillOpacity: isActive ? 0 : selectedPlace ? 0.45 : 0.18,
                }}
              >
                <Tooltip sticky>{districtLabels[district][language]}</Tooltip>
              </Polygon>
            ));
          })}

          <Polyline positions={riverPath} pathOptions={{ color: "#16130F", weight: 9, opacity: 0.25 }} />
          <Polyline positions={riverPath} pathOptions={{ color: "#F4EFE6", weight: 3, opacity: 0.95 }}>
            <Tooltip sticky>{t.riverLabel}</Tooltip>
          </Polyline>

          {camps.map((camp) => {
            const [lng, lat] = camp.centroid.coordinates;
            return (
              <Marker key={`camp-${camp.id}`} position={[lat, lng]} icon={makeIcon("camp", false)}>
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="font-semibold">{textForLanguage(camp, language)}</span>
                  <br />
                  <span className="text-[0.7rem] uppercase tracking-wide">{t.reliefCamps}</span>
                </Tooltip>
              </Marker>
            );
          })}

          {placed.map((place) => {
            const active = place.location.id === selected;
            const approximate = place.approximate ? ` (${t.approximate})` : "";
            return (
              <Marker
                key={`rescue-${place.location.id}`}
                position={[place.lat, place.lng]}
                icon={makeIcon("rescue", active)}
                zIndexOffset={active ? 1000 : 0}
                eventHandlers={{ click: () => onSelect(active ? null : place.location.id) }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="font-semibold">
                    {textForLanguage(place.location, language)}
                    {approximate}
                  </span>
                  <br />
                  <span className="text-[0.7rem] uppercase tracking-wide">
                    {districtLabels[place.district][language]} {t.district}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
        {!mapUnlocked ? (
          <SquareButton
            tone="primary"
            onClick={() => setMapUnlocked(true)}
            className="absolute inset-x-4 top-4 z-[500] mx-auto max-w-xs"
          >
            {t.tapToExploreMap}
          </SquareButton>
        ) : (
          <SquareButton onClick={() => setMapUnlocked(false)} className="absolute right-3 top-3 z-[500] bg-paper">
            {t.collapseMap}
          </SquareButton>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-sans text-[0.72rem] leading-5 text-muted">
        <span className="font-serif text-sm italic text-ink">{t.mapPlateCaption}</span>
        <LegendDot color="#A20D2B">{t.rescuePoints}</LegendDot>
        <LegendDot color="#16130F">{t.reliefCamps}</LegendDot>
        <LegendDot color="#F4EFE6" outlined>
          {t.riverLabel}
        </LegendDot>
        <span className="basis-full">{t.mapCredit}</span>
      </figcaption>
      <Byline language={language} className="mt-1" />
    </figure>
  );
```

The outer element must be `<figure aria-labelledby="map-heading" className="m-0">` (not `<section>`) so the `figcaption` is valid; substitute it in the block above.

Update `LegendDot`:

```tsx
function LegendDot({ color, outlined = false, children }: { color: string; outlined?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${outlined ? "border border-ink" : ""}`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Rewrite the render of `AffectedLocations`**

Replace everything it returns with a ruled list (no panel, no icons):

```tsx
  return (
    <section aria-labelledby="locations-heading" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel id="locations-heading" className="flex-1">
          {t.affectedDistricts}
        </SectionLabel>
        <span className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          {formatNumber(mappedCount, language)}/{formatNumber(filteredRescueLocations.length, language)}{" "}
          {t.locationsMapped}
        </span>
      </div>
      <p className="mt-3 font-serif text-sm italic text-muted">{t.mapHint}</p>
      <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
        {nearbyCamps.length ? (
          <div>
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-red">{t.reliefCamps}</p>
            <ul className="mt-1 divide-y divide-rule border-y border-rule">
              {nearbyCamps.map((camp) => (
                <li key={`nearby-camp-${camp.id}`} className="flex min-h-11 items-center justify-between gap-3 font-sans text-sm text-ink">
                  <span className="truncate">{textForLanguage(camp, language)}</span>
                  <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted">{t.nearYou}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {groups.map(([district, locations]) => (
          <div key={district}>
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
              {district === "other" ? t.unavailable : districtLabels[district][language]}
            </p>
            <ul className="mt-1 divide-y divide-rule border-y border-rule">
              {locations.map((location) => {
                const place = placeLocation(location);
                const active = location.id === selected;
                const approximate = place?.approximate ? ` (${t.approximate})` : "";
                return (
                  <li key={location.id}>
                    <button
                      type="button"
                      disabled={!place}
                      onClick={() => onSelect(active ? null : location.id)}
                      aria-pressed={active}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 text-left font-sans text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red ${
                        active ? "font-semibold text-red" : place ? "text-ink hover:text-red" : "cursor-not-allowed text-muted"
                      }`}
                    >
                      <span className="truncate">
                        {textForLanguage(location, language)}
                        {approximate}
                      </span>
                      {!place ? (
                        <span className="shrink-0 text-[0.65rem] uppercase tracking-wide">{t.notMapped}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
```

- [ ] **Step 4: Leaflet CSS**

Replace the Leaflet block in `src/styles.css` (from `/* --- Leaflet --- */` to just before the `@media (prefers-reduced-motion` rule) with:

```css
/* --- Leaflet ------------------------------------------------------------ */

.leaflet-container {
  font-family: "IBM Plex Sans", "Noto Sans Devanagari", system-ui, sans-serif;
  background: #f4efe6;
}

/* The printed-plate look: satellite imagery in warm monochrome. */
.leaflet-tile-pane {
  filter: grayscale(1) sepia(0.15) contrast(1.05);
}

.leaflet-control-attribution {
  background: rgba(244, 239, 230, 0.85) !important;
  color: #6b655c !important;
  font-size: 10px;
}

.leaflet-control-attribution a {
  color: #16130f !important;
}

.leaflet-bar {
  border: 1px solid #16130f !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.leaflet-bar a {
  background: #ffffff;
  color: #16130f;
  border-bottom-color: #d9d2c5;
  border-radius: 0 !important;
}

.leaflet-bar a:hover {
  background: #f4efe6;
}

.leaflet-tooltip {
  background: #f4efe6;
  border: 1px solid #16130f;
  border-radius: 0;
  color: #16130f;
  box-shadow: none;
  padding: 6px 9px;
}

.leaflet-tooltip-top::before {
  border-top-color: #16130f;
}

.vn-pin {
  background: none;
  border: 0;
  filter: drop-shadow(0 1px 2px rgba(22, 19, 15, 0.5));
}

.vn-pin--active {
  filter: drop-shadow(0 0 0 1.5px #f4efe6) drop-shadow(0 2px 4px rgba(22, 19, 15, 0.6));
}
```

(The `vn-pin-drop` keyframes and the `transition: filter` are removed.)

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm build`. In the browser: `/` still renders (dashboard layout is old, but the map area now shows the monochrome plate, text district filter at ≥640px, `<select>` below that width); pins red/ink; tooltips on paper; "Show all" appears after clicking a pin.

- [ ] **Step 6: Commit**

```bash
git add src/region.tsx src/relief-map.tsx src/styles.css
git commit -m "feat(redesign): monochrome map plate and district filter"
```

---

### Task 5: Front page

**Files:**
- Modify: `src/dashboard.tsx` (rewrite)

**Interfaces:**
- Consumes: all primitives (Task 1); `leadHeadline` (Task 2); `ReliefMap`, `AffectedLocations` (Task 4); `openChatWidget`; `useLiveData`; `helplines`; URLs from `src/urls.ts`.
- Produces: `Dashboard({ language })`, and exports `EmergencyContacts({ language })` and `PublicNotice({ language })` reused by Task 7.
- Produces `sessionStorage` key `vn:search-prefill` consumed by Task 6.

- [ ] **Step 1: Rewrite `src/dashboard.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { openChatWidget } from "./chat-widget";
import { data } from "./data";
import { leadHeadline } from "./edition";
import { helplines } from "./helplines";
import { labels, textForLanguage } from "./i18n";
import { useLiveData } from "./live";
import { AffectedLocations, ReliefMap } from "./relief-map";
import type { Language, OpmcmGovernmentEffort, OpmcmStats, Page } from "./types";
import { Byline, Headline, Rule, RuledTable, SectionLabel, SquareButton, Standfirst } from "./ui";
import { opmcmAskHelpUrl, opmcmMissingPersonUrl, opmcmUpdatesUrl, pmdrfUrl, pmoAppealUrl } from "./urls";
import { formatDateTime, formatNumber, messageText, sentenceCase } from "./utils";

export function Dashboard({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const [region, setRegion] = useRegion();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-10">
      <Lead language={language} navigate={navigate} />
      <div>
        <ReliefMap language={language} selected={selected} onSelect={setSelected} region={region} onRegionChange={setRegion} />
        <AffectedLocations language={language} selected={selected} onSelect={setSelected} region={region} />
      </div>
      <Rule />
      <ThreeColumns language={language} navigate={navigate} />
      <Rule />
      <EmergencyContacts language={language} />
      <PublicNotice language={language} />
      <TablesRow language={language} />
      <Rule />
      <AskTheDesk language={language} />
    </div>
  );
}

function useRegion() {
  const [region, setRegionState] = useState(() => localStorage.getItem("vn:region") || "");
  const setRegion = useCallback((nextRegion: string) => setRegionState(nextRegion), []);

  useEffect(() => {
    if (region) {
      localStorage.setItem("vn:region", region);
    } else {
      localStorage.removeItem("vn:region");
    }
    window.__vnRegion = region;
    window.dispatchEvent(new CustomEvent("vn:region-change", { detail: { region } }));
  }, [region]);

  return [region, setRegion] as const;
}

function Lead({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const liveData = useLiveData();
  const rescued = formatNumber(liveData.rescuedStatistics.rescued_count, language);
  const verified = formatNumber(liveData.statusCounts.total_count, language);
  const missing = liveData.missingCount === null ? null : formatNumber(liveData.missingCount, language);
  const messages = liveData.messages.map((message) => messageText(message, language)).filter(Boolean);
  const number = (value: number | null | undefined) =>
    value === null || value === undefined ? t.unavailable : formatNumber(value, language);

  return (
    <section className="grid gap-8 lg:grid-cols-[7fr_5fr] lg:gap-0" aria-labelledby="lead-heading">
      <div className="lg:border-r lg:border-rule lg:pr-10">
        <SectionLabel as="p" dot>
          {t.officialFigures}
        </SectionLabel>
        <Headline level={1} id="lead-heading" className="mt-5">
          {leadHeadline(t, rescued, missing)}
        </Headline>
        <Byline language={language} className="mt-4" />
        <Standfirst className="mt-4 max-w-2xl">
          {t.rescuedVerifiedCopy.replace("{rescued}", rescued).replace("{verified}", verified)}
        </Standfirst>
        {messages.length ? (
          <div className="mt-6 border-l border-ink pl-4 font-serif text-[0.95rem] leading-7 text-ink">
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {t.officialMessages}
            </p>
            {messages.map((message, index) => (
              <p key={`${message}-${index}`} className="mt-1">
                {message}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="lg:pl-10">
        <SectionLabel as="p">{t.byTheNumbers}</SectionLabel>
        <RuledTable
          caption={t.byTheNumbers}
          className="mt-1"
          rows={[
            { key: "rescued", label: t.rescuedStatus, value: rescued },
            { key: "missing", label: t.missing, value: missing ?? t.unavailable, red: true },
            { key: "reach", label: t.outOfReach, value: number(liveData.rescuedStatistics.out_of_reach) },
            { key: "force", label: t.forceDeployed, value: number(liveData.rescuedStatistics.force_deployed) },
            { key: "verified", label: t.verifiedRecords, value: verified },
          ]}
        />
        <p className="mt-2 font-sans text-[0.68rem] text-muted">{t.floodDate}</p>
        <div className="mt-6 grid gap-3">
          <SquareButton href={pmdrfUrl} tone="red" external className="w-full">
            {t.donateLeadCta}
          </SquareButton>
          <SquareButton onClick={() => navigate("search")} className="w-full">
            {t.search}
          </SquareButton>
        </div>
      </div>
    </section>
  );
}

function ThreeColumns({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const { officialUpdates, opmcmStats, opmcmUpdatedAt } = useLiveData();
  const showHelp = opmcmStats !== null;
  const showUpdates = officialUpdates !== null && officialUpdates.length > 0;
  const columns = 1 + (showHelp ? 1 : 0) + (showUpdates ? 1 : 0);
  const grid = columns === 3 ? "lg:grid-cols-3" : columns === 2 ? "lg:grid-cols-2" : "";

  return (
    <div className={`grid gap-10 lg:gap-0 ${grid} lg:divide-x lg:divide-rule`}>
      <div className="lg:pr-8">
        <MissingPersonsColumn language={language} navigate={navigate} />
      </div>
      {showHelp ? (
        <div className="lg:px-8">
          <HelpRequestsColumn language={language} stats={opmcmStats} updatedAt={opmcmUpdatedAt} />
        </div>
      ) : null}
      {showUpdates ? (
        <div className="lg:pl-8">
          <UpdatesColumn language={language} updates={officialUpdates} updatedAt={opmcmUpdatedAt} />
        </div>
      ) : null}
    </div>
  );
}

function MissingPersonsColumn({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const [query, setQuery] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) sessionStorage.setItem("vn:search-prefill", query.trim());
    navigate("search");
  };

  return (
    <section aria-labelledby="missing-heading">
      <SectionLabel id="missing-heading">{t.missingPersonsLabel}</SectionLabel>
      <Headline level={3} as="p" className="mt-4">
        {t.searchLead}
      </Headline>
      <form onSubmit={submit} className="mt-4 flex border border-ink bg-white">
        <label htmlFor="front-search" className="sr-only">
          {t.nameLabel}
        </label>
        <input
          id="front-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          className="min-h-11 w-full min-w-0 border-0 bg-transparent px-3 font-serif text-base text-ink outline-none placeholder:text-muted"
        />
        <SquareButton type="submit" tone="primary" className="shrink-0 border-0">
          {t.searchButton}
        </SquareButton>
      </form>
      <p className="mt-3 font-serif text-sm italic text-muted">{t.absenceNote}</p>
      <SquareButton href={opmcmMissingPersonUrl} external className="mt-4">
        {t.reportMissingPerson}
      </SquareButton>
    </section>
  );
}

function HelpRequestsColumn({
  language,
  stats,
  updatedAt,
}: {
  language: Language;
  stats: OpmcmStats;
  updatedAt: string | null;
}) {
  const t = labels[language];
  return (
    <section aria-labelledby="help-heading">
      <SectionLabel id="help-heading">{t.helpRequestsOpmcm}</SectionLabel>
      <RuledTable
        caption={t.helpRequests}
        className="mt-1"
        rows={[
          { key: "open", label: sentenceCase(t.open), value: formatNumber(stats.requests.open, language) },
          { key: "critical", label: sentenceCase(t.critical), value: formatNumber(stats.requests.critical, language), red: true },
          { key: "progress", label: sentenceCase(t.inProgress), value: formatNumber(stats.requests.inProgress, language) },
          { key: "resolved", label: sentenceCase(t.resolved), value: formatNumber(stats.requests.resolved, language) },
          { key: "offers", label: t.helpOffersAvailable, value: formatNumber(stats.offers.available, language) },
        ]}
      />
      <Byline language={language} source="OPMCM" updatedAt={updatedAt} className="mt-2" />
      <SquareButton href={opmcmAskHelpUrl} external className="mt-4">
        {t.askForHelp}
      </SquareButton>
    </section>
  );
}

function UpdatesColumn({
  language,
  updates,
  updatedAt,
}: {
  language: Language;
  updates: OpmcmGovernmentEffort[];
  updatedAt: string | null;
}) {
  const t = labels[language];
  return (
    <section aria-labelledby="updates-heading">
      <SectionLabel id="updates-heading">{t.officialUpdatesPanel}</SectionLabel>
      <ul className="divide-y divide-rule">
        {updates.slice(0, 3).map((item) => {
          const date = officialUpdateDate(item, language);
          return (
            <li key={item._id}>
              <a
                href={opmcmUpdatesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
              >
                <Headline level={3} as="p" className="hover:text-red">
                  {officialUpdateTitle(item, language)}
                </Headline>
                {date ? <p className="mt-1 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">{date}</p> : null}
              </a>
            </li>
          );
        })}
      </ul>
      <Byline language={language} source="OPMCM" updatedAt={updatedAt} className="mt-2" />
      <a
        href={opmcmUpdatesUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        OPMCM <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}

export function EmergencyContacts({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <section aria-labelledby="emergency-heading">
      <SectionLabel id="emergency-heading" dot>
        {t.emergencyContactsTitle}
      </SectionLabel>
      <p className="mt-3 font-serif text-sm italic text-muted">{t.emergencyContactsBody}</p>
      <ul className="mt-3 grid gap-x-10 sm:grid-cols-2">
        {helplines.map((helpline) => (
          <li key={helpline.key} className="border-b border-rule">
            <a
              href={`tel:${helpline.number}`}
              className="flex min-h-12 items-center justify-between gap-4 py-2 font-sans text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
            >
              <span>{language === "ne" ? helpline.labelNe : helpline.labelEn}</span>
              <span className="text-lg font-semibold tabular-nums text-red">{helpline.number}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PublicNotice({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <section aria-labelledby="notice-heading" className="border border-ink bg-white p-1">
      <div className="grid gap-6 border border-ink p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
        <div>
          <SectionLabel id="notice-heading" as="p">
            {t.publicNotice}
          </SectionLabel>
          <Headline level={2} className="mt-4">
            {t.donateTitle}
          </Headline>
          <p className="mt-3 max-w-2xl font-serif leading-7 text-ink">{t.donateBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <SquareButton href={pmdrfUrl} tone="red" external>
              {t.donateCta}
            </SquareButton>
            <SquareButton href={pmoAppealUrl} external>
              {t.donateVerify}
            </SquareButton>
          </div>
          <p className="mt-5 max-w-2xl font-serif text-sm italic leading-6 text-muted">{t.donateWarning}</p>
        </div>
        <figure className="mx-auto m-0 w-fit text-center">
          <img src="/brand/pmdrf-qr.svg" alt={`QR code linking to ${pmdrfUrl}`} className="h-40 w-40" width={160} height={160} />
          <figcaption className="mt-2 max-w-[10rem] font-sans text-[0.68rem] leading-5 text-muted">
            {t.donateScan}
            <span className="mt-1 block font-mono text-[0.65rem] text-ink">pmdrf.nchl.com.np</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function TablesRow({ language }: { language: Language }) {
  const t = labels[language];
  const { statusCounts } = useLiveData();
  const total = Math.max(statusCounts.total_count, 1);
  const countryCounts = useMemo(
    () => data.countryCounts.map((entry) => [sentenceCase(entry.country) || t.unavailable, entry.count] as const),
    [t.unavailable],
  );
  const maxCountry = Math.max(...countryCounts.map(([, count]) => count), 1);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-rule">
      <section aria-labelledby="status-heading" className="lg:pr-8">
        <SectionLabel id="status-heading">{t.statusOfRecords}</SectionLabel>
        <RuledTable
          caption={t.statusOfRecords}
          className="mt-1"
          rows={statusCounts.status_counts.map((status, index) => ({
            key: String(status.id),
            label: textForLanguage(status, language),
            value: (
              <>
                {formatNumber(status.count, language)}
                <span className="ml-2 font-normal text-muted">{((status.count / total) * 100).toFixed(1)}%</span>
              </>
            ),
            bar: status.count / total,
            red: index === 0,
          }))}
        />
        <Byline language={language} className="mt-2" />
      </section>
      <section aria-labelledby="nationality-heading" className="lg:pl-8">
        <SectionLabel id="nationality-heading">{t.byNationality}</SectionLabel>
        <p className="mt-3 font-serif text-sm italic text-muted">{t.nationalityHelp}</p>
        <div className="mt-1 max-h-[18rem] overflow-auto pr-2">
          <RuledTable
            caption={t.byNationality}
            rows={countryCounts.map(([country, count], index) => ({
              key: country,
              label: country,
              value: formatNumber(count, language),
              bar: count / maxCountry,
              red: index === 0,
            }))}
          />
        </div>
        <Byline language={language} className="mt-2" />
      </section>
    </div>
  );
}

function AskTheDesk({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <section aria-labelledby="desk-heading" className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <SectionLabel id="desk-heading" as="p" className="border-b-0 pb-0">
        {t.askTheDesk}
      </SectionLabel>
      <p className="font-serif text-sm text-muted">
        <span className="font-semibold text-ink">{t.agentTitle}</span> {t.agentBody}
      </p>
      <SquareButton onClick={openChatWidget}>{t.agentCta}</SquareButton>
    </section>
  );
}

function officialUpdateTitle(item: OpmcmGovernmentEffort, language: Language) {
  if (language === "ne") {
    return item.title || item.title_en || item.titleEn || item.englishTitle || item.titleEnglish || "";
  }
  return item.title_en || item.titleEn || item.englishTitle || item.titleEnglish || item.title || "";
}

function officialUpdateDate(item: OpmcmGovernmentEffort, language: Language) {
  const value = item.updatedAt || item.createdAt;
  if (!value) return "";
  return formatDateTime(value, language);
}
```

`Dashboard` now takes `navigate`; update `src/App.tsx` to `<Dashboard language={language} navigate={navigate} />`.

`DonateCta` is gone; `src/info-help.tsx` still imports it — until Task 7, change that import line to `import { EmergencyContacts, PublicNotice } from "./dashboard";` and its `<DonateCta language={language} />` to `<PublicNotice language={language} />` so the build stays green.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm build`. Browser, 1280px `/`: lead headline sentence with live numbers, numbers table right with red Missing label, red DONATE button then FIND A PERSON; map plate; three ruled columns; contacts list; double-bordered public notice; two tables; ask-the-desk line. 390px: single column in that order, no horizontal scroll, the inline search form does not overflow (input `min-w-0`). Type a name in the front-page search and submit: lands on `/search` (prefill wiring completes in Task 6). Switch to `नेपाली` and confirm the headline sentence reads correctly with Devanagari numerals.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.tsx src/App.tsx src/info-help.tsx
git commit -m "feat(redesign): editorial front page"
```

---

### Task 6: Find a person

**Files:**
- Modify: `src/find-person.tsx` (rewrite render; keep the fetch/search logic in lines 23–107 unchanged)

**Interfaces:**
- Consumes: primitives (Task 1); `vn:search-prefill` (Task 5).
- Produces: nothing new.

- [ ] **Step 1: Prefill from the front page**

Change the `query` state initialiser to:

```tsx
  const [query, setQuery] = useState(() => {
    const prefill = sessionStorage.getItem("vn:search-prefill") ?? "";
    sessionStorage.removeItem("vn:search-prefill");
    return prefill;
  });
```

- [ ] **Step 2: Replace the render**

Update imports: remove `ExternalLink, Search` from lucide and `Kicker`; remove `statusTone` from the utils import; add `import { Byline, Headline, Rule, SectionLabel, SquareButton, Standfirst, StatusMark } from "./ui";`.

Replace everything from `return (` in `FindPerson` to the end of the file with:

```tsx
  return (
    <div className="space-y-8">
      <section aria-labelledby="search-heading">
        <SectionLabel as="p">{t.missingPersonsLabel}</SectionLabel>
        <Headline level={2} id="search-heading" className="mt-4">
          {t.searchTitle}
        </Headline>
        <Standfirst className="mt-3 max-w-2xl">{t.searchIntro}</Standfirst>
        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-10">
          <div>
            <label htmlFor="person-search" className="block font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink">
              {t.searchLabel}
            </label>
            <input
              id="person-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              autoComplete="off"
              className="mt-2 min-h-12 w-full border border-rule border-b-ink bg-white px-3 font-serif text-lg text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            />
            <p className="mt-2 font-sans text-xs text-muted">{t.searchLanguageHint}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-serif text-sm text-muted">{t.reportMissingPersonHint}</span>
              <SquareButton href={opmcmMissingPersonUrl} external>
                {t.reportMissingPerson}
              </SquareButton>
            </div>
          </div>
          <DisclaimerBlock language={language} disclaimers={disclaimers} />
        </div>
      </section>

      <Rule />

      <section aria-live="polite" className="space-y-6">
        {!searched ? (
          <p className="font-serif leading-7 text-muted">{t.noSearch}</p>
        ) : (
          <>
            {rescuedLoading ? <p className="font-sans text-sm text-muted">{t.loadingVerifiedRecords}</p> : null}
            {missingLoading ? <p className="font-sans text-sm text-muted">{t.loadingMissingRecords}</p> : null}
            {results.length > 0 ? (
              <>
                <p className="font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted">
                  {formatNumber(results.length, language)} {t.results}
                </p>
                <div className="divide-y divide-rule border-y border-rule">
                  {results.map((result) => (
                    <PersonEntry key={`${result.kind}-${result.person.id}`} result={result} language={language} />
                  ))}
                </div>
              </>
            ) : !anyLoading ? (
              <p className="font-serif leading-7 text-muted">{t.noMatch}</p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function DisclaimerBlock({ language, disclaimers }: { language: Language; disclaimers: string[] }) {
  const t = labels[language];
  const fallback =
    language === "ne"
      ? "यो सूचना NDRRMA को सार्वजनिक तथ्यांकबाट लिइएको हो। कृपया आधिकारिक पेजमा पुष्टि गर्नुहोस्।"
      : "This information mirrors NDRRMA public data. Please verify details on the official page.";

  return (
    <aside className="border-l border-ink pl-4 font-serif text-sm leading-6 text-muted">
      <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-red">{t.officialDisclaimer}</p>
      <p className="mt-2 text-ink">{t.absenceNote}</p>
      {(disclaimers.length ? disclaimers : [fallback]).map((disclaimer, index) => (
        <p key={`${disclaimer}-${index}`} className="mt-2">
          {disclaimer}
        </p>
      ))}
    </aside>
  );
}

function PersonEntry({ result, language }: { result: PersonSearchResult; language: Language }) {
  const t = labels[language];
  const { person, kind } = result;
  const status = person.status;
  const isMissing = kind === "missing";
  const isRescued = kind === "rescued" && status?.id === 4;
  const statusLabel = isMissing ? t.missing : isRescued ? t.rescuedStatus : status ? textForLanguage(status, language) : t.unavailable;
  const tone = isMissing ? "missing" : isRescued ? "verified" : status ? "pending" : "neutral";

  return (
    <article className="grid gap-4 py-6 lg:grid-cols-[2fr_3fr] lg:gap-10">
      <div>
        <div className="flex items-start justify-between gap-4 lg:flex-col lg:gap-2">
          <Headline level={3} as="h2">
            {person.name_ne || person.name || person.display_name}
          </Headline>
          <StatusMark tone={tone}>{statusLabel}</StatusMark>
        </div>
        {person.name && person.name_ne ? <p className="mt-1 font-serif text-muted">{person.name}</p> : null}
        <div className="mt-4 hidden lg:block">
          <Byline language={language} updatedAt={data.meta.synced_at} />
          <a
            href={officialRescueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {t.verifyOfficial} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <RecordField label={t.age} value={person.age === null ? null : formatNumber(person.age, language)} unavailable={t.unavailable} />
        <RecordField label={t.gender} value={sentenceCase(person.gender)} unavailable={t.unavailable} />
        <RecordField label={t.nationality} value={sentenceCase(person.country || person.nationality)} unavailable={t.unavailable} />
        {kind === "rescued" ? (
          <>
            <RecordField label={t.rescuedDate} value={person.rescued_date} unavailable={t.unavailable} />
            <RecordField label={t.rescuedLocation} value={locationValue(person.rescued_location, language)} unavailable={t.unavailable} />
            <RecordField label={t.stationedLocation} value={locationValue(person.stationed_location, language)} unavailable={t.unavailable} />
          </>
        ) : (
          <>
            <RecordField label={t.lastContact} value={person.last_contact} unavailable={t.unavailable} />
            <RecordField label={t.reportedAt} value={person.reported_at} unavailable={t.unavailable} />
          </>
        )}
        <RecordField label={t.remarks} value={person.remarks} unavailable={t.unavailable} wide />
        <div className="sm:col-span-2 lg:hidden">
          <Byline language={language} updatedAt={data.meta.synced_at} />
          <a
            href={officialRescueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {t.verifyOfficial} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </dl>
    </article>
  );
}

function RecordField({
  label,
  value,
  unavailable,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  unavailable: string;
  wide?: boolean;
}) {
  return (
    <div className={`border-b border-rule pb-2 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="font-sans text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-ink">{value || unavailable}</dd>
    </div>
  );
}

function locationValue(location: PersonRecord["rescued_location"], language: Language) {
  if (!location) return null;
  if (typeof location === "string") return location;
  return textForLanguage(location, language);
}
```

`DisclaimerBlock` is now always rendered (the earlier `{searched ? … : null}` wrapper is gone), and the outer container is no longer `max-w-4xl` — results use the full ruled width.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm build`. Browser `/search`: type `हरि` — results appear as ruled entries with a status mark; Latin name beneath Devanagari where both exist; the disclaimer shows before searching. From `/`, submit `Ram` in the front-page box → `/search` opens with `Ram` already in the field and results loaded. 390px: entry stacks name/status row, then fields.

- [ ] **Step 4: Commit**

```bash
git add src/find-person.tsx
git commit -m "feat(redesign): ruled person search and entries"
```

---

### Task 7: Help & info and Privacy pages

**Files:**
- Modify: `src/info-help.tsx` (rewrite)
- Modify: `src/privacy.tsx:126-154` (render only; policy text unchanged)

**Interfaces:**
- Consumes: `EmergencyContacts`, `PublicNotice` (Task 5); primitives (Task 1); i18n `neSummaryTitle`, `effectiveDate` (Task 2).

- [ ] **Step 1: Rewrite `src/info-help.tsx`**

```tsx
import { data } from "./data";
import { EmergencyContacts, PublicNotice } from "./dashboard";
import { labels } from "./i18n";
import type { Language } from "./types";
import { Headline, Rule, SectionLabel } from "./ui";
import { formatDateTime, officialRescueUrl } from "./utils";

export function InfoHelp({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="mx-auto max-w-[52rem] space-y-10">
      <EmergencyContacts language={language} />
      <PublicNotice language={language} />
      <Rule />
      <TextColumn title={t.aboutTitle}>{t.aboutBody}</TextColumn>
      <TextColumn title={t.dataSourceTitle}>
        {t.dataSourceBody}
        <span className="mt-3 block font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted">
          {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
        </span>
      </TextColumn>
      <Rule />
      <div className="grid gap-10 sm:grid-cols-2">
        <LinkList
          title={t.contactsTitle}
          links={[
            [t.ndrrma, "https://ndrrma.gov.np"],
            [t.moha, "https://moha.gov.np"],
            [t.officialRescue, officialRescueUrl],
          ]}
        />
        <LinkList
          title={t.respondersTitle}
          intro={t.respondersBody}
          links={[
            ["Direct Relief", "https://www.directrelief.org/emergency/nepal/"],
            ["Oxfam", "https://www.oxfam.org/en/nepal"],
            ["CARE", "https://www.care.org/our-work/where-we-work/nepal/"],
            ["UNICEF", "https://www.unicef.org/nepal/"],
          ]}
        />
      </div>
    </div>
  );
}

function TextColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Headline level={3} as="h2">
        {title}
      </Headline>
      <p className="mt-3 max-w-[40rem] font-serif leading-7 text-ink">{children}</p>
    </section>
  );
}

function LinkList({ title, intro, links }: { title: string; intro?: string; links: Array<[string, string]> }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      {intro ? <p className="mt-3 font-serif text-sm italic text-muted">{intro}</p> : null}
      <ul className="mt-1 divide-y divide-rule">
        {links.map(([label, href]) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-between gap-3 font-serif text-ink hover:text-red focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
            >
              {label}
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Restyle `PrivacyPolicy` in `src/privacy.tsx`**

Add `import { Headline, SectionLabel } from "./ui";` and replace the `PrivacyPolicy` function with:

```tsx
export function PrivacyPolicy({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem] lg:gap-16">
      <article>
        <Headline level={2} as="h1">
          {t.privacyTitle}
        </Headline>
        <p className="mt-2 font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted">
          {t.effectiveDate}: {effectiveDate}
        </p>
        <div className="mt-8 max-w-[44rem] space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <Headline level={3} as="h2">
                {section.title}
              </Headline>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 font-serif leading-7 text-ink">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
      <aside lang="ne" className="lg:sticky lg:top-6 lg:self-start">
        <SectionLabel>{t.neSummaryTitle}</SectionLabel>
        <div className="mt-3 space-y-3 border-l border-ink pl-4 font-serif text-sm leading-6 text-ink">
          {nepaliSummary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </aside>
    </div>
  );
}
```

The Nepali summary is now shown in both languages (it is the only Nepali text the policy has; hiding it in `en` mode helped nobody).

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm build`. Browser `/info` and `/privacy` at both widths and both languages; the privacy sidebar sticks on desktop and stacks beneath the article on mobile.

- [ ] **Step 4: Commit**

```bash
git add src/info-help.tsx src/privacy.tsx
git commit -m "feat(redesign): help & info and privacy pages"
```

---

### Task 8: Cleanup, accessibility and weight pass

**Files:**
- Modify: `tailwind.config.ts` (drop `nepal`, `boxShadow`, `backgroundImage`, `letterSpacing`)
- Modify: `src/ui.tsx` (delete `Kicker`, `Panel`, `SourceCaption`, `formatCaptionTime` stays for `Byline`)
- Modify: `src/utils.ts:68-73` (delete `statusTone`)
- Modify: `src/i18n.ts` (delete unused keys)
- Modify: `README.md` "Repository layout" block
- Modify: `package.json` only if `lucide-react` is unused after the pass

- [ ] **Step 1: Delete legacy code**

- `tailwind.config.ts`: remove the `nepal` colour object, `letterSpacing`, `boxShadow`, `backgroundImage`.
- `src/ui.tsx`: delete `Kicker`, `Panel`, `SourceCaption` and the `Home` import.
- `src/utils.ts`: delete `statusTone`.
- `src/i18n.ts`: delete from both dictionaries: `github`, `githubAria`, `livePill`, `officialActions`, `officialGovernmentPortal`, `opmcmCoordination`, `total`, `donateKicker`, `agentKicker`, `emergencyQuestion`, `dismissEmergency`, `contributeCta`, `showAllAreas`, `mapFallback`, `districtLayer`, `nepali`, `foreignNationals`, `statusBreakdown`, `nationalityPanel`, `sourceCaptionSource`.
- Run `grep -rn "nepal-\|shadow-panel\|shadow-lift\|bg-flag\|tracking-display\|lucide-react" src/` — every hit must be removed or justified. If no `lucide-react` import remains, `pnpm remove lucide-react`.

- [ ] **Step 2: Typecheck catches stragglers**

Run: `pnpm typecheck`
Expected: errors only for deleted i18n keys still referenced (fix the reference, or restore the key if it is genuinely used) — iterate until clean. Then `pnpm test && pnpm build`.

- [ ] **Step 3: Accessibility and weight**

With `pnpm dev` running, in Chrome:
1. Lighthouse (mobile) on `/`: Accessibility 100, Performance ≥ 90. Fix any flagged contrast/heading-order/name issues.
2. Network tab, filter `fonts.gstatic.com`, English `/`: sum of transferred font bytes ≤ ~150 KB. If over, drop Playfair 900 (use 700 for the wordmark) and re-measure.
3. Tab through `/` with the keyboard: every control shows the red focus ring; masthead → nav → emergency numbers → lead buttons order is sensible.
4. Toggle `नेपाली` on every page: no system-sans Devanagari (compare against the English wordmark's serif weight; fallback sans is visibly lighter and unhinted).
5. Enable "Emulate CSS prefers-reduced-motion": no behaviour change (nothing animates anyway).

Record results in the commit message body.

- [ ] **Step 4: README**

In `README.md` replace the `src/App.tsx        all pages/components …` line of the layout block with:

```
src/App.tsx        routing shell
src/layout.tsx     masthead, nav, emergency line, footer
src/ui.tsx         editorial primitives (Rule, SectionLabel, Headline, SquareButton, RuledTable, …)
src/edition.ts     edition line helpers (response day, lead headline)
src/dashboard.tsx  front page · src/find-person.tsx · src/info-help.tsx · src/privacy.tsx
src/relief-map.tsx map plate and affected locations
```

and add `pnpm test          # edition helper checks (node --test)` to the local-development block.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(redesign): remove legacy palette and primitives; a11y and weight pass"
```

Then open a PR from `redesign/editorial` — target `main` once PR #1 (the component split) has merged, otherwise target `refactor/split-app-components`. PR body: link the spec, list the seven screenshots (390/1280 × en/ne × front page, plus search and info), and the Lighthouse numbers.
