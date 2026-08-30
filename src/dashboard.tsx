import { ArrowUpRight, Activity, ExternalLink, PhoneCall, Search, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { openChatWidget } from "./chat-widget";
import { data } from "./data";
import { helplines } from "./helplines";
import { labels, textForLanguage } from "./i18n";
import { LiveStatusBadge, useLiveData } from "./live";
import { RegionSelect } from "./region";
import type { Language, OpmcmGovernmentEffort, OpmcmStats } from "./types";
import { opmcmAskHelpUrl, opmcmMissingPersonUrl, opmcmUpdatesUrl, pmdrfUrl, pmoAppealUrl } from "./urls";
import { formatDateTime, formatNumber, messageText, sentenceCase } from "./utils";
import { Panel, SourceCaption } from "./ui";
import { AffectedLocations, ReliefMap } from "./relief-map";

const statusColors = ["#003893", "#DC143C", "#0F766E", "#B45309"];

export function Dashboard({ language }: { language: Language }) {
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

export function EmergencyContacts({ language }: { language: Language }) {
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

export function DonateCta({ language }: { language: Language }) {
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
