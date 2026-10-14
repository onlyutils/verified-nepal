import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowUpCircle,
  Camera,
  ExternalLink,
  Flame,
  HandHelping,
  Image as ImageIcon,
  Phone,
  Plus,
  Search,
  Shield,
  UserX,
} from "lucide-react";
import { openChatWidget } from "@/lib/chat-widget";
import { data } from "@/lib/data";
import { helplines } from "@/lib/helplines";
import { labels } from "@/i18n";
import { useLiveData } from "@/lib/live";
import { formatDateTime, formatNumber, messageText } from "@/lib/format";
import { officialRescueUrl } from "@/lib/format";
import { opmcmMissingPersonUrl, pmdrfUrl, pmoAppealUrl } from "@/lib/urls";
import { regionOptions } from "@/lib/region";
import { districtLabels } from "@/lib/geo";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Eyebrow, SectionHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { shellStrings } from "@/i18n/shell";
import { orgStrings } from "@/i18n/orgs";
import { posterStrings } from "@/i18n/poster";
import { listStories, type StoryPublicItem } from "@/lib/api";
import { articlesPublicStrings, storyRoleLabel } from "@/i18n/articles-public";
import { formatBsDate, formatRelativeTime } from "@/lib/format-date";
import { fillTemplate, formatEditionDate } from "@/lib/edition";
import { fetchFloodManifest, type FloodManifest } from "@/lib/flood-manifest";
import { NowStrip } from "@/components/now-strip";
import { floodReliefStrings } from "@/i18n/flood-relief";
import { floodImpactStrings } from "@/i18n/flood-impact";
import reliefData from "@/data/relief-centers.json";

