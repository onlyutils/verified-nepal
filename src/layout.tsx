import { useEffect, useState } from "react";
import { data } from "./data";
import { fillTemplate, formatEditionDate, responseDay } from "./edition";
import { districtLabels } from "./geo";
import { labels } from "./i18n";
import { LiveStatusBadge } from "./live";
import { regionOptions } from "./region";
import type { Language, Page } from "./types";
import { focusRing, Rule, SquareButton } from "./ui";
import { shellStrings } from "./i18n-shell";
import { githubUrl, onlyUtilsUrl, pmoAppealUrl } from "./urls";
import { formatDateTime, formatNumber } from "./utils";

const shell = "mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8";
const navPages = ["search", "getHelp", "giveHelp", "info", "projects", "dispatches", "ledger", "audit"] as const;

export function Masthead({
  page,
  language,
  setLanguage,
  navigate,
  compact = false,
}: {
  page: Page;
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
  /** Slim single-row header for signed-in work surfaces (the Desk) — trades the newspaper masthead for vertical space. */
  compact?: boolean;
}) {
  const t = labels[language];
  const ts = shellStrings[language];
  const districts = regionOptions.map((district) => districtLabels[district][language]).join(" · ");

  if (compact) {
    return (
      <header className={shell}>
        <div className="flex items-center justify-between gap-4 py-3">
          <button type="button" onClick={() => navigate("dashboard")} className={`flex items-center gap-2 ${focusRing}`}>
            <span lang={language === "ne" ? "ne" : "en"} className="font-display text-lg font-black uppercase leading-none tracking-[0.04em] text-ink">
              {language === "ne" ? "भेरिफाइड नेपाल" : "Verified Nepal"}
            </span>
            <span className="hidden font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted sm:inline">{ts.compactBadge}</span>
          </button>
          <a href="tel:1234" className={`min-h-11 inline-flex shrink-0 items-center gap-1.5 font-sans text-sm font-semibold text-red ${focusRing}`}>
            <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" />
            1234
          </a>
        </div>
        <Rule />
        <MastheadNav page={page} navigate={navigate} language={language} setLanguage={setLanguage} compact />
        <Rule />
      </header>
    );
  }

  return (
    <header className={shell}>
      {/* Below lg: one slim row replaces the newspaper masthead. */}
      <div className="flex items-center justify-between gap-2 py-2.5 lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col items-start overflow-hidden font-sans text-[0.6rem] uppercase tracking-[0.1em] text-muted">
          <span className="min-w-0 max-w-full truncate">{districts}</span>
          <button type="button" onClick={() => navigate("desk")} className={`font-semibold text-ink ${focusRing}`}>
            {t.deskTitle}
          </button>
        </div>
        <button type="button" onClick={() => navigate("dashboard")} className={`shrink-0 ${focusRing}`}>
          <span lang={language === "ne" ? "ne" : "en"} className="font-display text-sm font-black uppercase leading-none tracking-[0.03em] text-ink">
            {language === "ne" ? "भेरिफाइड नेपाल" : "Verified Nepal"}
          </span>
        </button>
        <div className="flex min-w-0 flex-1 justify-end overflow-hidden">
          <EditionLine language={language} compact />
        </div>
      </div>

      {/* lg and up: the full newspaper masthead. */}
      <div className="hidden items-center gap-4 py-5 text-left lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 flex-col items-start font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          <span className="min-w-0 max-w-full truncate">
            {districts} <span aria-hidden="true">·</span> {t.floodName}
          </span>
          <button type="button" onClick={() => navigate("desk")} className={`font-semibold text-ink ${focusRing}`}>
            {t.deskTitle}
          </button>
        </div>
        <button type="button" onClick={() => navigate("dashboard")} className={`mx-auto block text-center ${focusRing}`}>
          {language === "ne" ? (
            <>
              <span lang="ne" className="block font-display text-[1.6rem] font-black leading-none text-ink sm:text-[3.2rem] 2xl:text-[4rem]">
                भेरिफाइड नेपाल
              </span>
              <span lang="en" className="mt-2 block font-display text-base uppercase leading-none tracking-[0.06em] text-ink sm:text-lg">
                Verified Nepal
              </span>
            </>
          ) : (
            <>
              <span lang="en" className="block font-display text-[1.75rem] font-black uppercase leading-none tracking-[0.06em] text-ink sm:text-[3.6rem] 2xl:text-[4.5rem]">
                Verified Nepal
              </span>
              <span lang="ne" className="mt-2 block font-display text-lg leading-none text-ink sm:text-xl">
                भेरिफाइड नेपाल
              </span>
            </>
          )}
        </button>
        <EditionLine language={language} />
      </div>
      <Rule variant="double" />
      <MastheadNav page={page} navigate={navigate} language={language} setLanguage={setLanguage} />
      <Rule />
    </header>
  );
}


