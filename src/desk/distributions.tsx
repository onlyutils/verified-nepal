import { useState } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { distributionStrings } from "@/i18n/distributions";
import { goodsLabel } from "@/lib/goods";
import type { Distribution } from "@/lib/api";
import type { DeskModel } from "./use-desk";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";

function statusTone(status: Distribution["status"]) {
  if (status === "completed") return "done" as const;
  if (status === "acknowledged") return "info" as const;
  if (status === "cancelled") return "danger" as const;
  return toneForStatus(status);
}

function statusLabel(t: Record<string, string>, status: Distribution["status"]) {
  return t[status] ?? status;
}

function transportLabel(t: Record<string, string>, transport: Distribution["transport"]) {
  const labels: Record<Distribution["transport"], string> = {
    vehicle: t.transportVehicle,
    drone: t.transportDrone,
    porter: t.transportPorter,
    helicopter: t.transportHelicopter,
    other: t.transportOther,
  };
  return labels[transport];
}

function ackRoleLabel(t: Record<string, string>, role?: string) {
  return role === "admin" ? t.roleAdmin : role === "moderator" ? t.roleModerator : (role ?? t.acknowledgement);
}

function DistributionCard({
  model,
  distribution,
  onAcknowledge,
}: {
  model: DeskModel;
  distribution: Distribution;
  onAcknowledge: (item: Distribution) => void;
}) {
  const t = distributionStrings[model.language];
  const items = distribution.items.map((item) => `${goodsLabel(item.category, model.language)} ${item.qty} ${item.unit}`).join("; ");
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">
            {distribution.plannedDate} · {distribution.municipality ?? distribution.municipalityId}
          </CardTitle>
          <CardDescription>
            {distribution.district} · {t.wards}: {distribution.wards.join(", ")} · {t.transport}:{" "}
            {transportLabel(t, distribution.transport)}
          </CardDescription>
        </div>
        <StatusBadge tone={statusTone(distribution.status)}>{statusLabel(t, distribution.status)}</StatusBadge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-medium">{t.items}:</span> {items}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={`/org?org=${encodeURIComponent(distribution.orgId)}`}
          >
            <ExternalLink />
            {t.orgLink}: {distribution.orgName}
          </a>
          {distribution.ackBy ? (
            <p className="text-sm text-muted-foreground">{t.acknowledgedBy.replace("{role}", ackRoleLabel(t, distribution.ackBy.role))}</p>
          ) : null}
        </div>
        {distribution.status === "planned" ? (
          <Button className="self-start" size="sm" onClick={() => onAcknowledge(distribution)}>
            {t.acknowledge}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DistributionGroup({
  model,
  items,
  onAcknowledge,
}: {
  model: DeskModel;
  items: Distribution[];
  onAcknowledge: (item: Distribution) => void;
}) {
  const t = distributionStrings[model.language];
  if (!items.length) return <SectionEmpty icon={ClipboardList} title={t.deskEmpty} />;
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <DistributionCard key={item.id} model={model} distribution={item} onAcknowledge={onAcknowledge} />
      ))}
    </div>
  );
}

export function Distributions({ model }: { model: DeskModel }) {
  const t = distributionStrings[model.language];
  const [target, setTarget] = useState<Distribution | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const planned = model.distributions.filter((item) => item.status === "planned");
  const acknowledged = model.distributions.filter((item) => item.status === "acknowledged");
  const completed = model.distributions.filter((item) => item.status === "completed");
  const save = async () => {
    if (!target) return;
    setSaving(true);
    await model.handleDistributionAck(target.id, note.trim() || undefined);
    setSaving(false);
    setTarget(null);
    setNote("");
  };
  return (
    <SectionFrame title={t.title} description={t.deskDescription} refresh={() => void model.loadDistributions()} refreshLabel={t.refresh}>
      {model.distributionsError ? (
        <SectionError message={model.distributionsError} retry={() => void model.loadDistributions()} retryLabel={t.refresh} />
      ) : null}
      {model.distributionsLoading ? (
        <SectionLoading label={t.loading} />
      ) : (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{t.plannedList}</h3>
            <DistributionGroup
              model={model}
              items={planned}
              onAcknowledge={(item) => {
                setTarget(item);
                setNote("");
              }}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{t.acknowledgedList}</h3>
            <DistributionGroup model={model} items={acknowledged} onAcknowledge={() => undefined} />
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">{t.completedList}</h3>
            <DistributionGroup model={model} items={completed} onAcknowledge={() => undefined} />
          </section>
        </div>
      )}
      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.acknowledgeTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="distribution-ack-note">{t.acknowledgeNote}</Label>
            <Textarea id="distribution-ack-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              {t.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={saving || model.distributionActionLoading === target?.id}>
              {t.acknowledgeSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionFrame>
  );
}
