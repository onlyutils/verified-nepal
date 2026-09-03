import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { climateData } from "@/lib/climate-data";
import { climateSeriesColor } from "@/lib/climate-colors";
import { climateStrings } from "@/i18n/climate";
import type { Language } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { RankingPanel } from "@/components/climate/ranking-panel";
import { MultiLineChart } from "@/components/climate/line-chart";
import { DonutChart } from "@/components/climate/donut-chart";

const MAX_COMPARE = 6;
const DEFAULT_COMPARE = ["NPL", "USA", "CHN"];

function formatNumber(value: number | null, digits = 4) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function ClimatePage({ language }: { language: Language }) {
  const t = climateStrings[language];
  const { countries, timeseries, rankingsByYear, meta } = climateData;
  const [compareIso3s, setCompareIso3s] = useState<string[]>(DEFAULT_COMPARE);
  const [logScale, setLogScale] = useState(false);
  const [addValue, setAddValue] = useState("");
  const compareRef = useRef<HTMLDivElement>(null);

  const byIso3 = useMemo(() => new Map(countries.map((c) => [c.iso3, c])), [countries]);
  const sortedByName = useMemo(() => [...countries].sort((a, b) => a.name.localeCompare(b.name)), [countries]);
  const dateLocale = language === "ne" ? "ne-NP" : "en-GB";

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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
          <p>
            {t.attributionText}{" "}
            <a href={meta.source.record_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              {t.sourceLink}
            </a>{" "}
            (
            <a href={meta.source.github_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              {t.methodologyLink}
            </a>
            ), {t.licenseNote}
          </p>
          <p className="font-medium text-foreground">{t.caveatNote}</p>
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
          strings={t}
          unit={t.unitCelsius}
        />
        <p className="text-xs text-muted-foreground">{t.clickToCompareHint}</p>
      </div>

      <div ref={compareRef} className="scroll-mt-20 space-y-3">
        <SectionHeader title={t.exploreTitle} />
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
                      <button type="button" onClick={() => removeCountry(iso3)} aria-label={`${t.removeCountry} ${byIso3.get(iso3)?.name ?? iso3}`}>
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
              {compareIso3s.length < MAX_COMPARE ? (
                <NativeSelect
                  id="climate-add-country"
                  value={addValue}
                  onChange={(e) => addCountry(e.target.value)}
                  className="max-w-xs"
                >
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

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{t.trendTitle}</p>
              <div className="flex gap-1 rounded-md border p-0.5">
                <Button type="button" size="sm" variant={logScale ? "ghost" : "default"} onClick={() => setLogScale(false)}>
                  {t.linearScaleLabel}
                </Button>
                <Button type="button" size="sm" variant={logScale ? "default" : "ghost"} onClick={() => setLogScale(true)}>
                  {t.logScaleLabel}
                </Button>
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
                <a href={meta.source.record_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                  {t.sourceLink}
                </a>
              </p>
            ) : null}

            {primary ? (
              <div className="space-y-4 border-t pt-6">
                <p className="text-sm font-medium text-foreground">
                  {primary.name} · {formatNumber(primary.warming_c)} {t.unitCelsius} ({formatNumber(primary.share_pct, 2)}% {t.calculatedLabel})
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile label={t.statsCumulativeLabel} value={primary.cumulative_pg_co2e100 !== null ? `${formatNumber(primary.cumulative_pg_co2e100)} ${t.unitPgCo2e100}` : t.notAvailable} />
                  <StatTile label={t.statsCo2Label} value={primary.co2_c !== null ? `${formatNumber(primary.co2_c)} ${t.unitCelsius}` : t.notAvailable} />
                  <StatTile label={t.statsCh4Label} value={primary.ch4_c !== null ? `${formatNumber(primary.ch4_c)} ${t.unitCelsius}` : t.notAvailable} />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.lastUpdatedLabel}: {new Date(meta.synced_at).toLocaleDateString(dateLocale, { dateStyle: "medium" })} ·{" "}
        <a href={meta.source.record_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {t.sourceLink}
        </a>{" "}
        ·{" "}
        <a href={meta.source.github_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {t.methodologyLink}
        </a>
      </p>
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
