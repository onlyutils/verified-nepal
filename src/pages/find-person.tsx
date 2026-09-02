import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { labels, textForLanguage } from "@/i18n";
import { formStrings } from "@/i18n/forms";
import { rescueApiBase, useLiveData } from "@/lib/live";
import { formatDateTime, formatNumber, matchesPerson, messageText, officialRescueUrl } from "@/lib/format";
import type { Language, MissingPersonRecord, PersonRecord, Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";

type Result = { kind: "rescued"; person: PersonRecord } | { kind: "missing"; person: MissingPersonRecord };

async function fetchMissingPeople(signal: AbortSignal) {
  let next: string | null = `${rescueApiBase}missing-persons/`;
  const results: MissingPersonRecord[] = [];
  while (next) {
    const response = await fetch(next, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) throw new Error("Missing records unavailable");
    const page = (await response.json()) as { results: MissingPersonRecord[]; next: string | null };
    results.push(...page.results);
    next = page.next;
  }
  return results;
}

async function fetchRescuedPeople(signal: AbortSignal) {
  const response = await fetch("/data/rescued-persons.json", { signal });
  if (!response.ok) throw new Error("Rescued records unavailable");
  return ((await response.json()) as { results: PersonRecord[] }).results;
}

export function FindPerson({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const ts = formStrings[language];
  const liveData = useLiveData();
  const [query, setQuery] = useState(() => sessionStorage.getItem("vn:search-prefill") ?? "");
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem("vn:search-prefill") ?? "");
  const [rescued, setRescued] = useState<PersonRecord[] | null>(null);
  const [missing, setMissing] = useState<MissingPersonRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [rescuedError, setRescuedError] = useState(false);
  const [missingError, setMissingError] = useState(false);
  const searched = searchQuery.trim().length >= 2;

  useEffect(() => sessionStorage.removeItem("vn:search-prefill"), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!searched) {
      setRescued(null);
      setMissing(null);
      setRescuedError(false);
      setMissingError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.allSettled([fetchRescuedPeople(controller.signal), fetchMissingPeople(controller.signal)]).then((results) => {
        if (cancelled || controller.signal.aborted) return;
        const rescuedResult = results[0];
        const missingResult = results[1];
        setRescued(rescuedResult.status === "fulfilled" ? rescuedResult.value : []);
        setMissing(missingResult.status === "fulfilled" ? missingResult.value : []);
        setRescuedError(rescuedResult.status === "rejected");
        setMissingError(missingResult.status === "rejected");
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery, searched]);

  const results = useMemo<Result[]>(() => {
    if (!searched) return [];
    const found: Result[] = [];
    for (const person of missing ?? []) if (matchesPerson(person, searchQuery)) found.push({ kind: "missing", person });
    for (const person of rescued ?? []) if (matchesPerson(person, searchQuery)) found.push({ kind: "rescued", person });
    return found.slice(0, 50);
  }, [missing, searchQuery, rescued, searched]);
  const disclaimers = liveData.messages.map((message) => messageText(message, language)).filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={ts.officialRecordsEyebrow} title={t.searchTitle} description={t.searchIntro} />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(query);
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="person-search">{ts.searchPersonLabel}</Label>
              <div className="relative">
                <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="person-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={ts.searchPersonPlaceholder}
                  autoComplete="off"
                  className="min-h-11 pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground">{ts.searchPersonHint}</p>
            </div>
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              <Search aria-hidden="true" />
              {ts.searchPersonSearch}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-live="polite" aria-busy={loading} className="space-y-4">
        {!searched ? <EmptyState icon={Search} title={ts.searchPersonIdle} /> : null}
        {loading ? <LoadingState label={ts.searchPersonLoading} /> : null}
        {rescuedError ? (
          <Alert variant="destructive">
            <AlertDescription>{ts.searchPersonRescuedSourceError}</AlertDescription>
          </Alert>
        ) : null}
        {missingError ? (
          <Alert variant="destructive">
            <AlertDescription>{ts.searchPersonMissingSourceError}</AlertDescription>
          </Alert>
        ) : null}
        {searched && !loading && results.length === 0 ? (
          <EmptyState icon={Search} title={ts.searchPersonNoResults.replace("{query}", searchQuery.trim())} />
        ) : null}
        {searched && results.length > 0 ? (
          <>
            <p role="status" className="text-sm font-medium text-muted-foreground">
              {ts.searchPersonResults.replace("{count}", formatNumber(results.length, language))}
            </p>
            <Card className="overflow-hidden">
              <div className="divide-y md:hidden">
                {results.map((result) => (
                  <PersonRow key={`${result.kind}-${result.person.id}`} result={result} language={language} />
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.search}</TableHead>
                      <TableHead>{t.age}</TableHead>
                      <TableHead>{ts.giveHelpStatus}</TableHead>
                      <TableHead>{ts.searchPersonLocation}</TableHead>
                      <TableHead>{ts.searchPersonDate}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <PersonTableRow key={`${result.kind}-${result.person.id}`} result={result} language={language} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        ) : null}
      </section>

      <SituationTables language={language} />

      <aside className="border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-primary">{t.officialDisclaimer}</p>
        <p className="mt-2 text-foreground">{t.absenceNote}</p>
        {(disclaimers.length ? disclaimers : [t.dataSourceBody]).map((message, index) => (
          <p key={`${message}-${index}`} className="mt-2">
            {message}
          </p>
        ))}
      </aside>
      <Button asChild variant="outline">
        <a href={officialRescueUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" />
          {ts.searchPersonOfficialSource}
        </a>
      </Button>
      <Button type="button" variant="link" onClick={() => navigate("missing")} className="ml-2">
        {t.missingGuideLink}
      </Button>
    </div>
  );
}

function SituationTables({ language }: { language: Language }) {
  const t = labels[language];
  const liveData = useLiveData();
  const missing = liveData.missingCount === null ? t.unavailable : formatNumber(liveData.missingCount, language);
  const value = (number: number | null | undefined) =>
    number === null || number === undefined ? t.unavailable : formatNumber(number, language);
  const total = Math.max(liveData.statusCounts.total_count, 1);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-2xl font-bold tracking-tight">{t.byTheNumbers}</h2>
          <Table className="mt-4">
            <TableBody>
              <TableRow>
                <TableCell>{t.rescuedStatus}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(liveData.rescuedStatistics.rescued_count, language)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t.missing}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-destructive">{missing}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t.outOfReach}</TableCell>
                <TableCell className="text-right tabular-nums">{value(liveData.rescuedStatistics.out_of_reach)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t.forceDeployed}</TableCell>
                <TableCell className="text-right tabular-nums">{value(liveData.rescuedStatistics.force_deployed)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t.verifiedRecords}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatNumber(liveData.statusCounts.total_count, language)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-2xl font-bold tracking-tight">{t.statusOfRecords}</h2>
          <Table className="mt-4">
            <TableBody>
              {liveData.statusCounts.status_counts.map((status) => {
                const percent = (status.count / total) * 100;
                return (
                  <TableRow key={status.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="h-2 flex-1 rounded-full bg-secondary">
                          <span className="block h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </span>
                        <StatusBadge tone={toneForStatus(status.id === 4 ? "verified" : status.title)}>
                          {textForLanguage(status, language)}
                        </StatusBadge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(status.count, language)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function displayName(result: Result, language: Language) {
  const person = result.person;
  return language === "ne" ? person.name_ne || person.name || person.display_name : person.name || person.name_ne || person.display_name;
}
function statusFor(result: Result, language: Language) {
  if (result.kind === "missing") return { label: labels[language].missing, tone: "danger" as const };
  const status = result.person.status;
  return status
    ? { label: textForLanguage(status, language), tone: toneForStatus(status.id === 4 ? "verified" : status.title) }
    : { label: labels[language].unavailable, tone: "neutral" as const };
}
function locationFor(result: Result, language: Language) {
  if (result.kind === "missing") return result.person.last_contact || labels[language].unavailable;
  const location = result.person.rescued_location;
  return location ? (typeof location === "string" ? location : textForLanguage(location, language)) : labels[language].unavailable;
}
function dateFor(result: Result, language: Language) {
  const value = result.kind === "missing" ? result.person.reported_at : result.person.rescued_date;
  return value ? formatDateTime(value, language) : labels[language].unavailable;
}

function PersonRow({ result, language }: { result: Result; language: Language }) {
  const t = labels[language];
  const status = statusFor(result, language);
  return (
    <article className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{displayName(result, language)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.person.age === null ? t.unavailable : formatNumber(result.person.age, language)} · {locationFor(result, language)}
          </p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      <p className="text-sm text-muted-foreground">{dateFor(result, language)}</p>
    </article>
  );
}
function PersonTableRow({ result, language }: { result: Result; language: Language }) {
  const t = labels[language];
  const status = statusFor(result, language);
  return (
    <TableRow>
      <TableCell className="font-medium">{displayName(result, language)}</TableCell>
      <TableCell className="tabular-nums">
        {result.person.age === null ? t.unavailable : formatNumber(result.person.age, language)}
      </TableCell>
      <TableCell>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </TableCell>
      <TableCell>{locationFor(result, language)}</TableCell>
      <TableCell className="whitespace-nowrap">{dateFor(result, language)}</TableCell>
    </TableRow>
  );
}
