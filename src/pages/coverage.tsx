import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { coverageStrings } from "@/i18n/coverage";
import { districtLabels } from "@/lib/geo";
import { ddmcLogUrl, export3wUrl, getCoverage, listIncidents, type CoverageRow, type Incident } from "@/lib/api";
import { loadSelectedIncidentId } from "@/lib/incidents";
import { formatDateTime } from "@/lib/format-date";
import { districtNames } from "@/lib/districts";
import type { Language } from "@/lib/types";

export function Coverage({ language }: { language: Language }) {
  const t = coverageStrings[language];
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentId, setIncidentId] = useState<string>(loadSelectedIncidentId() ?? "");
  const [district, setDistrict] = useState("");
  const [ddmcDistrict, setDdmcDistrict] = useState("");
  const [ddmcDate, setDdmcDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ generatedAt: string; rows: CoverageRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listIncidents("active")
      .then((response) => {
        setIncidents(response.items);
        if (!incidentId && response.items[0]) setIncidentId(response.items[0].id);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  useEffect(() => {
    if (!incidentId) return;
    setData(null);
    setError(null);
    void getCoverage(incidentId)
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [incidentId]);

  const rows = (data?.rows ?? []).filter((row) => !district || row.district === district);
  const districts = [...new Set((data?.rows ?? []).map((row) => row.district))];
  const days = (iso: string | null) =>
    iso === null
      ? t.never
      : (() => {
          const n = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
          return n <= 0 ? t.today : t.daysAgo.replace("{n}", String(n));
        })();
  const rowClassName = (row: CoverageRow) => {
    if (row.lastDeliveredAt === null) return "bg-destructive/5";
    if ((Date.now() - Date.parse(row.lastDeliveredAt)) / 86400000 > 7) return "bg-warning/10";
    return "";
  };
  const incidentLabel = (incident: Incident) => (language === "ne" && incident.nameNe ? incident.nameNe : incident.name);
  const districtLabel = (value: string) => districtLabels[value as keyof typeof districtLabels]?.[language] ?? value;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader title={t.title} description={t.intro} />
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="coverage-incident">{t.incident}</Label>
            <NativeSelect id="coverage-incident" value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
              {incidents.map((incident) => (
                <NativeSelectOption key={incident.id} value={incident.id}>
                  {incidentLabel(incident)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverage-district">{t.district}</Label>
            <NativeSelect id="coverage-district" value={district} onChange={(event) => setDistrict(event.target.value)}>
              <NativeSelectOption value="">{t.allDistricts}</NativeSelectOption>
              {districts.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {districtLabel(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {incidentId ? (
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <a
                href={export3wUrl(incidentId, "csv")}
                download
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {t.download} · {t.csv}
              </a>
              <a
                href={export3wUrl(incidentId, "geojson")}
                download
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                {t.download} · {t.geojson}
              </a>
            </div>
          ) : null}
          <div className="flex flex-col gap-4 border-t pt-4 sm:col-span-2 lg:col-span-4">
            <div>
              <h2 className="text-base font-semibold">{t.ddmcDownloadTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.ddmcDownloadDescription}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ddmc-district">{t.ddmcDistrict}</Label>
                <NativeSelect id="ddmc-district" value={ddmcDistrict} onChange={(event) => setDdmcDistrict(event.target.value)}>
                  <NativeSelectOption value="">{t.ddmcSelectDistrict}</NativeSelectOption>
                  {districtNames.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {districtLabel(value)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ddmc-date">{t.ddmcDate}</Label>
                <input
                  id="ddmc-date"
                  type="date"
                  value={ddmcDate}
                  onChange={(event) => setDdmcDate(event.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
                />
              </div>
              <div className="flex items-end">
                {ddmcDistrict && ddmcDate ? (
                  <a
                    href={ddmcLogUrl(ddmcDistrict, ddmcDate)}
                    download
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    {t.ddmcDownload}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {data && rows.length === 0 ? <EmptyState title={t.empty} /> : null}
      {rows.length ? (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary">
                <TableHead>{t.district}</TableHead>
                <TableHead>{t.municipality}</TableHead>
                <TableHead>{t.ward}</TableHead>
                <TableHead>{t.open}</TableHead>
                <TableHead>{t.inProgress}</TableHead>
                <TableHead>{t.delivered}</TableHead>
                <TableHead>{t.lastDelivery}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.district}-${row.municipalityId ?? "none"}-${row.ward ?? "none"}`} className={rowClassName(row)}>
                  <TableCell>{districtLabel(row.district)}</TableCell>
                  <TableCell>{row.municipality ?? t.notRecorded}</TableCell>
                  <TableCell>{row.ward ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{row.open}</TableCell>
                  <TableCell className="tabular-nums">{row.matched}</TableCell>
                  <TableCell className="tabular-nums">{row.fulfilled}</TableCell>
                  <TableCell>{days(row.lastDeliveredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {data ? (
        <p className="text-sm text-muted-foreground">{t.generatedAt.replace("{time}", formatDateTime(data.generatedAt, language))}</p>
      ) : null}
    </div>
  );
}
