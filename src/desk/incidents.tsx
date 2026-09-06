import { useState } from "react";
import { Siren } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";
import { formatDateTime } from "@/lib/format-date";

const statuses = ["pending", "active", "draft", "archived", "rejected"] as const;

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusLabel(model: DeskModel, status: string) {
  return model.ds[`deskIncidentsStatus${cap(status)}`] ?? status;
}

function originLabel(model: DeskModel, requestOrigin?: string) {
  if (requestOrigin === "community-request") return model.ds.deskIncidentsOriginCommunity;
  if (requestOrigin === "community-request-inline") return model.ds.deskIncidentsOriginInline;
  return model.ds.deskIncidentsOriginAdmin;
}

function ProofImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role="img" aria-label={alt} className="mt-2 flex aspect-video items-center justify-center rounded-lg border border-dashed bg-secondary p-4 text-center text-sm text-muted-foreground">{alt}</div>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="mt-2 aspect-video w-full rounded-lg object-cover" />;
}

function IncidentStatusActions({ model, incident }: { model: DeskModel; incident: DeskModel["incidentsAdmin"][number] }) {
  const loading = model.incidentActionLoading === incident.id;

  if (incident.status === "pending" && incident.requestOrigin === "community-request-inline") {
    return <p className="text-sm text-muted-foreground">{model.ds.deskIncidentsInlineNote}</p>;
  }

  if (incident.status === "draft") {
    return (
      <Button size="sm" disabled={loading} onClick={() => void model.handleIncidentPublish(incident.id)}>
        {model.ds.deskIncidentsPublish}
      </Button>
    );
  }

  if (incident.status === "pending" && incident.requestOrigin === "community-request") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={loading} onClick={() => model.setConfirmAction({ kind: "incident", action: "approve", id: incident.id })}>
            {model.ds.deskIncidentsApprove}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={loading}
            onClick={() => {
              model.setIncidentRejectId(incident.id);
              model.setIncidentRejectReason("");
              model.setIncidentRejectError(null);
            }}
          >
            {model.ds.deskIncidentsReject}
          </Button>
        </div>
        {model.incidentRejectId === incident.id ? (
          <div className="space-y-2">
            <Input
              value={model.incidentRejectReason}
              onChange={(event) => model.setIncidentRejectReason(event.target.value)}
              placeholder={model.ds.deskIncidentsRejectPlaceholder}
              maxLength={1000}
            />
            {model.incidentRejectError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.incidentRejectError}</AlertDescription>
              </Alert>
            ) : null}
            <Button size="sm" variant="destructive" disabled={loading} onClick={() => void model.handleIncidentReject()}>
              {model.ds.deskIncidentsReject}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (incident.status === "active") {
    return (
      <Button size="sm" variant="destructive" disabled={loading} onClick={() => model.setConfirmAction({ kind: "incident", action: "archive", id: incident.id })}>
        {model.ds.deskIncidentsArchive}
      </Button>
    );
  }

  return null;
}

function IncidentActions({ model, incident }: { model: DeskModel; incident: DeskModel["incidentsAdmin"][number] }) {
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => model.openEditIncident(incident)}>
        {model.t.deskEdit}
      </Button>
      <IncidentStatusActions model={model} incident={incident} />
    </div>
  );
}

export function Incidents({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.ds.deskIncidentsTitle}
      description={model.ds.deskIncidentsDescription}
      refresh={model.loadIncidentsAdmin}
      refreshLabel={model.ds.deskRefresh}
    >
      <Tabs value={model.incidentsAdminStatus} onValueChange={model.setIncidentsAdminStatus}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
          {statuses.map((status) => (
            <TabsTrigger key={status} value={status}>
              {statusLabel(model, status)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {model.incidentsAdminLoading ? (
        <SectionLoading label={model.ds.deskIncidentsLoading} />
      ) : model.incidentsAdminError ? (
        <SectionError message={model.incidentsAdminError} retry={model.loadIncidentsAdmin} retryLabel={model.t.deskRetry} />
      ) : !model.incidentsAdmin.length ? (
        <SectionEmpty icon={Siren} title={model.ds.deskIncidentsEmpty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {model.incidentsAdmin.map((incident) => {
            const proof = incident.proofMedia?.[0];
            return (
              <Card key={incident.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      {incident.name}
                      {incident.nameNe ? ` (${incident.nameNe})` : ""}
                    </CardTitle>
                    <StatusBadge tone={toneForStatus(incident.status)}>{statusLabel(model, incident.status)}</StatusBadge>
                  </div>
                  <CardDescription>
                    {incident.kind} · {formatDateTime(incident.startedAt, model.language)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-sm">
                    <strong>{model.ds.deskIncidentsDistricts}:</strong> {incident.affectedDistricts.join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">{originLabel(model, incident.requestOrigin)}</p>
                  {incident.summary ? <p className="whitespace-pre-wrap text-sm leading-6">{incident.summary}</p> : null}
                  {proof ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{model.ds.deskIncidentsProof}</p>
                      {proof.type === "video" ? (
                        <video src={proof.originalUrl} controls preload="metadata" className="mt-2 aspect-video w-full rounded-lg bg-black object-contain" />
                      ) : (
                        <ProofImage src={proof.originalUrl} alt={model.ds.deskIncidentsProof} />
                      )}
                    </div>
                  ) : null}
                  {incident.status === "rejected" || incident.status === "archived" ? (
                    incident.rejectionReason ? <p className="text-sm">{incident.rejectionReason}</p> : null
                  ) : null}
                  <div className="mt-auto pt-1">
                    <IncidentActions model={model} incident={incident} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SectionFrame>
  );
}