const ReliefMap = lazy(() => import("@/components/relief-map").then((module) => ({ default: module.ReliefMap })));
const AffectedLocations = lazy(() => import("@/components/relief-map").then((module) => ({ default: module.AffectedLocations })));
const manifestUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FLOOD_MANIFEST_URL;
const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export function Dashboard({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const [region, setRegion] = useRegion();
  const [selected, setSelected] = useState<number | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const ts = shellStrings[language];
  const [manifest, setManifest] = useState<FloodManifest | null>(null);
  useEffect(() => {
    if (!manifestUrl) return;
    let cancelled = false;
    fetchFloodManifest(manifestUrl)
      .then((value) => {
        if (!cancelled) setManifest(value);
      })
      .catch(() => {}); // ponytail: Keep a generic CTA offline; add cached manifest metadata when the asset loader supports it.
    return () => {
      cancelled = true;
    };
  }, []);
  // ponytail: Move bilingual event names into the data files when their schema supports localized names.
  const eventName = (event: string) => ts.eventNames[event as keyof typeof ts.eventNames] ?? event;
  const imageDates = manifest?.frames.flatMap((frame) => [...(frame.beforeDateRange ?? []), ...frame.dateRange]).sort();
  const floodBody =
    manifest && imageDates?.length
      ? fillTemplate(ts.floodBody, {
          event: eventName(manifest.event),
          start: formatBsDate(imageDates[0], language),
          end: formatBsDate(imageDates[imageDates.length - 1], language),
        })
      : ts.floodBodyFallback;

  return (
    <div>
      <section className="bg-background">
        <div className={`${container} pt-4 lg:pt-6`}>
          <p className="text-xs text-muted-foreground">{formatEditionDate(new Date(), language)}</p>
        </div>
        <div className={`${container} grid items-start gap-12 pb-12 pt-4 lg:grid-cols-[440px_1fr] lg:gap-20 lg:pb-20 lg:pt-10`}>
          <div>
            <Eyebrow>{ts.landingFloodName}</Eyebrow>
            <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight text-foreground lg:text-5xl">{ts.landingTitle}</h1>
            <p className="mt-5 text-lg text-muted-foreground">{ts.heroBody}</p>
            <div className="mt-6 flex flex-col gap-3 lg:hidden sm:flex-row">
              <Button type="button" className="min-h-11 w-full" onClick={() => navigate("getHelp")}>
                {ts.needHelpCta}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => navigate("giveHelp")}>
                {ts.wantHelpCta}
              </Button>
            </div>
          </div>
          <div className="grid gap-5">
            <ActionCard language={language} kind="find" navigate={navigate} />
            <ActionCard language={language} kind="missing" navigate={navigate} />
            <ActionCard language={language} kind="poster" navigate={navigate} />
            <ActionCard language={language} kind="need" navigate={navigate} />
            <ActionCard language={language} kind="want" navigate={navigate} />
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {ts.registerOrgPrompt}
              <Button type="button" variant="link" className="h-auto min-h-11 px-2" onClick={() => navigate("registerOrg")}>
                {orgStrings[language].registerOrgCta} →
              </Button>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className={`${container} py-12 lg:py-16`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary-foreground/80">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-background animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                  {ts.reliefEyebrow}
                </span>
                <span className="inline-flex items-center rounded-full bg-background/15 px-3 py-1 text-primary-foreground">
                  {fillTemplate(ts.reliefCenterCount, { count: formatNumber(reliefData.centers.length, language) })}
                </span>
              </div>
              <h2 id="flood-relief" className="mt-4 scroll-mt-24 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {ts.reliefHeadline}
              </h2>
              <div className="mt-5 flex min-w-0 items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-background/15">
                  <HandHelping className="size-5" aria-hidden="true" />
                </span>
                <p className="max-w-2xl text-base leading-7 text-primary-foreground/85">
                  {fillTemplate(ts.reliefBody, {
                    event: eventName(reliefData.meta.event),
                    date: formatBsDate(reliefData.meta.last_verified, language),
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full border-0 bg-background text-primary hover:bg-background/90 sm:w-auto"
                onClick={() => navigate("dropCenters")}
              >
                {floodReliefStrings[language].ctaButton}
              </Button>
              <a
                href={reliefData.cash_donation.official_portal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm text-primary-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                {floodReliefStrings[language].ctaCashLink} <ExternalLink aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/50">
        <div className={`${container} py-12 lg:py-16`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Camera className="size-4" aria-hidden="true" />
                {ts.floodEyebrow}
              </div>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {floodImpactStrings[language].homeCtaHeadline}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{floodBody}</p>
            </div>
            <Button type="button" size="lg" className="w-full sm:w-auto" onClick={() => navigate("floodImpact")}>
              {floodImpactStrings[language].homeCtaButton}
            </Button>
          </div>
        </div>
      </section>

      <SituationBand language={language} />

      <section className="bg-background">
        <div className={`${container} grid gap-8 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16`}>
          <div className="min-w-0">
            <SectionHeader title={ts.findReliefTitle} />
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
              <div>
                <Label htmlFor="home-district" className="sr-only">
                  {ts.allDistricts}
                </Label>
                <NativeSelect
                  id="home-district"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  aria-label={ts.allDistricts}
                >
                  <NativeSelectOption value="">{ts.allDistricts}</NativeSelectOption>
                  {regionOptions.map((district) => (
                    <NativeSelectOption key={district} value={district}>
                      {districtLabels[district][language]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="relative">
                <Label htmlFor="location-search" className="sr-only">
                  {ts.searchPlacePlaceholder}
                </Label>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="location-search"
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  placeholder={ts.searchPlacePlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
            <Suspense
              fallback={
                <p role="status" className="mt-5 rounded-xl border px-4 py-12 text-center text-sm text-muted-foreground">
                  {shellStrings[language].loading}
                </p>
              }
            >
              <div className="mt-5">
                <AffectedLocations language={language} selected={selected} onSelect={setSelected} region={region} query={locationQuery} />
                <Button type="button" variant="link" className="mt-3 px-0" onClick={() => navigate("dropCenters")}>
                  {ts.viewAllLocations}
                </Button>
              </div>
            </Suspense>
          </div>
          <Suspense
            fallback={
              <p role="status" className="min-h-[20rem] rounded-xl border bg-secondary p-6 text-sm text-muted-foreground">
                {shellStrings[language].loading}
              </p>
            }
          >
            <ReliefMap language={language} selected={selected} onSelect={setSelected} region={region} />
          </Suspense>
        </div>
      </section>

      <NowStrip language={language} />

      <Stories language={language} />

      <section className="bg-background">
        <div className={`${container} py-12 lg:py-16`}>
          <EmergencyContacts language={language} />
          <PublicNotice language={language} />
          <AskTheDesk language={language} />
        </div>
      </section>
    </div>
  );
}

function useRegion() {
  const [region, setRegionState] = useState(() => localStorage.getItem("vn:region") || "");
  const setRegion = useCallback((nextRegion: string) => setRegionState(nextRegion), []);
  useEffect(() => {
    if (region) localStorage.setItem("vn:region", region);
    else localStorage.removeItem("vn:region");
    window.__vnRegion = region;
    window.dispatchEvent(new CustomEvent("vn:region-change", { detail: { region } }));
  }, [region]);
  return [region, setRegion] as const;
}

type ActionKind = "find" | "missing" | "poster" | "need" | "want";
function ActionCard({ language, kind, navigate }: { language: Language; kind: ActionKind; navigate: (page: Page) => void }) {
  const ts = shellStrings[language];
  const config = {
    find: {
      title: ts.findSomeone,
      description: ts.findSomeoneDescription,
      cta: ts.findSomeoneCta,
      icon: Search,
      chip: "bg-white/20",
      card: "bg-primary text-primary-foreground",
      action: () => navigate("search"),
      variant: "outline" as const,
    },
    missing: {
      title: labels[language].reportMissingPerson,
      description: ts.reportMissingDescription,
      cta: ts.reportMissingCta,
      icon: UserX,
      chip: "bg-destructive-soft text-destructive",
      card: "border-2 bg-background",
      action: undefined,
      variant: "secondary" as const,
    },
    poster: {
      title: posterStrings[language].title,
      description: ts.posterCardDescription,
      cta: ts.posterCardCta,
      icon: ImageIcon,
      chip: "bg-destructive-soft text-destructive",
      card: "border-2 bg-background",
      action: () => navigate("poster"),
      variant: "secondary" as const,
    },
    need: {
      title: labels[language].getHelp,
      description: ts.needHelpDescription,
      cta: ts.needHelpCta,
      icon: ArrowUpCircle,
      chip: "bg-accent text-primary",
      card: "border-2 bg-background",
      action: () => navigate("getHelp"),
      variant: "secondary" as const,
    },
    want: {
      title: labels[language].giveHelp,
      description: ts.wantHelpDescription,
      cta: ts.wantHelpCta,
      icon: HandHelping,
      chip: "bg-accent text-primary",
      card: "border-2 bg-background",
      action: () => navigate("giveHelp"),
      variant: "secondary" as const,
    },
  }[kind];
  const Icon = config.icon;
  return (
    <Card className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6 ${config.card}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${config.chip}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-bold">{config.title}</h3>
        <p className={`mt-1 text-sm ${kind === "find" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{config.description}</p>
      </div>
      {kind === "missing" ? (
        <Button asChild type="button" variant={config.variant} className="w-full sm:ml-auto sm:w-[212px]">
          <a href={opmcmMissingPersonUrl} target="_blank" rel="noopener noreferrer">
            {config.cta} <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant={kind === "find" ? "outline" : config.variant}
          className={`w-full sm:ml-auto sm:w-[212px] ${kind === "find" ? "border-0 bg-background text-primary hover:bg-background/90" : ""}`}
          onClick={config.action}
        >
          {config.cta}
        </Button>
      )}
    </Card>
  );
}

function SituationBand({ language }: { language: Language }) {
  const t = labels[language];
  const ts = shellStrings[language];
  const liveData = useLiveData();
  // Use the bundled figures until all NDRRMA requests succeed; partial refreshes have no reliable timestamp.
  const live = liveData.isLive && liveData.updatedAt !== null;
  const updated = live ? liveData.updatedAt : data.meta.synced_at;
  const rescuedStatistics = live ? liveData.rescuedStatistics : data.rescuedStatistics;
  const statusCounts = live ? liveData.statusCounts : data.statusCounts;
  const missing = !live || liveData.missingCount === null ? t.unavailable : formatNumber(liveData.missingCount, language);
  const camps = data.stationedLocations.results.length || data.rescuedLocations.results.length;
  return (
    <section id="current-situation" className="scroll-mt-20 bg-secondary">
      <div className={`${container} py-12 lg:py-16`}>
        <SectionHeader
          title={ts.currentSituation}
          aside={
            <span className="block text-xs leading-5 text-muted-foreground">
              {ts.sourcePrefix} <strong className="text-foreground">{ts.footerNdrRma}</strong> ·{" "}
              {fillTemplate(live ? ts.situationUpdated : ts.situationSnapshot, {
                date: formatBsDate(updated, language),
                relative: formatRelativeTime(updated, language),
              })}
            </span>
          }
        />
        <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
          <StatCard value={formatNumber(rescuedStatistics.rescued_count, language)} label={ts.peopleRescued} />
          <StatCard value={missing} label={ts.peopleMissing} tone="danger" />
          <StatCard value={formatNumber(statusCounts.total_count, language)} label={ts.verifiedRecords} />
          <div>
            <StatCard value={formatNumber(camps, language)} label={ts.activeReliefLocations} />
            {live ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {fillTemplate(ts.reliefSnapshot, { date: formatBsDate(data.meta.synced_at, language) })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-1">
          <Button asChild type="button" variant="link" className="w-fit px-0">
            <a href={officialRescueUrl} target="_blank" rel="noopener noreferrer">
              {ts.completeSituationReport} <ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <p className="text-xs text-subtle">{ts.currentSituationDisclaimer}</p>
        </div>
        <OfficialMessages language={language} />
      </div>
    </section>
  );
}

function Stories({ language }: { language: Language }) {
  const ts = shellStrings[language];
  const ta = articlesPublicStrings[language];
  const [items, setItems] = useState<StoryPublicItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {}); // ponytail: no stories yet or offline both mean "show nothing"
    return () => {
      cancelled = true;
    };
  }, []);
  if (!items.length) return null;
  return (
    <section className="bg-secondary">
      <div className={`${container} py-12 lg:py-16`}>
        <SectionHeader title={ts.storiesTitle} />
        <p className="mt-2 max-w-2xl text-muted-foreground">{ts.storiesLead}</p>
        <ul className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {items.map((item) => (
            <li key={item.id} className="w-64 shrink-0 snap-start">
              <Card className="flex h-full flex-col overflow-hidden">
                {item.media.type === "video" ? (
                  <video
                    src={item.media.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="aspect-[4/5] w-full bg-black object-cover"
                  />
                ) : (
                  <img
                    src={item.media.url}
                    alt={item.caption || `${ta.by} ${item.author.displayName}`}
                    className="aspect-[4/5] w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="space-y-2 p-4">
                  <Badge variant="outline">{storyRoleLabel(item.role, language)}</Badge>
                  <p className="line-clamp-4 text-sm leading-6">{item.caption}</p>
                  <p className="text-xs text-muted-foreground">
                    {ta.by} {item.author.displayName}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OfficialMessages({ language }: { language: Language }) {
  const messages = useLiveData()
    .messages.map((message) => messageText(message, language))
    .filter(Boolean);
  if (!messages.length) return null;
  return (
    <div className="mt-6 rounded-lg border border-primary-soft-border bg-background p-4">
      <Eyebrow>{labels[language].officialMessages}</Eyebrow>
      {messages.map((message, index) => (
        <p key={`${message}-${index}`} className="mt-2 text-sm text-foreground">
          {message}
        </p>
      ))}
    </div>
  );
}

export function EmergencyContacts({ language }: { language: Language }) {
  const t = labels[language];
  const ts = shellStrings[language];
  const primary = helplines.find((line) => line.number === "1234");
  const large = [
    helplines.find((line) => line.number === "100"),
    helplines.find((line) => line.number === "102"),
    helplines.find((line) => line.number === "101"),
  ].filter(Boolean);
  const remaining = helplines.filter((line) => !["1234", "100", "102", "101"].includes(line.number));
  return (
    <Card className="p-5 sm:p-8">
      <Eyebrow className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />
        {t.emergencyContactsTitle}
      </Eyebrow>
      <p className="mt-3 text-base text-muted-foreground">{ts.emergencyIntro}</p>
      {primary ? (
        <a
          href={`tel:${primary.number}`}
          className="mt-6 flex min-h-32 flex-wrap items-center justify-between gap-4 rounded-xl bg-foreground p-6 text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span>
            <span className="block text-xs text-faint">{ts.disasterHotlineLabel}</span>
            <span className="mt-1 block text-5xl font-bold leading-none tabular-nums">{primary.number}</span>
            <span className="mt-2 block text-xs text-faint">{ts.emergencyHours}</span>
          </span>
          <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-destructive">
            <Phone className="size-6" aria-hidden="true" />
          </span>
        </a>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {large.map((line) => {
          if (!line) return null;
          const icon = line.number === "100" ? Shield : line.number === "102" ? Plus : Flame;
          const Icon = icon;
          return (
            <a
              key={line.key}
              href={`tel:${line.number}`}
              className="flex min-h-24 flex-col items-center justify-center rounded-lg border-2 p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-2 text-2xl font-bold tabular-nums text-primary">{line.number}</span>
              <span className="text-xs text-muted-foreground">{language === "ne" ? line.labelNe : line.labelEn}</span>
            </a>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {remaining.map((line) => (
          <a
            key={line.key}
            href={`tel:${line.number}`}
            className="min-w-0 rounded-lg bg-secondary p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="block break-all font-bold tabular-nums text-destructive">{line.number}</span>
            <span className="mt-1 block text-xs font-semibold text-foreground">{language === "ne" ? line.labelNe : line.labelEn}</span>
            <span className="mt-1 block text-xs text-subtle">{hotlineNote(line.key, ts)}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}

function hotlineNote(
  key: string,
  ts: {
    hotlineNoteMohaTollFree: string;
    hotlineNoteRedCross: string;
    hotlineNoteChild: string;
    hotlineNoteTourist: string;
    hotlineNoteMoha: string;
    hotlineNoteMofa: string;
    footerOfficialLinks: string;
  },
) {
  const notes: Record<string, string> = {
    "moha-flood-control": ts.hotlineNoteMohaTollFree,
    "red-cross": ts.hotlineNoteRedCross,
    "child-helpline": ts.hotlineNoteChild,
    "tourist-police": ts.hotlineNoteTourist,
    "moha-control-landline": ts.hotlineNoteMoha,
    "mofa-foreigners": ts.hotlineNoteMofa,
  };
  return notes[key] || ts.footerOfficialLinks;
}

export function PublicNotice({ language }: { language: Language }) {
  const t = labels[language];
  const ts = shellStrings[language];
  return (
    <Card className="mt-8 p-5 sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <Eyebrow>{t.publicNotice}</Eyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{t.donateTitle}</h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">{t.donateBody}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild type="button" variant="destructive">
              <a href={pmdrfUrl} target="_blank" rel="noopener noreferrer">
                {t.donateCta} <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            <Button asChild type="button" variant="outline" className="h-auto min-h-11 whitespace-normal text-center">
              <a href={pmoAppealUrl} target="_blank" rel="noopener noreferrer">
                {t.donateVerify} <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-subtle">{t.donateWarning}</p>
        </div>
        <figure className="m-0 text-center">
          <img
            src="/brand/pmdrf-qr.svg"
            alt={`${t.donateScan} · ${ts.donateDomain}`}
            width={144}
            height={144}
            className="mx-auto size-36"
          />
          <figcaption className="mt-2 max-w-36 text-xs text-subtle">
            {t.donateScan}
            <span className="mt-1 block font-mono text-xs text-foreground">{ts.donateDomain}</span>
          </figcaption>
        </figure>
      </div>
    </Card>
  );
}

function AskTheDesk({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <section className="mt-8 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Eyebrow>{t.askTheDesk}</Eyebrow>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="text-foreground">{t.agentTitle}</strong> {t.agentBody}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={openChatWidget}>
        {t.agentCta}
      </Button>
    </section>
  );
}
