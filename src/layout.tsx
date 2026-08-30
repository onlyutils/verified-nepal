import { Github, Home, Info, PhoneCall, Search, X } from "lucide-react";
import { useState } from "react";
import { data } from "./data";
import { labels } from "./i18n";
import { LiveStatusBadge } from "./live";
import { githubUrl, onlyUtilsUrl, pmoAppealUrl } from "./urls";
import type { Language, Page } from "./types";
import { formatDateTime } from "./utils";

const navItems: Array<{ page: "dashboard" | "search" | "info"; icon: typeof Home }> = [
  { page: "dashboard", icon: Home },
  { page: "search", icon: Search },
  { page: "info", icon: Info },
];

export function Header({
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

  return (
    <header className="sticky top-0 z-40 border-b border-nepal-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("dashboard")}
          className="inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson focus-visible:ring-offset-2"
        >
          <img src="/brand/logo-mark.svg" alt="" aria-hidden="true" className="h-9 w-9" />
          <span className="text-left leading-none">
            <span className="block text-[1.35rem] font-semibold tracking-display text-nepal-ink">
              verified<span className="font-bold">Nepal</span>
            </span>
            <span className="mt-1.5 hidden text-[0.68rem] font-medium uppercase tracking-[0.12em] text-nepal-slate sm:block">
              {t.unofficial}
            </span>
          </span>
        </button>

        <nav aria-label="Primary navigation" className="order-3 -mb-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {navItems.map(({ page: itemPage, icon: Icon }) => {
            const active = page === itemPage;
            return (
              <button
                key={itemPage}
                type="button"
                onClick={() => navigate(itemPage)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-3 pt-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson ${
                  active
                    ? "border-nepal-crimson text-nepal-ink"
                    : "border-transparent text-nepal-slate hover:text-nepal-ink"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {t[itemPage]}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.githubAria}
            className="inline-flex min-h-10 items-center gap-2 border border-nepal-line bg-white px-3 text-sm font-semibold text-nepal-slate transition hover:bg-nepal-blueSoft hover:text-nepal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
          >
            <Github size={17} aria-hidden="true" />
            <span>{t.github}</span>
          </a>
          <div
            className="inline-flex overflow-hidden border border-nepal-line"
            aria-label={t.language}
          >
            <LanguageButton active={language === "en"} onClick={() => setLanguage("en")}>
              EN
            </LanguageButton>
            <LanguageButton active={language === "ne"} onClick={() => setLanguage("ne")}>
              नेपाली
            </LanguageButton>
          </div>
        </div>
      </div>
    </header>
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
      className={`min-h-10 px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nepal-crimson ${
        active ? "bg-nepal-blue text-white" : "bg-white text-nepal-slate hover:bg-nepal-blueSoft"
      }`}
    >
      {children}
    </button>
  );
}

export function EmergencyStrip({ language }: { language: Language }) {
  const t = labels[language];
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("verifiednepal:emergency-dismissed") === "1",
  );

  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("verifiednepal:emergency-dismissed", "1");
    setDismissed(true);
  };

  return (
    <aside
      className="bg-nepal-crimson text-white"
      aria-label={t.emergencyStripLabel}
    >
      <div className="mx-auto flex max-w-[78rem] items-center gap-3 px-4 py-2 text-sm font-semibold sm:px-6 lg:px-8">
        <PhoneCall size={17} className="shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 leading-6">
          <span className="font-bold">{t.emergencyQuestion}</span>{" "}
          <EmergencyStripLink number="1234" label={t.neocShort} /> <span aria-hidden="true">·</span>{" "}
          <EmergencyStripLink number="100" label={t.policeShort} /> <span aria-hidden="true">·</span>{" "}
          <EmergencyStripLink number="102" label={t.ambulanceShort} />
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismissEmergency}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function EmergencyStripLink({ number, label }: { number: string; label: string }) {
  return (
    <a
      href={`tel:${number}`}
      className="inline-flex min-h-11 items-center underline decoration-white/60 underline-offset-4 hover:decoration-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span className="font-bold tabular-nums">{number}</span>&nbsp;({label})
    </a>
  );
}

export function Footer({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];

  return (
    <footer className="bg-nepal-blueDeep text-nepal-onDark">
      <div className="mx-auto grid max-w-[78rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <img src="/brand/logo-horizontal-light.svg" alt="verifiedNepal" className="h-10 w-auto" />
          <p className="mt-5 max-w-md text-sm leading-6">{t.aboutBody}</p>
          <p className="mt-4 max-w-md text-sm leading-6">
            {t.contributeCta}{" "}
            <a
              className="inline-flex items-center gap-1 font-semibold text-white underline underline-offset-2 hover:text-nepal-onDark focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={14} aria-hidden="true" />
              {t.contributeLink}
            </a>
          </p>
          <p className="mt-2 text-sm leading-6">
            {t.contactUs}:{" "}
            <a
              className="font-semibold text-white underline underline-offset-2 hover:text-nepal-onDark focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              href="mailto:verifiednepal01@gmail.com"
            >
              verifiednepal01@gmail.com
            </a>
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="text-sm leading-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-onDarkMuted">
              {t.source}
            </p>
            <p className="mt-2 text-white">{t.sourceName}</p>
            <p>
              {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
            </p>
            <LiveStatusBadge language={language} className="mt-3 text-nepal-onDark" />
          </div>
          <div className="text-sm leading-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-onDarkMuted">
              {t.contactsTitle}
            </p>
            <a
              className="mt-2 block hover:text-white"
              href="https://ndrrma.gov.np"
              target="_blank"
              rel="noreferrer"
            >
              NDRRMA
            </a>
            <a className="block hover:text-white" href={pmoAppealUrl} target="_blank" rel="noreferrer">
              {t.donateTitle}
            </a>
            <a className="block hover:text-white" href={githubUrl} target="_blank" rel="noopener noreferrer">
              {t.sourceCodeOnGithub}
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-[78rem] flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            {t.unofficial}
            {" · "}
            <button
              type="button"
              onClick={() => navigate("privacy")}
              className="underline decoration-white/40 underline-offset-4 hover:decoration-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.privacyTitle}
            </button>
          </p>
          <p>
            {t.poweredBy}{" "}
            <a
              href={onlyUtilsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-white underline decoration-nepal-crimson decoration-2 underline-offset-4 hover:decoration-white"
            >
              OnlyUtils
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
