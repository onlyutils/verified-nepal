import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { openChatWidget } from "./chat-widget";
import { data } from "./data";
import { leadHeadline } from "./edition";
import { helplines } from "./helplines";
import { labels, textForLanguage } from "./i18n";
import { useLiveData } from "./live";

import type { Language, OpmcmGovernmentEffort, OpmcmStats, Page } from "./types";
import { Byline, Headline, officialLink, Rule, RuledTable, SectionLabel, SquareButton, Standfirst } from "./ui";
import { shellStrings } from "./i18n-shell";
import { orgStrings } from "./i18n-orgs";
import { opmcmAskHelpUrl, opmcmMissingPersonUrl, opmcmUpdatesUrl, pmdrfUrl, pmoAppealUrl } from "./urls";
import { formatDateTime, formatNumber, messageText, sentenceCase } from "./utils";

const ReliefMap = lazy(() => import("./relief-map").then((m) => ({ default: m.ReliefMap })));
const AffectedLocations = lazy(() => import("./relief-map").then((m) => ({ default: m.AffectedLocations })));

export function Dashboard({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const [region, setRegion] = useRegion();
  const [selected, setSelected] = useState<number | null>(null);

  const ts = shellStrings[language];
  return (
    <div className="space-y-10">
      <Lead language={language} navigate={navigate} />
      <Suspense fallback={<p className="min-h-[40vh] font-sans text-sm text-muted">{ts.loading}</p>}>
        <div>
          <ReliefMap language={language} selected={selected} onSelect={setSelected} region={region} onRegionChange={setRegion} />
          <AffectedLocations language={language} selected={selected} onSelect={setSelected} region={region} />
        </div>
      </Suspense>
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
  const ts = shellStrings[language];
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
        <div className="grid gap-3 sm:grid-cols-3">
          <SquareButton href="tel:1234" tone="red" className="w-full">
            {ts.call1234}
          </SquareButton>
          <SquareButton onClick={() => navigate("search")} tone="primary" className="w-full">
            {t.search}
          </SquareButton>
          <SquareButton onClick={() => navigate("getHelp")} className="w-full">
            {t.getHelp}
          </SquareButton>
        </div>
        <SectionLabel as="p" dot="blue" className="mt-6">
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
          <SquareButton onClick={() => navigate("search")} className="w-full">
            {t.search}
          </SquareButton>
          <SquareButton onClick={() => navigate("registerOrg")} className="w-full">
            {orgStrings[language].registerOrgCta}
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
        <MissingPersonsColumn language={language} />
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

function MissingPersonsColumn({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <section aria-labelledby="missing-heading">
      <SectionLabel id="missing-heading">{t.missingPersonsLabel}</SectionLabel>
      <Headline level={3} as="p" className="mt-4">
        {t.searchLead}
      </Headline>
      <p className="mt-3 font-serif text-sm italic text-muted">{t.absenceNote}</p>
      <SquareButton href={opmcmMissingPersonUrl} external tone="primary" className="mt-4">
        {t.searchByNameCta}
      </SquareButton>
      <SquareButton href={opmcmMissingPersonUrl} external className="mt-3">
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
      <SectionLabel id="updates-heading" dot="blue">
        {t.officialUpdatesPanel}
      </SectionLabel>
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
        className={`mt-3 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${officialLink} focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper`}
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
          rows={statusCounts.status_counts.map((status) => ({
            key: String(status.id),
            label: textForLanguage(status, language),
            value: (
              <>
                {formatNumber(status.count, language)}
                <span className="ml-2 font-normal text-muted">{((status.count / total) * 100).toFixed(1)}%</span>
              </>
            ),
            bar: status.count / total,
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
            rows={countryCounts.map(([country, count]) => ({
              key: country,
              label: country,
              value: formatNumber(count, language),
              bar: count / maxCountry,
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
