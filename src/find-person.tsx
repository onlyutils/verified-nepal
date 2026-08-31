import { useEffect, useMemo, useState } from "react";
import { data } from "./data";
import { labels, textForLanguage } from "./i18n";
import { fetchMissingPersons, useLiveData } from "./live";
import type { Language, MissingPersonRecord, PersonRecord } from "./types";
import { opmcmMissingPersonUrl } from "./urls";
import { formatNumber, matchesPerson, messageText, officialRescueUrl, sentenceCase } from "./utils";
import { Byline, Headline, officialLink, Rule, SectionLabel, SquareButton, Standfirst, StatusMark } from "./ui";

type PersonSearchResult =
  | { kind: "rescued"; person: PersonRecord }
  | { kind: "missing"; person: MissingPersonRecord };

export function FindPerson({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();
  // Initializer stays pure (StrictMode runs it twice); the key is cleared on mount instead.
  const [query, setQuery] = useState(() => sessionStorage.getItem("vn:search-prefill") ?? "");
  useEffect(() => {
    sessionStorage.removeItem("vn:search-prefill");
  }, []);
  const [persons, setPersons] = useState<PersonRecord[] | null>(null);
  const [missingPersons, setMissingPersons] = useState<MissingPersonRecord[] | null>(null);
  const [rescuedLoading, setRescuedLoading] = useState(false);
  const [missingLoading, setMissingLoading] = useState(false);
  const [rescuedError, setRescuedError] = useState(false);
  const [missingError, setMissingError] = useState(false);
  const normalizedQuery = query.trim();
  const searched = normalizedQuery.length >= 2;

  useEffect(() => {
    // Guard on data only: putting the loading flag in the deps re-ran this effect and its
    // cleanup set `cancelled` before the fetch resolved, so results were always discarded.
    if (!searched || persons || rescuedError) return;
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
  }, [persons, rescuedError, searched]);

  useEffect(() => {
    if (!searched || missingPersons || missingError) return;
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
  }, [missingError, missingPersons, searched]);

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
    <div className="space-y-8">
      <section aria-labelledby="search-heading">
        <SectionLabel as="p">{t.missingPersonsLabel}</SectionLabel>
        <Headline level={2} as="h1" id="search-heading" className="mt-4">
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
            {rescuedError ? <p className="font-sans text-sm font-semibold text-red">{t.errorVerifiedRecords}</p> : null}
            {missingError ? <p className="font-sans text-sm font-semibold text-red">{t.errorMissingRecords}</p> : null}
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
            ) : !anyLoading && (persons || missingPersons) ? (
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
            className={`mt-2 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${officialLink} focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper`}
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
            className={`mt-1 inline-flex min-h-11 items-center font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${officialLink} focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper`}
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

