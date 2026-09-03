import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { climateData, climateFacts } from "@/lib/climate-data";
import { climateSeriesColor } from "@/lib/climate-colors";
import { climateStrings } from "@/i18n/climate";
import { interpolate } from "@/lib/format";
import { messageText } from "@/lib/climate-messages";
import { drawComposition, drawRankingBars, drawTrendLines } from "@/lib/climate-share";
import type { Language } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { RankingPanel } from "@/components/climate/ranking-panel";
import { MessageWall } from "@/components/climate/message-wall";
import { MultiLineChart } from "@/components/climate/line-chart";
import { DonutChart } from "@/components/climate/donut-chart";
import { ShareButton } from "@/components/climate/share-button";
import { WordCloud } from "@/components/climate/word-cloud";

const MAX_COMPARE = 6;
const DEFAULT_COMPARE = ["NPL", "USA", "CHN"];

function formatNumber(value: number | null, digits = 4) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function firstSentence(value: string) {
  const match = value.match(/^[\s\S]*?[.!?।](?:\s|$)/);
  return (match?.[0] ?? value).trim();
}

export function ClimatePage({ language }: { language: Language }) {
  const t = climateStrings[language];
  const facts = climateFacts();
  const { countries, timeseries, rankingsByYear, meta } = climateData;
  const [compareIso3s, setCompareIso3s] = useState<string[]>(DEFAULT_COMPARE);
  const [logScale, setLogScale] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const compareRef = useRef<HTMLDivElement>(null);

  const byIso3 = useMemo(() => new Map(countries.map((c) => [c.iso3, c])), [countries]);
  const sortedByName = useMemo(() => [...countries].sort((a, b) => a.name.localeCompare(b.name)), [countries]);
  const dateLocale = language === "ne" ? "ne-NP" : "en-GB";
  const pageMessage = selectedMessageId ? messageText(selectedMessageId) : undefined;

  const handleSelect = (iso3: string) => {
    setCompareIso3s((current) => [iso3, ...current.filter((c) => c !== iso3)].slice(0, MAX_COMPARE));
    compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addCountry = (iso3: string) => {
    if (!iso3 || compareIso3s.includes(iso3) || compareIso3s.length >= MAX_COMPARE) return;
    setCompareIso3s((current) => [...current, iso3]);
    setAddValue("");
  };

  const removeCountry = (iso3: string) => {
    setCompareIso3s((current) => (current.length > 1 ? current.filter((c) => c !== iso3) : current));
  };

  const primary = byIso3.get(compareIso3s[0]);
  const lineSeries = compareIso3s
    .map((iso3, i) => ({ iso3, name: byIso3.get(iso3)?.name ?? iso3, values: timeseries.series[iso3], colorIndex: i }))
    .filter((s) => s.values);
  const missingTrend = compareIso3s.filter((iso3) => !timeseries.series[iso3]);
  const latestRows = rankingsByYear.byYear[rankingsByYear.byYear.length - 1] ?? [];
  const latestTopRows = latestRows.slice(0, 15);
  const latestNepalRow = latestRows.find((row) => row.iso3 === "NPL");
  const factValues = useMemo(
    () => ({
      nepalShare: facts.nepalShare,
      nepalRank: facts.nepalRank,
      total: facts.total,
      topName: facts.top.name,
      topShare: facts.topShare,
      ratio: facts.ratio,
      lulucfPct: facts.lulucfPct,
    }),
    [facts],
  );
  const pageStrings = useMemo(
    () => ({ ...t, nepalHighlightNote: interpolate(t.nepalHighlightNote, factValues), nepalPopup: interpolate(t.nepalPopup, factValues) }),
    [factValues, t],
  );
  const pageDescription = interpolate(t.description, factValues);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={pageDescription} />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-xl font-bold text-foreground">{t.caseTitle}</h2>
          <p className="text-sm leading-6 text-foreground">{interpolate(t.caseLine1, factValues)}</p>
          <p className="text-sm leading-6 text-foreground">{t.caseLine2}</p>
          <p className="text-sm leading-6 text-foreground">{t.caseLine3}</p>
          <Button asChild type="button" variant="link" className="h-auto min-h-11 px-0">
            <a href="/">{t.caseLink}</a>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <SectionHeader title={t.rankingTitle} aside={t.rankingSubtitle} />
        <RankingPanel
          countriesLatest={countries}
          rankingsByYear={rankingsByYear}
          latestYear={meta.latest_year}
          selectedIso3={compareIso3s[0]}
          onSelect={handleSelect}
          strings={pageStrings}
          unit={t.unitCelsius}
          mapExtra={
            <ShareButton
              kind="map"
              filename="verifiednepal-climate-map.png"
              headline={t.mapLegendTitle}
              subline={firstSentence(pageDescription)}
              message={pageMessage}
              labels={{ download: t.downloadImage, share: t.shareImage, exportError: t.exportError }}
            />
          }
        />
        <div className="flex justify-end">
          <ShareButton
            kind="ranking"
            filename="verifiednepal-climate-ranking.png"
            headline={t.rankingTitle}
            subline={t.rankingSubtitle}
            message={pageMessage}
            footnote={interpolate(t.cardStat, {
              nepalShare: facts.nepalShare,
              country: facts.top.name,
              countryShare: facts.topShare,
            })}
            draw={(ctx, box) =>
              drawRankingBars(ctx, box, {
                rows: latestTopRows,
                nepal: latestNepalRow && !latestTopRows.some((row) => row.iso3 === "NPL") ? latestNepalRow : undefined,
                unit: t.unitCelsius,
              })
            }
            labels={{ download: t.downloadImage, share: t.shareImage, exportError: t.exportError }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t.clickToCompareHint}</p>
      </div>

      <div ref={compareRef} className="scroll-mt-20 space-y-3">
        <SectionHeader title={t.exploreTitle} />
        <p className="text-sm text-muted-foreground">{t.exploreDescription}</p>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <Label htmlFor="climate-add-country">{t.addCountryLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {compareIso3s.map((iso3, i) => (
                  <span
                    key={iso3}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                    style={{ borderColor: climateSeriesColor(i) }}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: climateSeriesColor(i) }} aria-hidden="true" />
                    {byIso3.get(iso3)?.name ?? iso3}
                    {compareIso3s.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeCountry(iso3)}
                        aria-label={`${t.removeCountry} ${byIso3.get(iso3)?.name ?? iso3}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
              {compareIso3s.length < MAX_COMPARE ? (
                <NativeSelect id="climate-add-country" value={addValue} onChange={(e) => addCountry(e.target.value)} className="max-w-xs">
                  <NativeSelectOption value="">{t.addCountryPlaceholder}</NativeSelectOption>
                  {sortedByName
                    .filter((c) => !compareIso3s.includes(c.iso3))
                    .map((c) => (
                      <NativeSelectOption key={c.iso3} value={c.iso3}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{t.trendTitle}</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-md border p-0.5">
                  <Button type="button" size="sm" variant={logScale ? "ghost" : "default"} onClick={() => setLogScale(false)}>
                    {t.linearScaleLabel}
                  </Button>
                  <Button type="button" size="sm" variant={logScale ? "default" : "ghost"} onClick={() => setLogScale(true)}>
                    {t.logScaleLabel}
                  </Button>
                </div>
                <ShareButton
                  kind="trend"
                  filename="verifiednepal-climate-trend.png"
                  headline={t.trendTitle}
                  subline={lineSeries.map((series) => series.name).join(" · ")}
                  message={pageMessage}
                  draw={(ctx, box) =>
                    drawTrendLines(ctx, box, { years: timeseries.years, series: lineSeries, logScale, unit: t.unitCelsius })
                  }
                  labels={{ download: t.downloadImage, share: t.shareImage, exportError: t.exportError }}
                />
              </div>
            </div>
            {lineSeries.length ? (
              <MultiLineChart
                years={timeseries.years}
                series={lineSeries}
                unit={t.unitCelsius}
                logScale={logScale}
                formatValue={(v) => formatNumber(v)}
              />
            ) : null}
            {missingTrend.length ? (
              <p className="text-sm text-muted-foreground">
                {t.trendMissingNote} {missingTrend.map((iso3) => byIso3.get(iso3)?.name ?? iso3).join(", ")} —{" "}
                <a
                  href={meta.source.record_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  {t.sourceLink}
                </a>
              </p>
            ) : null}

            {primary ? (
              <div className="space-y-4 border-t pt-6">
                <p className="text-sm font-medium text-foreground">
                  {primary.name} · {formatNumber(primary.warming_c)} {t.unitCelsius} ({formatNumber(primary.share_pct, 2)}%{" "}
                  {t.calculatedLabel})
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">{t.gasCompositionTitle}</p>
                    <DonutChart
                      centerLabel={t.unitCelsius}
                      segments={[
                        { label: t.statsCo2Label, value: primary.co2_c ?? 0, color: climateSeriesColor(0) },
                        { label: t.statsCh4Label, value: primary.ch4_c ?? 0, color: climateSeriesColor(1) },
                        { label: t.statsN2oLabel, value: primary.n2o_c ?? 0, color: climateSeriesColor(2) },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">{t.sourceCompositionTitle}</p>
                    <DonutChart
                      centerLabel={t.unitCelsius}
                      segments={[
                        { label: t.statsFossilLabel, value: primary.fossil_c ?? 0, color: climateSeriesColor(3) },
                        { label: t.statsLulucfLabel, value: primary.lulucf_c ?? 0, color: climateSeriesColor(4) },
                      ]}
                    />
                  </div>
                </div>
                <ShareButton
                  kind="composition"
                  filename="verifiednepal-climate-composition.png"
                  headline={`${primary.name} · ${t.gasCompositionTitle}`}
                  subline={t.sourceCompositionTitle}
                  message={pageMessage}
                  draw={(ctx, box) =>
                    drawComposition(ctx, box, {
                      left: {
                        title: t.gasCompositionTitle,
                        segments: [
                          { label: t.statsCo2Label, value: primary.co2_c ?? 0, color: climateSeriesColor(0) },
                          { label: t.statsCh4Label, value: primary.ch4_c ?? 0, color: climateSeriesColor(1) },
                          { label: t.statsN2oLabel, value: primary.n2o_c ?? 0, color: climateSeriesColor(2) },
                        ],
                      },
                      right: {
                        title: t.sourceCompositionTitle,
                        segments: [
                          { label: t.statsFossilLabel, value: primary.fossil_c ?? 0, color: climateSeriesColor(3) },
                          { label: t.statsLulucfLabel, value: primary.lulucf_c ?? 0, color: climateSeriesColor(4) },
                        ],
                      },
                    })
                  }
                  labels={{ download: t.downloadImage, share: t.shareImage, exportError: t.exportError }}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile
                    label={t.statsCumulativeLabel}
                    value={
                      primary.cumulative_pg_co2e100 !== null
                        ? `${formatNumber(primary.cumulative_pg_co2e100)} ${t.unitPgCo2e100}`
                        : t.notAvailable
                    }
                  />
                  <StatTile
                    label={t.statsCo2Label}
                    value={primary.co2_c !== null ? `${formatNumber(primary.co2_c)} ${t.unitCelsius}` : t.notAvailable}
                  />
                  <StatTile
                    label={t.statsCh4Label}
                    value={primary.ch4_c !== null ? `${formatNumber(primary.ch4_c)} ${t.unitCelsius}` : t.notAvailable}
                  />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader title={t.messagesTitle} />
        <p className="text-sm text-muted-foreground">{t.messagesDescription}</p>
        <Card>
          <CardContent className="pt-6">
            <MessageWall
              language={language}
              t={t}
              countries={countries}
              facts={facts}
              onSent={(messageId, iso3) => {
                setSelectedMessageId(messageId);
                setSelectedCountryIso3(iso3);
                setRefreshKey((key) => key + 1);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader title={t.cloudTitle} />
        <WordCloud
          t={t}
          language={language}
          countries={countries}
          selectedIso3={selectedCountryIso3}
          refreshKey={refreshKey}
          message={pageMessage}
        />
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6 text-xs text-muted-foreground">
          <p>{t.caveatNote}</p>
          <p>
            {t.attributionText}{" "}
            <a
              href={meta.source.record_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {t.sourceLink}
            </a>{" "}
            (
            <a
              href={meta.source.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {t.methodologyLink}
            </a>
            ), {t.licenseNote}
          </p>
          <p>
            {t.lastUpdatedLabel}: {new Date(meta.synced_at).toLocaleDateString(dateLocale, { dateStyle: "medium" })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
