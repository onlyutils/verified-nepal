import L from "leaflet";
import {
  Activity,
  ArrowUpRight,
  ExternalLink,
  Github,
  Home,
  Info,
  MapPin,
  PhoneCall,
  Search,
  Sparkles,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { data } from "./data";
import { helplines } from "./helplines";
import {
  districtLabels,
  districtShapes,
  districtNames,
  locationDistrict,
  placeLocation,
  riverPath,
  type DistrictName,
} from "./geo";
import { openChatWidget } from "./chat-widget";
import { PrivacyPolicy } from "./privacy";
import { labels, textForLanguage } from "./i18n";
import { fetchMissingPersons, LiveDataProvider, LiveStatusBadge, useLiveData } from "./live";
import type {
  Language,
  MissingPersonRecord,
  NamedLocation,
  OpmcmGovernmentEffort,
  OpmcmStats,
  PersonRecord,
} from "./types";
import {
  formatDateTime,
  formatNumber,
  matchesPerson,
  messageText,
  officialRescueUrl,
  sentenceCase,
  statusTone,
} from "./utils";

type Page = "dashboard" | "search" | "info" | "privacy";
type LatLng = [number, number];

const pagePaths: Record<Page, string> = {
  dashboard: "/",
  search: "/search",
  info: "/info",
  privacy: "/privacy",
};

const navItems: Array<{ page: "dashboard" | "search" | "info"; icon: typeof Home }> = [
  { page: "dashboard", icon: Home },
  { page: "search", icon: Search },
  { page: "info", icon: Info },
];

const statusColors = ["#003893", "#DC143C", "#0F766E", "#B45309"];
const overviewBounds = L.latLngBounds(riverPath).pad(0.18);

/** Official Government of Nepal donation gateway, listed on opmcm.gov.np/content/586. */
const pmdrfUrl = "https://pmdrf.nchl.com.np/";
const pmoAppealUrl = "https://opmcm.gov.np/content/586/heartfelt-appeal/";
const onlyUtilsUrl = "https://onlyutils.com";
const githubUrl = "https://github.com/onlyutils/verified-nepal";
const opmcmMissingPersonUrl = "https://rescue.opmcm.gov.np/person-lost-found?type=lost";
const opmcmAskHelpUrl = "https://rescue.opmcm.gov.np/ask-help";
const opmcmUpdatesUrl = "https://rescue.opmcm.gov.np/government-efforts";

function pageFromPath(pathname: string): Page {
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/info")) return "info";
  if (pathname.startsWith("/privacy")) return "privacy";
  return "dashboard";
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("verifiednepal:language");
    return stored === "ne" ? "ne" : "en";
  });
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));

  useEffect(() => {
    localStorage.setItem("verifiednepal:language", language);
    document.documentElement.lang = language === "ne" ? "ne" : "en";
  }, [language]);

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (page === "search") {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex";
    } else if (robots) {
      robots.remove();
    }
  }, [page]);

  const navigate = useCallback((nextPage: Page) => {
    window.history.pushState({}, "", pagePaths[nextPage]);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <LiveDataProvider>
      <div className="min-h-dvh bg-nepal-mist text-nepal-ink">
        <div className="h-1 bg-flag" aria-hidden="true" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-nepal-blue focus:px-4 focus:py-3 focus:text-white"
        >
          Skip to main content
        </a>
        {page === "dashboard" ? <EmergencyStrip language={language} /> : null}
        <Header page={page} language={language} setLanguage={setLanguage} navigate={navigate} />
        <main id="main" className="mx-auto w-full max-w-[78rem] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          {page === "dashboard" ? <Dashboard language={language} /> : null}
          {page === "search" ? <FindPerson language={language} /> : null}
          {page === "info" ? <InfoHelp language={language} /> : null}
          {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
        </main>
        <Footer language={language} navigate={navigate} />
      </div>
    </LiveDataProvider>
  );
}

function Header({
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

function EmergencyStrip({ language }: { language: Language }) {
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

function Footer({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];

  return (
    <footer className="bg-nepal-blueDeep text-nepal-onDark">
      <div className="mx-auto grid max-w-[78rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <img src="/brand/logo-horizontal-light.svg" alt="verifiedNepal" className="h-10 w-auto" />
          <p className="mt-5 max-w-md text-sm leading-6">{t.aboutBody}</p>
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

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-nepal-crimson">
      <span className="h-px w-6 bg-nepal-crimson" aria-hidden="true" />
      {children}
    </p>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
  footer,
  className = "",
}: {
  title: string;
  icon?: typeof Home;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col border border-nepal-line bg-white shadow-panel ${className}`}>
      <div className="flex items-center gap-3 border-b border-nepal-line px-5 py-4">
        {Icon ? <Icon className="shrink-0 text-nepal-crimson" size={18} aria-hidden="true" /> : null}
        <h2 className="text-[0.9rem] font-bold uppercase tracking-[0.08em] text-nepal-ink">{title}</h2>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <div className="flex-1 p-5">{children}</div>
      {footer ? <div className="px-5 pb-4 pt-1">{footer}</div> : null}
    </section>
  );
}

function SourceCaption({
  language,
  source = "NDRRMA",
  updatedAt,
}: {
  language: Language;
  source?: string;
  updatedAt?: string | null;
}) {
  const t = labels[language];
  const liveData = useLiveData();
  const captionUpdatedAt =
    updatedAt ?? (liveData.isLive && liveData.updatedAt ? liveData.updatedAt : data.meta.synced_at);

  return (
    <p className="text-[0.68rem] font-bold uppercase leading-5 tracking-[0.14em] text-nepal-slate">
      {t.sourceCaptionSource}: {source} <span aria-hidden="true">·</span>{" "}
      {t.sourceCaptionUpdated} {formatCaptionTime(captionUpdatedAt, language)}
    </p>
  );
}

function formatCaptionTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}

function Dashboard({ language }: { language: Language }) {
  const t = labels[language];
  const [region, setRegion] = useRegion();
  const countryCounts = useMemo(
    () =>
      data.countryCounts.map(
        (entry) => [sentenceCase(entry.country) || t.unavailable, entry.count] as [string, number],
      ),
    [t.unavailable],
  );
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[3fr_1fr]">
        <Hero language={language} />
        <AgentCta language={language} region={region} onRegionChange={setRegion} />
      </div>
      <OfficialActionCtas language={language} />
      <EmergencyContacts language={language} />
      <DonateCta language={language} />

      <div className="grid gap-6 lg:grid-cols-[1.7fr_0.55fr]">
        <ReliefMap
          language={language}
          selected={selected}
          onSelect={setSelected}
          region={region}
          onRegionChange={setRegion}
        />
        <AffectedLocations
          language={language}
          selected={selected}
          onSelect={setSelected}
          region={region}
        />
      </div>

      <OfficialUpdatesSection language={language} />

      <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <StatusBreakdown language={language} />
        <NationalityPanel counts={countryCounts} language={language} />
      </div>
    </div>
  );
}

function useRegion() {
  const [region, setRegionState] = useState(() => localStorage.getItem("vn:region") || "");

  const setRegion = useCallback((nextRegion: string) => {
    setRegionState(nextRegion);
  }, []);

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

function EmergencyContacts({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <section className="border border-nepal-line bg-white p-5 shadow-panel sm:p-6" aria-labelledby="emergency-heading">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center bg-nepal-crimson text-white">
          <PhoneCall size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 id="emergency-heading" className="text-xl font-bold tracking-display text-nepal-ink">
            {t.emergencyContactsTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-nepal-slate">{t.emergencyContactsBody}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {helplines.map((helpline) => {
          const label = language === "ne" ? helpline.labelNe : helpline.labelEn;
          return (
            <a
              key={helpline.key}
              href={`tel:${helpline.number}`}
              className="flex min-h-12 items-center justify-between gap-3 border border-nepal-line bg-nepal-mist px-4 py-3 text-nepal-ink transition hover:border-nepal-crimson hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
            >
              <span className="text-sm font-semibold leading-5">{label}</span>
              <span className="text-lg font-bold tabular-nums text-nepal-crimson">{helpline.number}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

const regionOptions = districtNames
  .filter((district) =>
    [data.rescuedLocations.results, data.stationedLocations.results]
      .flat()
      .some((location) => locationDistrict(location) === district || locationTextIncludesDistrict(location, district)),
  )
  .sort((a, b) => districtLabels[a].en.localeCompare(districtLabels[b].en));

function RegionSelect({
  language,
  value,
  onChange,
  compact = false,
}: {
  language: Language;
  value: string;
  onChange: (region: string) => void;
  compact?: boolean;
}) {
  const t = labels[language];
  const id = compact ? "map-region" : "agent-region";

  return (
    <label className={`block ${compact ? "min-w-[11rem]" : ""}`} htmlFor={id}>
      <span className={compact ? "sr-only" : "block text-sm font-semibold text-nepal-onDark"}>
        {t.whichArea}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-full border bg-white text-sm font-semibold text-nepal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson ${
          compact
            ? "border-nepal-line px-3"
            : "mt-2 border-white/20 px-3 focus-visible:ring-offset-2 focus-visible:ring-offset-nepal-ink"
        }`}
      >
        <option value="">{t.allAreas}</option>
        {regionOptions.map((district) => (
          <option key={district} value={district}>
            {districtLabels[district][language]}
          </option>
        ))}
      </select>
    </label>
  );
}

function locationTextIncludesDistrict(location: NamedLocation, district: DistrictName) {
  const labelsForDistrict = districtLabels[district];
  const text = `${location.title || ""} ${location.title_ne || ""}`.toLocaleLowerCase();
  return (
    text.includes(labelsForDistrict.en.toLocaleLowerCase()) ||
    text.includes(labelsForDistrict.ne.toLocaleLowerCase())
  );
}

function locationMatchesRegion(location: NamedLocation, region: string) {
  if (!region) return true;
  const district = region as DistrictName;
  return (
    locationDistrict(location) === district ||
    locationTextIncludesDistrict(location, district) ||
    locationTextHasKnownPlace(location, district)
  );
}

const districtPlaceHints: Record<DistrictName, string[]> = {
  Rasuwa: [
    "dhunche",
    "syabru",
    "timure",
    "kalikasthan",
    "dhaibung",
    "rasuwa",
    "धुन्चे",
    "स्याफ्रु",
    "टिमुरे",
    "कालिकास्थान",
    "धैबुङ",
    "रसुवा",
  ],
  Nuwakot: ["bidur", "trishuli", "battar", "nuwakot", "विदुर", "त्रिशूली", "बट्टार", "नुवाकोट"],
  Sindhupalchok: ["sindhupalchok", "sindhupalchowk", "सिन्धुपाल्चोक"],
};

function locationTextHasKnownPlace(location: NamedLocation, district: DistrictName) {
  const text = `${location.title || ""} ${location.title_ne || ""}`.toLocaleLowerCase();
  return districtPlaceHints[district].some((hint) => text.includes(hint.toLocaleLowerCase()));
}

function Hero({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();
  const stats: Array<[string, number | null]> = [
    [t.verifiedRecords, liveData.statusCounts.total_count],
    [t.outOfReach, liveData.rescuedStatistics.out_of_reach ?? null],
    [t.forceDeployed, liveData.rescuedStatistics.force_deployed ?? null],
  ];
  const messages = liveData.messages
    .map((message) => messageText(message, language))
    .filter(Boolean);
  const rescuedCount = formatNumber(liveData.rescuedStatistics.rescued_count, language);
  const verifiedCount = formatNumber(liveData.statusCounts.total_count, language);
  const rescuedVerifiedCopy = t.rescuedVerifiedCopy
    .replace("{rescued}", rescuedCount)
    .replace("{verified}", verifiedCount);

  return (
    <section className="relative flex flex-col overflow-hidden bg-nepal-blueDeep text-white shadow-lift">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 110% at 10% 0%, rgba(0,56,147,0.45) 0%, rgba(0,27,71,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-1 flex-col p-6 sm:p-8">
        <p className="flex flex-wrap items-center gap-2.5 text-base font-bold uppercase tracking-[0.2em] sm:text-lg">
          <HeroLiveIndicator language={language} />
          {t.floodName}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <h1 className="text-[3.25rem] font-bold leading-[0.95] tracking-display sm:text-[4.25rem]">
              {rescuedCount}
            </h1>
            <p className="mt-2 text-xl font-medium text-nepal-onDark sm:text-2xl">{t.rescued}</p>
          </div>
          <div className="border-l-4 border-nepal-crimson pl-4">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-nepal-onDark">
              {t.missing}
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-display text-white">
              {liveData.missingCount === null ? t.unavailable : formatNumber(liveData.missingCount, language)}
            </p>
          </div>
        </div>
        <div className="mt-6 h-0.5 w-20 bg-nepal-crimson" aria-hidden="true" />
        <p className="mt-5 text-sm text-nepal-onDark">{t.floodDate}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-white">{rescuedVerifiedCopy}</p>
        <LiveStatusBadge language={language} className="mt-3 text-nepal-onDark" />
        {messages.length ? (
          <div className="mt-5 border-l-2 border-white/30 pl-3 text-sm leading-6 text-nepal-onDark">
            <p className="font-bold text-white">{t.officialMessages}</p>
            {messages.map((message, index) => (
              <p key={`${message}-${index}`}>{message}</p>
            ))}
          </div>
        ) : null}
        <dl className="mt-auto grid grid-cols-1 border-t border-white/20 pt-3 sm:grid-cols-3 sm:pt-5">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="border-t border-white/20 py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:px-3 sm:py-0 sm:first:border-l-0 sm:first:pl-0"
            >
              <dt className="text-[0.7rem] leading-4 text-nepal-onDark">{label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums tracking-display">
                {value === null ? t.unavailable : formatNumber(value, language)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function HeroLiveIndicator({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();

  if (!liveData.isLive) {
    return (
      <span
        className="inline-flex items-center gap-2 text-[0.72rem] tracking-[0.14em] text-amber-200"
        title={t.snapshotTooltip}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
        {t.snapshotData}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-3.5 w-3.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nepal-crimson opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-nepal-crimson ring-2 ring-white/70" />
      </span>
      <span className="rounded-sm bg-nepal-crimson px-2 py-0.5 text-[0.68rem] font-black tracking-[0.16em] text-white shadow-[0_0_24px_rgba(220,20,60,0.45)] motion-safe:animate-pulse">
        {t.livePill}
      </span>
    </span>
  );
}

function AgentCta({
  language,
  region,
  onRegionChange,
}: {
  language: Language;
  region: string;
  onRegionChange: (region: string) => void;
}) {
  const t = labels[language];

  return (
    <section
      className="relative flex flex-col overflow-hidden bg-nepal-ink text-white shadow-lift"
      aria-labelledby="agent-heading"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 90% at 85% 8%, rgba(0,56,147,0.8) 0%, rgba(11,18,32,0) 65%)",
        }}
        aria-hidden="true"
      />
      <div className="relative flex flex-1 flex-col p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em]">
          <Sparkles size={14} className="text-nepal-crimson" aria-hidden="true" />
          {t.agentKicker}
        </p>
        <h2
          id="agent-heading"
          className="mt-4 text-2xl font-bold leading-tight tracking-display sm:text-[1.7rem]"
        >
          {t.agentTitle}
        </h2>
        <p className="mt-3 text-sm leading-6 text-nepal-onDark">{t.agentBody}</p>
        <div className="mt-auto pt-6">
          <RegionSelect language={language} value={region} onChange={onRegionChange} />
          <button
            type="button"
            onClick={openChatWidget}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-white px-4 text-sm font-bold text-nepal-ink transition hover:bg-nepal-onDark focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nepal-ink"
          >
            {t.agentCta}
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function OfficialActionCtas({ language }: { language: Language }) {
  const t = labels[language];
  const actions = [
    {
      href: opmcmMissingPersonUrl,
      label: t.reportMissingPerson,
      icon: Search,
      tone: "border-nepal-crimson bg-nepal-crimsonSoft text-nepal-crimson",
      iconTone: "bg-nepal-crimson text-white",
    },
    {
      href: opmcmAskHelpUrl,
      label: t.askForHelp,
      icon: PhoneCall,
      tone: "border-nepal-blue bg-nepal-blueSoft text-nepal-blue",
      iconTone: "bg-nepal-blue text-white",
    },
  ];

  return (
    <section aria-label={t.officialActions} className="grid gap-3 sm:grid-cols-2">
      {actions.map(({ href, label, icon: Icon, tone, iconTone }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`group flex min-h-14 items-center gap-4 border-l-4 bg-white p-4 shadow-panel transition hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson motion-reduce:hover:translate-y-0 ${tone}`}
        >
          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center ${iconTone}`}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-5 text-nepal-ink">{label}</span>
            <span className="mt-1 block text-sm font-semibold leading-5 text-nepal-slate">
              {t.officialGovernmentPortal}
            </span>
          </span>
          <ExternalLink
            size={18}
            className="shrink-0 text-nepal-slate transition group-hover:text-nepal-ink"
            aria-hidden="true"
          />
        </a>
      ))}
    </section>
  );
}

function DonateCta({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <section className="relative overflow-hidden bg-nepal-crimson text-white shadow-lift" aria-labelledby="donate-heading">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white">
            <span className="h-px w-6 bg-white/80" aria-hidden="true" />
            {t.donateKicker}
          </p>
          <h2
            id="donate-heading"
            className="mt-4 text-3xl font-bold leading-tight tracking-display sm:text-[2.6rem]"
          >
            {t.donateTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-white">{t.donateBody}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={pmdrfUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-12 items-center gap-2 bg-white px-6 text-base font-bold text-nepal-crimson transition hover:bg-nepal-crimsonSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nepal-crimson"
            >
              {t.donateCta}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a
              href={pmoAppealUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-12 items-center gap-2 border border-white/40 px-5 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.donateVerify}
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-white">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t.donateWarning}
          </p>
        </div>

        <figure className="mx-auto w-fit bg-white p-4 text-center shadow-lift">
          <img
            src="/brand/pmdrf-qr.svg"
            alt={`QR code linking to ${pmdrfUrl}`}
            className="h-40 w-40"
            width={160}
            height={160}
          />
          <figcaption className="mt-3 max-w-[10rem] text-xs font-semibold leading-5 text-nepal-ink">
            {t.donateScan}
            <span className="mt-1 block font-mono text-[0.65rem] font-semibold text-nepal-blue">
              pmdrf.nchl.com.np
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function StatusBreakdown({ language }: { language: Language }) {
  const t = labels[language];
  const { statusCounts } = useLiveData();
  const total = Math.max(statusCounts.total_count, 1);

  return (
    <Panel title={t.statusBreakdown} icon={Activity} footer={<SourceCaption language={language} />}>
      <div className="flex h-3 overflow-hidden bg-nepal-mist" aria-hidden="true">
        {statusCounts.status_counts.map((status, index) => (
          <div
            key={status.id}
            style={{
              width: `${(status.count / total) * 100}%`,
              backgroundColor: statusColors[index % statusColors.length],
            }}
          />
        ))}
      </div>
      <dl className="mt-6 divide-y divide-nepal-line">
        {statusCounts.status_counts.map((status, index) => {
          const percent = (status.count / total) * 100;
          return (
            <div key={status.id} className="grid grid-cols-[0.6rem_1fr_auto] items-center gap-3 py-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: statusColors[index % statusColors.length] }}
                aria-hidden="true"
              />
              <dt className="text-sm font-medium text-nepal-slate">
                {textForLanguage(status, language)}
              </dt>
              <dd className="text-right text-sm font-bold tabular-nums text-nepal-ink">
                {formatNumber(status.count, language)}
                <span className="ml-2 font-medium text-nepal-slate">{percent.toFixed(1)}%</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

function NationalityPanel({
  counts,
  language,
}: {
  counts: Array<[string, number]>;
  language: Language;
}) {
  const t = labels[language];
  const max = Math.max(...counts.map(([, count]) => count), 1);

  return (
    <Panel title={t.nationalityPanel} icon={Users} footer={<SourceCaption language={language} />}>
      <p className="text-sm leading-6 text-nepal-slate">{t.nationalityHelp}</p>
      <div className="mt-5 max-h-[16rem] space-y-2.5 overflow-auto pr-2">
        {counts.map(([country, count], index) => (
          <div key={country} className="grid grid-cols-[minmax(6.5rem,0.7fr)_1fr_3rem] items-center gap-3">
            <span className="truncate text-sm font-semibold text-nepal-ink" title={country}>
              {country}
            </span>
            <span className="h-1.5 bg-nepal-mist">
              <span
                className="block h-full"
                style={{
                  width: `${Math.max((count / max) * 100, 2)}%`,
                  backgroundColor: index === 0 ? "#DC143C" : "#003893",
                }}
              />
            </span>
            <span className="text-right text-sm font-bold tabular-nums text-nepal-ink">
              {formatNumber(count, language)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function OfficialUpdatesSection({ language }: { language: Language }) {
  const { officialUpdates, opmcmStats, opmcmUpdatedAt } = useLiveData();
  const hasUpdates = officialUpdates !== null && officialUpdates.length > 0;
  const hasStats = opmcmStats !== null;

  if (!hasUpdates && !hasStats) return null;

  if (!hasUpdates && opmcmStats) {
    return (
      <Panel
        title={labels[language].opmcmCoordination}
        footer={<SourceCaption language={language} source="OPMCM" updatedAt={opmcmUpdatedAt} />}
      >
        <OpmcmStatsRow stats={opmcmStats} language={language} />
      </Panel>
    );
  }

  return (
    <Panel
      title={labels[language].officialUpdatesPanel}
      action={
        <a
          href={opmcmUpdatesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-nepal-blue hover:text-nepal-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
        >
          OPMCM
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      }
      footer={<SourceCaption language={language} source="OPMCM" updatedAt={opmcmUpdatedAt} />}
    >
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <ul className="divide-y divide-nepal-line border-y border-nepal-line">
          {officialUpdates?.slice(0, 3).map((item) => {
            const date = officialUpdateDate(item, language);
            return (
              <li key={item._id}>
                <a
                  href={opmcmUpdatesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-14 items-start gap-3 px-1 py-3 text-nepal-ink transition hover:bg-nepal-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nepal-crimson"
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-nepal-crimson" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-6 group-hover:text-nepal-crimson">
                      {officialUpdateTitle(item, language)}
                    </span>
                    {date ? (
                      <span className="mt-1 block text-xs font-semibold leading-5 text-nepal-slate">
                        {date}
                      </span>
                    ) : null}
                  </span>
                  <ExternalLink size={15} className="mt-1 shrink-0 text-nepal-slate" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
        {opmcmStats ? <OpmcmStatsRow stats={opmcmStats} language={language} /> : null}
      </div>
    </Panel>
  );
}

function OpmcmStatsRow({ stats, language }: { stats: OpmcmStats; language: Language }) {
  const t = labels[language];

  return (
    <div className="border border-nepal-line bg-nepal-mist p-4">
      <p className="text-sm font-semibold leading-6 text-nepal-ink">
        {t.helpRequests}:{" "}
        <span className="tabular-nums">{formatNumber(stats.requests.total, language)}</span> {t.total}{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className="tabular-nums">{formatNumber(stats.requests.open, language)}</span> {t.open}{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className="font-bold tabular-nums text-nepal-crimson">
          {formatNumber(stats.requests.critical, language)}
        </span>{" "}
        {t.critical} <span aria-hidden="true">·</span>{" "}
        <span className="tabular-nums">{formatNumber(stats.requests.inProgress, language)}</span>{" "}
        {t.inProgress} <span aria-hidden="true">·</span>{" "}
        <span className="tabular-nums">{formatNumber(stats.requests.resolved, language)}</span>{" "}
        {t.resolved}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-nepal-ink">
        {t.helpOffersAvailable}:{" "}
        <span className="tabular-nums">{formatNumber(stats.offers.available, language)}</span>
      </p>
    </div>
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

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

const pinGlyph = {
  rescue:
    '<path d="M12 2C7 8 4 11 4 14.5a8 8 0 0 0 16 0C20 11 17 8 12 2Z" fill="currentColor"/><path d="M7.6 15.4c1.4-1.2 2.5-1.2 3.9 0s2.5 1.2 3.9 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  camp: '<path d="M12 2.5 2.5 21h19L12 2.5Z" fill="currentColor"/><path d="M12 10.5v6M9 13.5h6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
};

function makeIcon(kind: "rescue" | "camp", active: boolean) {
  const color = kind === "rescue" ? "#DC143C" : "#0B62E0";
  const size = active ? 42 : 28;
  return L.divIcon({
    className: `vn-pin${active ? " vn-pin--active" : ""}`,
    html: `<span style="color:${color};display:block;width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}">${pinGlyph[kind]}</svg></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/** Pans/zooms when the selection changes; renders nothing. */
function MapFocus({ selectedCenter }: { selectedCenter: LatLng | null }) {
  const map = useMap();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (selectedCenter) {
      if (prefersReducedMotion) {
        map.setView(selectedCenter, 13, { animate: false });
      } else {
        map.flyTo(selectedCenter, 13, { duration: 0.8 });
      }
      return;
    }

    if (prefersReducedMotion) {
      map.setView(overviewBounds.getCenter(), map.getBoundsZoom(overviewBounds, false, L.point(48, 48)), {
        animate: false,
      });
    } else {
      map.fitBounds(overviewBounds, {
        animate: true,
        padding: [48, 48],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedCenter?.[0], selectedCenter?.[1], prefersReducedMotion]);
  return null;
}

function MapDragging({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
    } else {
      map.dragging.disable();
    }
  }, [enabled, map]);
  return null;
}

function ReliefMap({
  language,
  selected,
  onSelect,
  region,
  onRegionChange,
}: {
  language: Language;
  selected: number | null;
  onSelect: (id: number | null) => void;
  region: string;
  onRegionChange: (region: string) => void;
}) {
  const t = labels[language];
  const [mapUnlocked, setMapUnlocked] = useState(
    () => !(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window),
  );
  const camps = data.stationedLocations.results
    .filter(hasCoordinates)
    .filter((camp) => !region || locationMatchesRegion(camp, region));
  const placed = useMemo(
    () =>
      data.rescuedLocations.results
        .map(placeLocation)
        .filter((place): place is NonNullable<typeof place> => place !== null)
        .filter((place) => !region || locationMatchesRegion(place.location, region)),
    [region],
  );
  const activeDistricts = useMemo(
    () =>
      [
        ...new Set(
          data.rescuedLocations.results
            .map(locationDistrict)
            .filter((district): district is DistrictName => district !== null),
        ),
      ],
    [],
  );
  const selectedPlace = placed.find((place) => place.location.id === selected) ?? null;
  const center: LatLng = selectedPlace
    ? [selectedPlace.lat, selectedPlace.lng]
    : [28.05, 85.33];
  const zoom = selectedPlace ? 11 : 9;

  return (
    <Panel
      title={t.reliefMap}
      icon={MapPin}
      footer={<SourceCaption language={language} />}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RegionSelect language={language} value={region} onChange={onRegionChange} compact />
          {selected !== null ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="min-h-11 px-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-nepal-crimson hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
            >
              {t.clearSelection}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-nepal-slate">
        <LegendDot color="#DC143C">{t.rescuePoints}</LegendDot>
        <LegendDot color="#0B62E0">{t.reliefCamps}</LegendDot>
        <LegendDot color="#7DD3FC">{t.riverLabel}</LegendDot>
      </div>
      <div className="relative h-[20rem] overflow-hidden border border-nepal-line lg:h-[26rem]">
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
          {/* Place names and borders ride on top of the imagery. */}
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          />
          <MapFocus selectedCenter={selectedPlace ? [selectedPlace.lat, selectedPlace.lng] : null} />
          <MapDragging enabled={mapUnlocked} />

          {/* Spotlight: a scrim dims every district, and the selected one clears it. */}
          {activeDistricts.map((district) => {
            const isActive = selectedPlace?.district === district;
            return districtShapes[district]?.map((ring, index) => (
              <Polygon
                key={`${district}-${index}`}
                positions={ring}
                pathOptions={{
                  color: isActive ? "#FF2D55" : "#E6ECF7",
                  weight: isActive ? 3 : 1,
                  opacity: isActive ? 1 : 0.5,
                  fillColor: "#0B1220",
                  fillOpacity: isActive ? 0 : selectedPlace ? 0.45 : 0.18,
                }}
              >
                <Tooltip sticky>{districtLabels[district][language]}</Tooltip>
              </Polygon>
            ));
          })}

          {/* Two passes: a soft halo under a bright core, so the river reads at every zoom. */}
          <Polyline positions={riverPath} pathOptions={{ color: "#38BDF8", weight: 11, opacity: 0.2 }} />
          <Polyline positions={riverPath} pathOptions={{ color: "#7DD3FC", weight: 3, opacity: 0.95 }}>
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
          <button
            type="button"
            onClick={() => setMapUnlocked(true)}
            className="absolute inset-x-4 top-4 z-[500] mx-auto flex min-h-12 max-w-xs items-center justify-center bg-white px-4 text-sm font-bold text-nepal-ink shadow-lift transition hover:bg-nepal-blueSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
          >
            {t.tapToExploreMap}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMapUnlocked(false)}
            className="absolute right-3 top-3 z-[500] min-h-11 bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] text-nepal-blue shadow-panel transition hover:text-nepal-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
          >
            {t.collapseMap}
          </button>
        )}
      </div>
      <p className="mt-3 text-[0.68rem] leading-5 text-nepal-slate">{t.mapCredit}</p>
    </Panel>
  );
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

function AffectedLocations({
  language,
  selected,
  onSelect,
  region,
}: {
  language: Language;
  selected: number | null;
  onSelect: (id: number | null) => void;
  region: string;
}) {
  const t = labels[language];
  const groups = useMemo(() => {
    const byDistrict = new Map<DistrictName | "other", NamedLocation[]>();
    const locations = data.rescuedLocations.results.filter(
      (location) => !region || locationMatchesRegion(location, region),
    );
    for (const location of locations) {
      const key = locationDistrict(location) ?? "other";
      byDistrict.set(key, [...(byDistrict.get(key) ?? []), location]);
    }
    return [...byDistrict.entries()];
  }, [region]);
  const nearbyCamps = useMemo(
    () =>
      region
        ? data.stationedLocations.results.filter((location) => locationMatchesRegion(location, region))
        : [],
    [region],
  );
  const filteredRescueLocations = data.rescuedLocations.results.filter(
    (location) => !region || locationMatchesRegion(location, region),
  );
  const mappedCount = filteredRescueLocations.filter((location) => placeLocation(location)).length;

  return (
    <section className="flex flex-col border border-nepal-line bg-white shadow-panel">
      <div className="border-b border-nepal-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="shrink-0 text-nepal-crimson" size={17} aria-hidden="true" />
          <h2 className="min-w-0 text-[0.8rem] font-bold uppercase leading-5 tracking-[0.08em] text-nepal-ink">
            {t.affectedDistricts}
          </h2>
        </div>
        <span className="mt-2 block text-[0.7rem] font-bold tabular-nums uppercase tracking-[0.08em] text-nepal-slate">
          {formatNumber(mappedCount, language)}/
          {formatNumber(filteredRescueLocations.length, language)} {t.locationsMapped}
        </span>
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm leading-6 text-nepal-slate">{t.mapHint}</p>
        <div className="mt-4 max-h-[28rem] space-y-4 overflow-auto pr-1">
          {nearbyCamps.length ? (
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-crimson">
                {t.reliefCamps}
              </p>
              <ul className="mt-2 divide-y divide-nepal-line border-y border-nepal-line">
                {nearbyCamps.map((camp) => (
                  <li key={`nearby-camp-${camp.id}`}>
                    <div className="flex min-h-11 w-full items-center gap-3 bg-nepal-crimsonSoft px-2 py-2.5 text-left text-sm font-semibold text-nepal-ink">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-nepal-blue" aria-hidden="true" />
                      <span className="truncate">{textForLanguage(camp, language)}</span>
                      <span className="ml-auto shrink-0 bg-white px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-nepal-crimson">
                        {t.nearYou}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {groups.map(([district, locations]) => (
            <div key={district}>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-blue">
                {district === "other" ? t.unavailable : districtLabels[district][language]}
              </p>
              <ul className="mt-2 divide-y divide-nepal-line border-y border-nepal-line">
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
                        className={`flex min-h-11 w-full items-center gap-3 px-2 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nepal-crimson ${
                          active
                            ? "bg-nepal-crimsonSoft font-bold text-nepal-crimson"
                            : place
                              ? "font-medium text-nepal-ink hover:bg-nepal-blueSoft"
                              : "cursor-not-allowed text-nepal-slate"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            active ? "bg-nepal-crimson" : place ? "bg-nepal-blue" : "bg-nepal-line"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {textForLanguage(location, language)}
                          {approximate}
                        </span>
                        {!place ? (
                          <span className="ml-auto shrink-0 text-[0.65rem] uppercase tracking-wide">
                            {t.notMapped}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 pt-1">
        <SourceCaption language={language} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

type PersonSearchResult =
  | { kind: "rescued"; person: PersonRecord }
  | { kind: "missing"; person: MissingPersonRecord };

function FindPerson({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();
  const [query, setQuery] = useState("");
  const [persons, setPersons] = useState<PersonRecord[] | null>(null);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRecord[] | null>(null);
  const [rescuedLoading, setRescuedLoading] = useState(false);
  const [missingLoading, setMissingLoading] = useState(false);
  const [rescuedError, setRescuedError] = useState(false);
  const [missingError, setMissingError] = useState(false);
  const normalizedQuery = query.trim();
  const searched = normalizedQuery.length >= 2;

  useEffect(() => {
    if (!searched || persons || rescuedLoading || rescuedError) return;
    let cancelled = false;
    setRescuedLoading(true);
    fetch("/data/rescued-persons.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load person records: ${response.status}`);
        return response.json() as Promise<{ results: PersonRecord[] }>;
      })
      .then((payload) => {
        if (!cancelled) setPersons(payload.results);
      })
      .catch((error) => {
        console.warn("Rescued records fetch failed", error);
        if (!cancelled) setRescuedError(true);
      })
      .finally(() => {
        if (!cancelled) setRescuedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [persons, rescuedError, rescuedLoading, searched]);

  useEffect(() => {
    if (!searched || missingPersons || missingLoading || missingError) return;
    let cancelled = false;
    const controller = new AbortController();
    setMissingLoading(true);

    fetchMissingPersons(controller.signal)
      .then((payload) => {
        if (!cancelled) setMissingPersons(payload.results);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("Missing-person records fetch failed", error);
          if (!cancelled) setMissingError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setMissingLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [missingError, missingLoading, missingPersons, searched]);

  const results = useMemo(
    () => {
      if (!searched) return [];
      const missingResults: PersonSearchResult[] = missingPersons
        ? missingPersons
            .filter((person) => matchesPerson(person, normalizedQuery))
            .map((person) => ({ kind: "missing", person }))
        : [];
      const rescuedResults: PersonSearchResult[] = persons
        ? persons
            .filter((person) => matchesPerson(person, normalizedQuery))
            .map((person) => ({ kind: "rescued", person }))
        : [];
      return [...missingResults, ...rescuedResults].slice(0, 50);
    },
    [missingPersons, normalizedQuery, persons, searched],
  );
  const disclaimers = liveData.messages
    .map((message) => messageText(message, language))
    .filter(Boolean);
  const anyLoading = rescuedLoading || missingLoading;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <Kicker>{t.search}</Kicker>
        <h1 className="mt-4 text-3xl font-bold tracking-display text-nepal-ink sm:text-4xl">
          {t.searchTitle}
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-nepal-slate">{t.searchIntro}</p>
        <div className="mt-6">
          <label htmlFor="person-search" className="block text-sm font-semibold text-nepal-ink">
            {t.searchLabel}
          </label>
          <div className="mt-2 flex border border-nepal-line bg-white focus-within:border-nepal-crimson focus-within:ring-2 focus-within:ring-nepal-crimson/20">
            <span className="flex min-h-12 items-center px-3 text-nepal-slate" aria-hidden="true">
              <Search size={19} />
            </span>
            <input
              id="person-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder}
              autoComplete="off"
              className="min-h-12 w-full border-0 bg-transparent px-1 py-3 text-base text-nepal-ink outline-none placeholder:text-nepal-slate/60"
            />
          </div>
          <p className="mt-2 text-sm text-nepal-slate">{t.searchLanguageHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-nepal-slate">{t.reportMissingPersonHint}</span>
            <a
              href={opmcmMissingPersonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-nepal-crimson bg-nepal-crimsonSoft px-3 font-bold text-nepal-crimson transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
            >
              {t.reportMissingPerson}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {searched ? <DisclaimerBlock language={language} disclaimers={disclaimers} /> : null}

      <section aria-live="polite" className="space-y-4">
        {!searched ? (
          <div className="border border-dashed border-nepal-line bg-white p-6 leading-7 text-nepal-slate">
            {t.noSearch}
          </div>
        ) : (
          <>
            {rescuedLoading ? (
              <div className="border border-nepal-line bg-white p-4 text-sm font-semibold text-nepal-slate">
                {t.loadingVerifiedRecords}
              </div>
            ) : null}
            {missingLoading ? (
              <div className="border border-nepal-line bg-white p-3 text-sm text-nepal-slate">
                {t.loadingMissingRecords}
              </div>
            ) : null}
            {results.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-nepal-slate">
                  {formatNumber(results.length, language)} {t.results}
                </p>
                {results.map((result) => (
                  <PersonCard
                    key={`${result.kind}-${result.person.id}`}
                    result={result}
                    language={language}
                  />
                ))}
              </>
            ) : !anyLoading ? (
              <div className="border border-nepal-line bg-white p-6 leading-7 text-nepal-slate">
                {t.noMatch}
              </div>
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
    <aside className="border-l-4 border-nepal-crimson bg-nepal-crimsonSoft p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-nepal-ink">
        {t.officialDisclaimer}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-6 text-nepal-slate">
        {(disclaimers.length ? disclaimers : [fallback]).map((disclaimer, index) => (
          <p key={`${disclaimer}-${index}`}>{disclaimer}</p>
        ))}
      </div>
    </aside>
  );
}

function PersonCard({ result, language }: { result: PersonSearchResult; language: Language }) {
  const t = labels[language];
  const { person, kind } = result;
  const status = person.status;
  const isMissing = kind === "missing";
  const isRescued = kind === "rescued" && status?.id === 4;
  const statusLabel = isMissing
    ? t.missing
    : isRescued
      ? t.rescuedStatus
      : status
        ? textForLanguage(status, language)
        : t.unavailable;
  const chipTone = isMissing ? "bg-nepal-crimson text-white ring-nepal-crimson" : statusTone(status?.id);

  return (
    <article className="border border-nepal-line bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-display text-nepal-ink">
            {person.name_ne || person.name || person.display_name}
          </h2>
          {person.name && person.name_ne ? (
            <p className="mt-1 text-nepal-slate">{person.name}</p>
          ) : null}
        </div>
        <span
          className={`inline-flex w-fit items-center px-3 py-1 text-sm font-semibold ring-1 ${chipTone}`}
        >
          {statusLabel}
        </span>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <RecordField
          label={t.age}
          value={person.age === null ? null : formatNumber(person.age, language)}
          unavailable={t.unavailable}
        />
        <RecordField label={t.gender} value={sentenceCase(person.gender)} unavailable={t.unavailable} />
        <RecordField
          label={t.nationality}
          value={sentenceCase(person.country || person.nationality)}
          unavailable={t.unavailable}
        />
        {kind === "rescued" ? (
          <>
            <RecordField label={t.rescuedDate} value={person.rescued_date} unavailable={t.unavailable} />
            <RecordField
              label={t.rescuedLocation}
              value={locationValue(person.rescued_location, language)}
              unavailable={t.unavailable}
            />
            <RecordField
              label={t.stationedLocation}
              value={locationValue(person.stationed_location, language)}
              unavailable={t.unavailable}
            />
          </>
        ) : (
          <>
            <RecordField label={t.lastContact} value={person.last_contact} unavailable={t.unavailable} />
            <RecordField label={t.reportedAt} value={person.reported_at} unavailable={t.unavailable} />
          </>
        )}
        <RecordField label={t.remarks} value={person.remarks} unavailable={t.unavailable} wide />
      </dl>
      <div className="mt-6 border-t border-nepal-line pt-4 text-sm leading-6 text-nepal-slate">
        <p>
          <span className="font-semibold text-nepal-ink">{t.source}:</span> {t.sourceName}
        </p>
        <p>
          <span className="font-semibold text-nepal-ink">{t.lastSynced}:</span>{" "}
          {formatDateTime(data.meta.synced_at, language)}
        </p>
        <a
          href={officialRescueUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-nepal-crimson underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
        >
          {t.verifyOfficial}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
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
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-nepal-slate">
        {label}
      </dt>
      <dd className="mt-1 min-h-6 text-nepal-ink">{value || unavailable}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info
// ---------------------------------------------------------------------------

function InfoHelp({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EmergencyContacts language={language} />
      <DonateCta language={language} />
      <InfoPanel title={t.aboutTitle}>{t.aboutBody}</InfoPanel>
      <InfoPanel title={t.dataSourceTitle}>
        {t.dataSourceBody}
        <span className="mt-3 block text-sm text-nepal-slate">
          {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
        </span>
      </InfoPanel>
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <Kicker>{t.contactsTitle}</Kicker>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ExternalCard label={t.ndrrma} href="https://ndrrma.gov.np" />
          <ExternalCard label={t.moha} href="https://moha.gov.np" />
          <ExternalCard label={t.officialRescue} href={officialRescueUrl} />
        </div>
      </section>
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <Kicker>{t.respondersTitle}</Kicker>
        <p className="mt-4 leading-7 text-nepal-slate">{t.respondersBody}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ExternalCard label="Direct Relief" href="https://www.directrelief.org/emergency/nepal/" />
          <ExternalCard label="Oxfam" href="https://www.oxfam.org/en/nepal" />
          <ExternalCard label="CARE" href="https://www.care.org/our-work/where-we-work/nepal/" />
          <ExternalCard label="UNICEF" href="https://www.unicef.org/nepal/" />
        </div>
      </section>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
      <h1 className="text-2xl font-bold tracking-display text-nepal-ink">{title}</h1>
      <p className="mt-3 leading-7 text-nepal-slate">{children}</p>
    </section>
  );
}

function ExternalCard({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-14 items-center justify-between gap-3 border border-nepal-line bg-nepal-mist px-4 py-3 font-semibold text-nepal-blue transition hover:border-nepal-crimson hover:bg-white hover:text-nepal-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
    >
      {label}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

function hasCoordinates(location: NamedLocation): location is NamedLocation & {
  centroid: { type: "Point"; coordinates: [number, number] };
} {
  return Array.isArray(location.centroid?.coordinates) && location.centroid.coordinates.length === 2;
}

function locationValue(location: PersonRecord["rescued_location"], language: Language) {
  if (!location) return null;
  if (typeof location === "string") return location;
  return textForLanguage(location, language);
}
