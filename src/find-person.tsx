import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { data } from "./data";
import { labels, textForLanguage } from "./i18n";
import { useLiveData } from "./live";
import type { Language, MissingPersonRecord, PersonRecord } from "./types";
import { opmcmMissingPersonUrl } from "./urls";
import {
  formatDateTime,
  formatNumber,
  matchesPerson,
  messageText,
  officialRescueUrl,
  sentenceCase,
  statusTone,
} from "./utils";
import { Kicker } from "./ui";
import useFetchMissingPersons from "./hooks/useFetchMissingPersons";
import useFetchRescuedPersons from "./hooks/useFetchRescuedPersons";

type PersonSearchResult =
  | { kind: "rescued"; person: PersonRecord }
  | { kind: "missing"; person: MissingPersonRecord };

export function FindPerson({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const searched = normalizedQuery.length >= 2;
  const {
    data: rescuedPersons,
    isLoading: rescuedLoading,
    error: rescuedError,
  } = useFetchRescuedPersons(searched);

  const {
    data: missingPersons,
    isLoading: missingLoading,
    error: missingError,
  } = useFetchMissingPersons(searched);


  const results = useMemo(() => {
    if (!searched) return [];
    const missingResults: PersonSearchResult[] = missingPersons
      ? missingPersons
          .filter((person) => matchesPerson(person, normalizedQuery))
          .map((person) => ({ kind: "missing", person }))
      : [];
    const rescuedResults: PersonSearchResult[] = rescuedPersons
      ? rescuedPersons
          .filter((person) => matchesPerson(person, normalizedQuery))
          .map((person) => ({ kind: "rescued", person }))
      : [];
    return [...missingResults, ...rescuedResults].slice(0, 50);
  }, [missingPersons, normalizedQuery, rescuedPersons, searched]);

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
        <p className="mt-3 max-w-2xl leading-7 text-nepal-slate">
          {t.searchIntro}
        </p>
        <div className="mt-6">
          <label
            htmlFor="person-search"
            className="block text-sm font-semibold text-nepal-ink"
          >
            {t.searchLabel}
          </label>
          <div className="mt-2 flex border border-nepal-line bg-white focus-within:border-nepal-crimson focus-within:ring-2 focus-within:ring-nepal-crimson/20">
            <span
              className="flex min-h-12 items-center px-3 text-nepal-slate"
              aria-hidden="true"
            >
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
          <p className="mt-2 text-sm text-nepal-slate">
            {t.searchLanguageHint}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-nepal-slate">
              {t.reportMissingPersonHint}
            </span>
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

      {searched ? (
        <DisclaimerBlock language={language} disclaimers={disclaimers} />
      ) : null}

      <section aria-live="polite" className="space-y-4">
        {!searched ? (
          <div className="border border-dashed border-nepal-line bg-white p-6 leading-7 text-nepal-slate">
            {t.noSearch}
          </div>
        ) : (
          <>
            {rescuedError ? (
              <div className="border border-nepal-crimson bg-nepal-crimsonSoft p-4 text-sm font-semibold text-nepal-crimson">
                {t.errorVerifiedRecords}
              </div>
            ) : rescuedLoading ? (
              <div className="border border-nepal-line bg-white p-4 text-sm font-semibold text-nepal-slate">
                {t.loadingVerifiedRecords}
              </div>
            ) : null}
            {missingError ? (
              <div className="border border-nepal-crimson bg-nepal-crimsonSoft p-3 text-sm text-nepal-crimson">
                {t.errorMissingRecords}
              </div>
            ) : missingLoading ? (
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
            ) : !anyLoading && !rescuedError && !missingError ? (
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

function DisclaimerBlock({
  language,
  disclaimers,
}: {
  language: Language;
  disclaimers: string[];
}) {
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
        {(disclaimers.length ? disclaimers : [fallback]).map(
          (disclaimer, index) => (
            <p key={`${disclaimer}-${index}`}>{disclaimer}</p>
          ),
        )}
      </div>
    </aside>
  );
}

function PersonCard({
  result,
  language,
}: {
  result: PersonSearchResult;
  language: Language;
}) {
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
  const chipTone = isMissing
    ? "bg-nepal-crimson text-white ring-nepal-crimson"
    : statusTone(status?.id);

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
          value={
            person.age === null ? null : formatNumber(person.age, language)
          }
          unavailable={t.unavailable}
        />
        <RecordField
          label={t.gender}
          value={sentenceCase(person.gender)}
          unavailable={t.unavailable}
        />
        <RecordField
          label={t.nationality}
          value={sentenceCase(person.country || person.nationality)}
          unavailable={t.unavailable}
        />
        {kind === "rescued" ? (
          <>
            <RecordField
              label={t.rescuedDate}
              value={person.rescued_date}
              unavailable={t.unavailable}
            />
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
            <RecordField
              label={t.lastContact}
              value={person.last_contact}
              unavailable={t.unavailable}
            />
            <RecordField
              label={t.reportedAt}
              value={person.reported_at}
              unavailable={t.unavailable}
            />
          </>
        )}
        <RecordField
          label={t.remarks}
          value={person.remarks}
          unavailable={t.unavailable}
          wide
        />
      </dl>
      <div className="mt-6 border-t border-nepal-line pt-4 text-sm leading-6 text-nepal-slate">
        <p>
          <span className="font-semibold text-nepal-ink">{t.source}:</span>{" "}
          {t.sourceName}
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

function locationValue(
  location: PersonRecord["rescued_location"],
  language: Language,
) {
  if (!location) return null;
  if (typeof location === "string") return location;
  return textForLanguage(location, language);
}
