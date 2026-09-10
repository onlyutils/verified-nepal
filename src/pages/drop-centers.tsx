import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, LoaderCircle, MapPin, Phone } from "lucide-react";
import { floodReliefStrings } from "@/i18n/flood-relief";
import { districtLabels } from "@/lib/districts";
import type { Language, Page } from "@/lib/types";
import type { ReliefCenter, ReliefCenterCategory, ReliefDataset } from "@/types/relief-center";
import reliefDataJson from "@/data/relief-centers.json";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { categoryColors, drawReliefCentersList, drawReliefCentersSummary, FloodReliefMap } from "@/components/flood-relief-map";
import { Eyebrow } from "@/components/page-header";
import { ShareButton } from "@/components/share-button";
import { StatusBadge } from "@/components/status-badge";

const reliefData = reliefDataJson as ReliefDataset;
const categories: ReliefCenterCategory[] = ["public_dropoff", "coordinating_office", "incoming_international_staging", "volunteer_dropoff"];
const itemSections = ["shelter", "kitchen", "hygiene", "light", "food"] as const;
const categoryLabelKeys = {
  public_dropoff: "dropoffPoint",
  coordinating_office: "coordinatingOffice",
  incoming_international_staging: "incomingInternationalStaging",
  volunteer_dropoff: "volunteerDropoff",
} as const;

