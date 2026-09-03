import { useMemo, useState } from "react";
import { climateData, type CountryClimate } from "@/lib/climate-data";
import { climateStrings } from "@/i18n/climate";
import type { Language } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, SectionHeader } from "@/components/page-header";

const TOP_N = 15;

function formatNumber(value: number | null, digits = 4) {
  if (value === null || value === undefined) return null;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function RankRow({
  rank,
  country,
  maxWarming,
  unit,
  shareLabel,
  highlight = false,
}: {
  rank: number;
  country: CountryClimate;
  maxWarming: number;
  unit: string;
  shareLabel: string;
  highlight?: boolean;
}) {
  const widthPct = maxWarming > 0 ? Math.max(2, (country.warming_c / maxWarming) * 100) : 0;
  return (
    <div className={`space-y-1 rounded-lg px-2 py-1.5 ${highlight ? "bg-accent" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">
          {rank}. {country.name}
        </span>
        <span className="whitespace-nowrap text-muted-foreground">
          {formatNumber(country.warming_c)} {unit} · {formatNumber(country.share_pct, 2)}% {shareLabel}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">
        {label}
        {note ? <span className="ml-1 italic">({note})</span> : null}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TrendChart({ years, values, unit }: { years: number[]; values: (number | null)[]; unit: string }) {
  const width = 640;
  const height = 160;
  const padding = 8;
  const points = years.map((year, i) => ({ year, value: values[i] }));
  const known = points.filter((p): p is { year: number; value: number } => p.value !== null);
  if (known.length < 2) return null;

  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const maxValue = Math.max(...known.map((p) => p.value), 0);
  const minValue = Math.min(...known.map((p) => p.value), 0);
  const range = maxValue - minValue || 1;

  const x = (year: number) => padding + ((year - minYear) / (maxYear - minYear || 1)) * (width - padding * 2);
  const y = (value: number) => height - padding - ((value - minValue) / range) * (height - padding * 2);

  const path = known.map((p) => `${x(p.year)},${y(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label={`${minYear}–${maxYear} trend`}>
      <polyline points={path} fill="none" stroke="rgb(var(--primary))" strokeWidth={2} />
      <text x={padding} y={height - 2} className="fill-muted-foreground text-[10px]">
        {minYear}
      </text>
      <text x={width - padding} y={height - 2} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {maxYear} · {formatNumber(known[known.length - 1].value)} {unit}
      </text>
    </svg>
  );
}

export function ClimatePage({ language }: { language: Language }) {
  const t = climateStrings[language];
  const { countries, timeseries, meta } = climateData;
  const [selectedIso3, setSelectedIso3] = useState("NPL");

  const top = useMemo(() => countries.slice(0, TOP_N), [countries]);
  const maxWarming = top[0]?.warming_c ?? 1;
  const nepalIndex = useMemo(() => countries.findIndex((c) => c.iso3 === "NPL"), [countries]);
  const nepal = nepalIndex >= 0 ? countries[nepalIndex] : undefined;
  const nepalInTop = nepalIndex >= 0 && nepalIndex < TOP_N;

  const sortedByName = useMemo(() => [...countries].sort((a, b) => a.name.localeCompare(b.name)), [countries]);
  const selected = countries.find((c) => c.iso3 === selectedIso3);
  const selectedSeries = timeseries.series[selectedIso3];

  const dateLocale = language === "ne" ? "ne-NP" : "en-GB";

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
        <SectionHeader title={t.rankingTitle} aside={`${t.rankingSubtitle} (${meta.latest_year})`} />
        <Card>
          <CardContent className="space-y-2 pt-6">
            {top.map((country, i) => (
              <RankRow
                key={country.iso3}
                rank={i + 1}
                country={country}
                maxWarming={maxWarming}
                unit={t.unitCelsius}
                shareLabel={t.shareOfGlobal}
                highlight={country.iso3 === "NPL"}
              />
            ))}
            {!nepalInTop && nepal ? (
              <>
                <p className="border-t pt-3 text-xs text-muted-foreground">{t.nepalHighlightNote}</p>
                <RankRow
                  rank={nepalIndex + 1}
                  country={nepal}
                  maxWarming={maxWarming}
                  unit={t.unitCelsius}
                  shareLabel={t.shareOfGlobal}
                  highlight
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <SectionHeader title={t.exploreTitle} />
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="climate-country">{t.countryPickerLabel}</Label>
              <NativeSelect id="climate-country" value={selectedIso3} onChange={(e) => setSelectedIso3(e.target.value)}>
                {sortedByName.map((country) => (
                  <NativeSelectOption key={country.iso3} value={country.iso3}>
                    {country.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            {selected ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile label={t.statsWarmingLabel} value={`${formatNumber(selected.warming_c)} ${t.unitCelsius}`} />
                  <StatTile label={t.statsShareLabel} value={`${formatNumber(selected.share_pct, 2)}%`} note={t.calculatedLabel} />
                  <StatTile
                    label={t.statsCumulativeLabel}
                    value={selected.cumulative_pg_co2e100 !== null ? `${formatNumber(selected.cumulative_pg_co2e100)} ${t.unitPgCo2e100}` : t.notAvailable}
                  />
                  <StatTile label={t.statsCo2Label} value={selected.co2_c !== null ? `${formatNumber(selected.co2_c)} ${t.unitCelsius}` : t.notAvailable} />
                  <StatTile label={t.statsCh4Label} value={selected.ch4_c !== null ? `${formatNumber(selected.ch4_c)} ${t.unitCelsius}` : t.notAvailable} />
                  <StatTile label={t.statsN2oLabel} value={selected.n2o_c !== null ? `${formatNumber(selected.n2o_c)} ${t.unitCelsius}` : t.notAvailable} />
                  <StatTile
                    label={t.statsFossilLabel}
                    value={selected.fossil_c !== null ? `${formatNumber(selected.fossil_c)} ${t.unitCelsius}` : t.notAvailable}
                  />
                  <StatTile
                    label={t.statsLulucfLabel}
                    value={selected.lulucf_c !== null ? `${formatNumber(selected.lulucf_c)} ${t.unitCelsius}` : t.notAvailable}
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">{t.trendTitle}</p>
                  {selectedSeries ? (
                    <TrendChart years={timeseries.years} values={selectedSeries} unit={t.unitCelsius} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t.trendMissingNote}{" "}
                      <a href={meta.source.record_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                        {t.sourceLink}
                      </a>
                    </p>
                  )}
                </div>
              </>
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
