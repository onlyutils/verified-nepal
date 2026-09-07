import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDroneBoard, listIncidents, type DroneBoardResponse, type DronePayloadRequest, type Incident } from "@/lib/api";
import { loadSelectedIncidentId } from "@/lib/incidents";
import { districtLabels } from "@/lib/geo";
import { goodsLabel } from "@/lib/goods";
import { formatDateTime } from "@/lib/format-date";
import { droneStrings } from "@/i18n/drones";
import type { Language } from "@/lib/types";

function incidentLabel(incident: Incident, language: Language) {
  return language === "ne" && incident.nameNe ? incident.nameNe : incident.name;
}

function requestItems(request: DronePayloadRequest, language: Language) {
  return request.items.map((item) => `${goodsLabel(item.category, language)} ${item.qty} ${item.unit}`).join(", ");
}

function statusLabel(status: string, t: Record<string, string>) {
  return t[status] ?? status;
}

function permitLabel(status: string, t: Record<string, string>) {
  return status === "none" ? t.permitNone : status === "applied" ? t.permitApplied : status === "granted" ? t.permitGranted : status;
}

function surfaceLabel(surface: string, t: Record<string, string>) {
  return t[`surface${surface[0].toUpperCase()}${surface.slice(1)}`] ?? surface;
}

export function Drones({ language }: { language: Language }) {
  const t = droneStrings[language];
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentId, setIncidentId] = useState(loadSelectedIncidentId() ?? "");
  const [board, setBoard] = useState<DroneBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listIncidents("active")
      .then((response) => {
        setIncidents(response.items);
        if (!incidentId && response.items[0]) setIncidentId(response.items[0].id);
      })
      .catch(() => setError(t.error));
  }, [incidentId, t.error]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getDroneBoard(incidentId || undefined)
      .then(setBoard)
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [incidentId, t.error]);

  const flights = useMemo(() => [...(board?.flights ?? [])].sort((a, b) => a.etd.localeCompare(b.etd)), [board?.flights]);
  const districtLabel = (district: string) => districtLabels[district as keyof typeof districtLabels]?.[language] ?? district;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader title={t.title} description={t.intro} />
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-xl space-y-2">
            <Label htmlFor="drone-incident">{t.incident}</Label>
            <NativeSelect id="drone-incident" value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
              <NativeSelectOption value="">{t.selectIncident}</NativeSelectOption>
              {incidents.map((incident) => (
                <NativeSelectOption key={incident.id} value={incident.id}>
                  {incidentLabel(incident, language)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading && !board ? <LoadingState label={t.loading} /> : null}
      {board ? (
        <>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t.openRequests}</h2>
            {board.requests.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {board.requests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-base">{request.municipality ?? request.municipalityId} · {t.ward} {request.ward}</CardTitle>
                        <CardDescription>{districtLabel(request.district)}</CardDescription>
                      </div>
                      <StatusBadge tone={request.priority === "urgent" ? "danger" : "info"}>
                        {request.priority === "urgent" ? t.priorityUrgent : t.priorityNormal}
                      </StatusBadge>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p><span className="font-medium">{t.items}:</span> {requestItems(request, language)}</p>
                      <p><span className="font-medium">{t.weight}:</span> {request.weightKg} {t.kg}</p>
                      <p><span className="font-medium">{t.window}:</span> {formatDateTime(request.windowStart, language)} {t.to} {formatDateTime(request.windowEnd, language)}</p>
                      <p><span className="font-medium">{t.coldChain}:</span> {request.coldChain ? t.coldChainYes : t.coldChainNo}</p>
                      {request.assignedOrgName ? <p className="font-medium">{t.assignedTo.replace("{org}", request.assignedOrgName)}</p> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <EmptyState title={t.noRequests} />}
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t.landingSites}</h2>
            {board.sites.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {board.sites.map((site) => (
                  <Card key={site.id}>
                    <CardHeader><CardTitle className="text-base">{site.name}</CardTitle><CardDescription>{site.municipality ?? site.municipalityId} · {t.ward} {site.ward}</CardDescription></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p><span className="font-medium">{t.surface}:</span> {surfaceLabel(site.surface, t)}</p>
                      <p><span className="font-medium">{t.clearance}:</span> {site.clearanceM} {t.meters}</p>
                      <a className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=&mlon=#map=15/${site.lat}/${site.lng}`}>{t.map}</a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <EmptyState title={t.noSites} />}
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t.operators}</h2>
            {board.operators.length ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {board.operators.map((operator) => (
                  <Card key={operator.id}>
                    <CardHeader><CardTitle className="text-base">{operator.orgName}</CardTitle><CardDescription>{operator.aircraft}</CardDescription></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p><span className="font-medium">{t.payload}:</span> {operator.payloadKg} {t.kg}</p>
                      <p><span className="font-medium">{t.range}:</span> {operator.rangeKm} {t.km}</p>
                      <p><span className="font-medium">{t.base}:</span> {districtLabel(operator.baseDistrict)}</p>
                      <p><span className="font-medium">{t.permit}:</span> {permitLabel(operator.permitStatus, t)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <EmptyState title={t.noOperators} />}
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t.flights}</h2>
            {flights.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader><TableRow><TableHead>{t.time}</TableHead><TableHead>{t.district}</TableHead><TableHead>{t.organization}</TableHead><TableHead>{t.aircraft}</TableHead><TableHead>{t.status}</TableHead></TableRow></TableHeader>
                  <TableBody>{flights.map((flight) => <TableRow key={flight.id}><TableCell>{formatDateTime(flight.etd, language)}</TableCell><TableCell>{districtLabel(flight.district)}</TableCell><TableCell>{flight.org}</TableCell><TableCell>{flight.operatorAircraft}</TableCell><TableCell><StatusBadge tone={toneForStatus(flight.status)}>{statusLabel(flight.status, t)}</StatusBadge></TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            ) : <EmptyState title={t.noFlights} />}
          </section>
        </>
      ) : null}
    </div>
  );
}
