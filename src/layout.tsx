import { useEffect, useState } from "react";
import { data } from "./data";
import { fillTemplate, formatEditionDate, responseDay } from "./edition";
import { districtLabels } from "./geo";
import { labels } from "./i18n";
import { LiveStatusBadge } from "./live";
import { regionOptions } from "./region";
import type { Language, Page } from "./types";
import { focusRing, Rule, SquareButton } from "./ui";
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
        className="flex items-center gap-5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em]"
      >
        <div className="flex min-w-0 flex-1 gap-5 overflow-x-auto">
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
        </div>
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
            {t.contactUs}: <span className="normal-case tracking-normal">verifiednepal01@gmail.com</span>
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
