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
import { export3wUrl, getCoverage, listIncidents, type CoverageRow, type Incident } from "@/lib/api";
import { loadSelectedIncidentId } from "@/lib/incidents";
import { formatDateTime } from "@/lib/format-date";
import type { Language } from "@/lib/types";

export function Coverage({ language }: { language: Language }) {
  const t = coverageStrings[language];
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentId, setIncidentId] = useState<string>(loadSelectedIncidentId() ?? "");
  const [district, setDistrict] = useState("");
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
  const incidentLabel = (incident: Incident) => language === "ne" && incident.nameNe ? incident.nameNe : incident.name;
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
      {data ? <p className="text-sm text-muted-foreground">{t.generatedAt.replace("{time}", formatDateTime(data.generatedAt, language))}</p> : null}
    </div>
  );
}