function MastheadNav({
  page,
  language,
  setLanguage,
  navigate,
  compact = false,
}: {
  page: Page;
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
  /** Skip the built-in desktop language toggle — the compact Masthead's AccessibilityBar already renders one at every width. */
  compact?: boolean;
}) {
  const t = labels[language];
  const navLabel: Record<string, string> = {
    search: t.search,
    getHelp: t.getHelp,
    giveHelp: t.giveHelp,
    info: t.info,
    projects: (t as Record<string, string>).projects ?? "Projects",
    dispatches: (t as Record<string, string>).dispatches ?? "Dispatches",
    ledger: t.ledgerTitle,
    audit: (t as Record<string, string>).navAuditLabel ?? "Audit",
  };
  const navButton = (item: string, label: string) => {
    const active = page === item;
    return (
      <button
        key={item}
        type="button"
        onClick={() => navigate(item as Page)}
        aria-current={active ? "page" : undefined}
        className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 transition-colors ${
          active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
        } ${focusRing}`}
      >
        {label}
      </button>
    );
  };
  return (
    <nav aria-label="Primary navigation" className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-0">
        <div className="flex flex-wrap gap-x-5 gap-y-0">
          {(navPages as readonly string[]).map((item) => navButton(item, navLabel[item] ?? item))}
        </div>
        {compact ? null : (
          <div className="ml-auto hidden lg:block">
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div>
        )}
      </div>
    </nav>
  );
}

function LanguageToggle({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const t = labels[language];
  return (
    <div className="flex shrink-0 items-center gap-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em]" aria-label={t.language}>
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
  );
}

function EditionLine({ language, compact = false }: { language: Language; compact?: boolean }) {
  const t = labels[language];
  const now = new Date();
  const dayOf = fillTemplate(t.dayOf, { n: formatNumber(responseDay(now), language) });

  if (compact) {
    return <LiveStatusBadge language={language} className="min-w-0 shrink truncate text-[0.6rem]" />;
  }

  return (
    <p className="flex flex-wrap items-center justify-end gap-x-1.5 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
      <span className="font-semibold text-ink">{t.edition}</span> <span aria-hidden="true">·</span> {formatEditionDate(now, language)}{" "}
      <span aria-hidden="true">·</span> {dayOf} <span aria-hidden="true">·</span>
      <LiveStatusBadge language={language} />
    </p>
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
            <span className="text-sm font-semibold tabular-nums">{number}</span>
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
    <footer className={`${shell} pb-24`}>
      <Rule variant="double" />
      <div className="grid gap-8 py-8 font-serif text-sm leading-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <p className="max-w-md text-ink">{t.aboutBody}</p>
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
          <a className={`block text-blue ${link}`} href="https://ndrrma.gov.np" target="_blank" rel="noopener noreferrer">
            NDRRMA <span aria-hidden="true">↗</span>
          </a>
          <a className={`block text-blue ${link}`} href={pmoAppealUrl} target="_blank" rel="noopener noreferrer">
            {t.donateTitle} <span aria-hidden="true">↗</span>
          </a>
          <a className={`block ${link}`} href={githubUrl} target="_blank" rel="noopener noreferrer">
            {t.contributeLink} <span aria-hidden="true">↗</span>
          </a>
          <a className={`block ${link}`} href="mailto:verifiednepal01@gmail.com">
            {t.contactUs}: <span className="normal-case tracking-normal">verifiednepal01@gmail.com</span>
          </a>
          <button type="button" onClick={() => navigate("audit")} className={`block ${link}`}>
            {(t as Record<string,string>).footerAuditLink ?? "Audit log"}
          </button>
          <button type="button" onClick={() => navigate("missing")} className={`block ${link}`}>
            {t.missingGuideLink}
          </button>
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

/** Square "back to top" control, shown once the reader is within a screen of the foot of the page. */
export function BackToTop({ language }: { language: Language }) {
  const t = labels[language];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const { scrollY, innerHeight } = window;
      const remaining = document.documentElement.scrollHeight - (scrollY + innerHeight);
      setVisible(scrollY > innerHeight && remaining < innerHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!visible) return null;
  return (
    <SquareButton
      tone="primary"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 left-4 z-40 sm:left-6"
    >
      <span aria-hidden="true">↑</span> {t.backToTop}
    </SquareButton>
  );
}

// Root font-size ladder in %. The site default is 125% (set in styles.css) — the old "two A+ clicks" — so text is readable without touching the bar.
const textScales = [100, 112.5, 125, 137.5, 150] as const;
const defaultScale = 125;

/** Government-site style controls: A− / A / A+ text size and a high-contrast toggle, persisted per browser. */
export function AccessibilityBar({
  language,
  setLanguage,
  compact = false,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Always use the single "Aa" toggle row (skip the full desktop row) — for the Desk's slimmer header. */
  compact?: boolean;
}) {
  const t = labels[language];
  const ts = shellStrings[language];
  const [scale, setScale] = useState<number>(() => {
    const stored = Number(localStorage.getItem("vn:text-scale"));
    return (textScales as readonly number[]).includes(stored) ? stored : defaultScale;
  });
  const [contrast, setContrast] = useState<"normal" | "high">(() =>
    localStorage.getItem("vn:contrast") === "high" ? "high" : "normal",
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = scale === defaultScale ? "" : `${scale}%`;
    if (scale === defaultScale) localStorage.removeItem("vn:text-scale");
    else localStorage.setItem("vn:text-scale", String(scale));
  }, [scale]);

  useEffect(() => {
    document.documentElement.setAttribute("data-contrast", contrast);
    localStorage.setItem("vn:contrast", contrast);
  }, [contrast]);

  const index = textScales.indexOf(scale as (typeof textScales)[number]);
  const step = (delta: number) => setScale(textScales[Math.min(textScales.length - 1, Math.max(0, index + delta))]);
  const control = `inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-sans text-[0.72rem] font-semibold tracking-[0.08em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted ${focusRing}`;

  const controls = (
    <>
      <span className="mr-2 font-sans text-[0.62rem] uppercase tracking-[0.18em] text-muted">{t.accessibility}</span>
      <button type="button" onClick={() => step(-1)} disabled={index <= 0} aria-label={t.textSmaller} className={control}>
        A−
      </button>
      <button type="button" onClick={() => setScale(defaultScale)} aria-label={t.textReset} className={control}>
        A
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={index >= textScales.length - 1}
        aria-label={t.textLarger}
        className={`${control} text-[0.85rem]`}
      >
        A+
      </button>
      <span aria-hidden="true" className="mx-1 text-rule">
        |
      </span>
      <button
        type="button"
        onClick={() => setContrast(contrast === "high" ? "normal" : "high")}
        aria-pressed={contrast === "high"}
        className={`${control} gap-2 uppercase ${contrast === "high" ? "bg-ink text-paper" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-3 w-3 rounded-full border border-current ${contrast === "high" ? "bg-paper" : "bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]"}`}
        />
        {t.highContrast}
      </button>
    </>
  );

  return (
    <div className={shell}>
      <div className={`${compact ? "hidden" : "hidden lg:flex"} flex-wrap items-center justify-end gap-x-1 gap-y-0 border-b border-rule`} role="group" aria-label={t.accessibility}>
        {controls}
      </div>
      <div className={`flex items-center border-b border-rule ${compact ? "" : "lg:hidden"}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="a11y-controls"
          aria-label={ts.accessibilityToggle}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 font-sans text-sm font-semibold tracking-[0.08em] text-ink ${focusRing}`}
        >
          Aa
        </button>
        <div className="ml-auto">
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>
      </div>
      {open ? (
        <div id="a11y-controls" role="group" aria-label={t.accessibility} className={`flex flex-wrap items-center gap-x-1 gap-y-0 border-b border-rule py-1 ${compact ? "" : "lg:hidden"}`}>
          {controls}
        </div>
      ) : null}
    </div>
  );
}