export function googleMapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function DropCenters({ language, navigate }: { language: Language; navigate: (page: Page, sectionId?: string) => void }) {
  void navigate;
  const strings = floodReliefStrings[language];
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState<ReliefCenterCategory | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const districts = useMemo(() => [...new Set(reliefData.centers.map((center) => center.district))].sort(), []);
  const filtered = useMemo(
    () => reliefData.centers.filter((center) => (!district || center.district === district) && (!category || center.category === category)),
    [category, district],
  );
  const unlocatedCount = filtered.filter((center) => center.lat === null || center.lng === null).length;
  const selectedCenter = filtered.find((center) => center.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !selectedCenter) setSelectedId(null);
  }, [selectedCenter, selectedId]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-6">
        <header>
          <Eyebrow className="mb-1">{strings.eyebrow}</Eyebrow>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">{reliefData.meta.event}</h1>
          <p className="mt-1 max-w-2xl text-base text-muted-foreground">
            <span className="block">{strings.lead}</span>
            <span className="mt-1 block text-sm">
              {strings.lastVerified}: <strong className="text-foreground">{reliefData.meta.last_verified}</strong>
            </span>
          </p>
        </header>

        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:items-end">
            <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold" htmlFor="drop-centers-district">
              {strings.districtLabel}
              <NativeSelect id="drop-centers-district" value={district} onChange={(event) => setDistrict(event.target.value)}>
                <NativeSelectOption value="">{strings.allDistricts}</NativeSelectOption>
                {districts.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {districtLabel(name, language)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold" htmlFor="drop-centers-category">
              {strings.categoryLabel}
              <NativeSelect
                id="drop-centers-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as ReliefCenterCategory | "")}
              >
                <NativeSelectOption value="">{strings.allCategories}</NativeSelectOption>
                {categories.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {strings[categoryLabelKeys[value]]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="relative isolate min-w-0">
        <Suspense fallback={<LoadingState label={strings.mapCaption} />}>
          <FloodReliefMap centers={filtered} language={language} selectedId={selectedId} onSelect={setSelectedId} />
        </Suspense>
        <ReliefCenterPanel
          centers={filtered}
          language={language}
          selectedCenter={selectedCenter}
          unlocatedCount={unlocatedCount}
          onBack={() => setSelectedId(null)}
          onSelect={setSelectedId}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <ShareButton
          filename="drop-centers.png"
          headline={reliefData.meta.event}
          subline={strings.downloadSubline.replace("{count}", String(filtered.length))}
          footnote={reliefData.meta.disclaimer}
          draw={(ctx, box) => drawReliefCentersSummary(ctx, box, { centers: filtered, language })}
          labels={{ download: strings.downloadImage, share: strings.shareImage, exportError: strings.exportError }}
        />
        <ReliefCentersListDownload
          centers={filtered}
          language={language}
          event={reliefData.meta.event}
          title={strings.reliefCenters}
          subline={strings.downloadSubline.replace("{count}", String(filtered.length))}
        />
      </div>

      <ItemsNeeded language={language} />
      <OtherWaysToHelp language={language} />
      <HoldingCenters language={language} />
      <p className="border-t pt-5 text-xs leading-5 text-muted-foreground">
        <span className="font-semibold text-foreground">{strings.disclaimerLabel}:</span> {reliefData.meta.disclaimer}
      </p>
    </div>
  );
}

function ReliefCentersListDownload({
  centers,
  language,
  event,
  title,
  subline,
}: {
  centers: ReliefCenter[];
  language: Language;
  event: string;
  title: string;
  subline: string;
}) {
  const strings = floodReliefStrings[language];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const downloadList = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await drawReliefCentersList({ event, title, subline, centers, language });
      if (result === "failed") setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div aria-busy={busy}>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void downloadList()}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          {strings.downloadList}
        </Button>
      </div>
      {failed ? (
        <Alert variant="destructive">
          <AlertDescription>{strings.exportError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ReliefCenterPanel({
  centers,
  language,
  selectedCenter,
  unlocatedCount,
  onBack,
  onSelect,
}: {
  centers: ReliefCenter[];
  language: Language;
  selectedCenter: ReliefCenter | null;
  unlocatedCount: number;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const strings = floodReliefStrings[language];

  return (
    <Card className="mt-4 min-w-0 max-w-full overflow-hidden lg:absolute lg:bottom-12 lg:right-3 lg:top-3 lg:z-[1001] lg:mt-0 lg:flex lg:h-auto lg:w-80 lg:flex-col lg:shadow-lg">
      {selectedCenter ? (
        <>
          <div className="border-b p-2">
            <Button type="button" variant="ghost" className="min-h-11 max-w-full" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              <span className="truncate">{strings.backToList}</span>
            </Button>
          </div>
          <div className="min-h-0 overflow-x-hidden overflow-y-auto lg:flex-1">
            <ReliefCenterDetails center={selectedCenter} language={language} />
          </div>
        </>
      ) : (
        <>
          <CardHeader className="gap-1 border-b p-4">
            <CardTitle className="text-lg">{strings.reliefCenters}</CardTitle>
            <p className="text-sm text-muted-foreground" role="status">
              {centers.length} {strings.centersShown}
            </p>
          </CardHeader>
          <div className="min-h-0 max-h-[32rem] overflow-x-hidden overflow-y-auto lg:flex-1 lg:max-h-none">
            {unlocatedCount ? (
              <Alert className="m-3 mb-0">
                <MapPin aria-hidden="true" />
                <AlertDescription>{strings.noConfirmedLocation.replace("{count}", String(unlocatedCount))}</AlertDescription>
              </Alert>
            ) : null}
            {centers.length ? (
              <div className="divide-y">
                {centers.map((center) => (
                  <ReliefCenterRow key={center.id} center={center} language={language} onSelect={onSelect} />
                ))}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState title={strings.noCenters} description={strings.noCentersDescription} />
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function ReliefCenterRow({ center, language, onSelect }: { center: ReliefCenter; language: Language; onSelect: (id: string) => void }) {
  const strings = floodReliefStrings[language];
  const secondaryLine = center.run_by || center.note || strings.noAdditionalInfo;

  return (
    <button
      type="button"
      className="flex min-h-20 w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      onClick={() => onSelect(center.id)}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary"
        style={{ color: categoryColors[center.category] }}
        aria-hidden="true"
      >
        <MapPin className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{center.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{center.name_np}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {districtLabel(center.district, language)} · {strings[categoryLabelKeys[center.category]]}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground" title={secondaryLine}>
          {secondaryLine}
        </span>
      </span>
    </button>
  );
}

function ReliefCenterDetails({ center, language }: { center: ReliefCenter; language: Language }) {
  const strings = floodReliefStrings[language];
  const categoryVariant =
    center.category === "public_dropoff"
      ? "success"
      : center.category === "coordinating_office"
        ? "info"
        : center.category === "incoming_international_staging"
          ? "warning"
          : "secondary";
  return (
    <>
      <CardHeader className="gap-3 p-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="break-words text-lg leading-snug">{center.name}</CardTitle>
            <p className="mt-1 break-words text-sm text-muted-foreground">{center.name_np}</p>
          </div>
          <Badge variant={categoryVariant} className="max-w-full whitespace-normal text-left">
            {strings[categoryLabelKeys[center.category]]}
          </Badge>
        </div>
        {center.confidence !== "high" ? (
          <StatusBadge tone="warning">{center.confidence === "medium" ? strings.mediumConfidence : strings.lowConfidence}</StatusBadge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4 pt-0">
        {center.hours ? <InfoLine label={strings.hours} value={center.hours} /> : null}
        <InfoLine label={strings.runBy} value={center.run_by} />
        {center.contacts.some((contact) => contact.phone) ? (
          <div>
            <p className="text-sm font-semibold">{strings.contact}</p>
            <div className="mt-2 flex flex-col gap-2">
              {center.contacts.map((contact) =>
                contact.phone ? (
                  <a
                    key={`${contact.name}-${contact.phone}`}
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-11 w-full max-w-full flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Phone aria-hidden="true" />
                    <span className="break-words">{contact.name}</span>
                    <span className="break-words tabular-nums">{contact.phone}</span>
                  </a>
                ) : null,
              )}
            </div>
          </div>
        ) : null}
        {center.accepts?.length ? <BadgeList label={strings.accepts} values={center.accepts} /> : null}
        {center.serves_districts?.length ? (
          <BadgeList label={strings.servesDistricts} values={center.serves_districts.map((name) => districtLabel(name, language))} />
        ) : null}
        {center.lat !== null && center.lng !== null ? (
          <Button asChild variant="outline" className="w-full">
            <a href={googleMapsDirectionsUrl(center.lat, center.lng)} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" />
              {strings.getDirections}
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">{strings.noMapLocation}</p>
        )}
        {center.note ? <InfoLine label={strings.note} value={center.note} /> : null}
      </CardContent>
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="break-words text-sm leading-6">
      <span className="font-semibold">{label}:</span> <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function BadgeList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="max-w-full whitespace-normal break-words text-left">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ItemsNeeded({ language }: { language: Language }) {
  const strings = floodReliefStrings[language];
  const labels = { shelter: strings.shelter, kitchen: strings.kitchen, hygiene: strings.hygiene, light: strings.light, food: strings.food };
  return (
    <details open className="group rounded-xl border bg-secondary">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <span>{strings.itemsNeededTitle}</span>
        <span aria-hidden="true" className="text-xl text-primary transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t px-5 pb-5 pt-4">
        <p className="text-sm text-muted-foreground">{strings.itemsNeededLead}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {itemSections.map((section) => (
            <div key={section}>
              <h3 className="font-semibold">{labels[section]}</h3>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                {reliefData.items_needed[section].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function OtherWaysToHelp({ language }: { language: Language }) {
  const strings = floodReliefStrings[language];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{strings.otherWaysTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {reliefData.other_ways_to_help.map((way) => (
          <div key={way.name} className="flex flex-col gap-1">
            <p className="font-semibold">{way.name}</p>
            <p className="text-sm text-muted-foreground">{way.note}</p>
            {way.url ? (
              <Button asChild variant="link" className="h-auto min-h-11 w-fit px-0">
                <a href={way.url} target="_blank" rel="noopener noreferrer">
                  {strings.officialPortal} <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
        ))}
        <div className="border-t pt-5">
          <h3 className="font-semibold">{strings.cashDonationTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {strings.cashDonationNote} {reliefData.cash_donation.note}
          </p>
          <Button asChild variant="link" className="h-auto min-h-11 w-fit px-0">
            <a href={reliefData.cash_donation.official_portal} target="_blank" rel="noopener noreferrer">
              {strings.officialPortal} <ExternalLink aria-hidden="true" />
            </a>
          </Button>
          <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            <span className="font-semibold">{strings.fakeQrWarning}: </span>
            {reliefData.cash_donation.warning}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HoldingCenters({ language }: { language: Language }) {
  const strings = floodReliefStrings[language];
  const holding = reliefData.nuwakot_holding_centers;
  return (
    <details open className="rounded-xl border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        {strings.holdingCentersTitle}
        <span aria-hidden="true" className="text-xl text-primary">
          +
        </span>
      </summary>
      <div className="border-t px-5 pb-5 pt-4">
        <p className="text-sm text-muted-foreground">
          {strings.holdingCentersNote} {holding.note}
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          {holding.venues.map((venue) => (
            <li key={venue} className="rounded-md bg-secondary px-3 py-2">
              {venue}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function districtLabel(name: string, language: Language) {
  return districtLabels[name as keyof typeof districtLabels]?.[language] ?? name;
}
