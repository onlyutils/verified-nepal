import { ExternalLink, Pencil, QrCode, Warehouse } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { districtLabels } from "@/lib/geo";
import { goodsLabel } from "@/lib/goods";
import { fillTemplate } from "@/lib/edition";
import { CENTER_STATUSES, type CenterPrivate } from "@/lib/api";
import { CenterLedger } from "./center-ledger";
import { statusTone } from "./use-org";
import type { OrgController } from "./org-types";

function statusLabel(status: string, t: Record<string, string>) {
  return status === "open" ? t.centerStatusOpen : status === "paused" ? t.centerStatusPaused : t.centerStatusClosed;
}

export function Centers({ controller }: { controller: OrgController }) {
  const { selectedCenterId, centers, t, language } = controller;
  const selectedCenter = centers.find((center) => center.id === selectedCenterId) ?? null;
  if (selectedCenter) return <CenterLedger controller={controller} center={selectedCenter} />;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        eyebrow={t.navCenters}
        title={t.orgCentersTitle}
        description={t.centersDescription}
        actions={
          controller.isOwner ? (
            <Button onClick={controller.openAddCenter}>
              <Warehouse />
              {t.orgAddCenter}
            </Button>
          ) : null
        }
      />
      {controller.loadingCenters ? (
        <LoadingState label={t.orgDashboardLoading} />
      ) : controller.centersError ? (
        <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive" role="alert">
          {controller.centersError}
        </p>
      ) : !centers.length ? (
        <EmptyState
          icon={Warehouse}
          title={t.orgCentersEmpty}
          action={controller.isOwner ? <Button onClick={controller.openAddCenter}>{t.orgAddCenter}</Button> : null}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {centers.map((center) => (
            <CenterCard key={center.id} center={center} controller={controller} />
          ))}
        </div>
      )}
    </div>
  );
}

function CenterCard({ center, controller }: { center: CenterPrivate; controller: OrgController }) {
  const { t, language } = controller;
  const district = districtLabels[center.district as keyof typeof districtLabels]?.[language] ?? center.district;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate">{center.name}</CardTitle>
          <CardDescription className="mt-1">
            {center.ward ? fillTemplate(t.centerDistrictWard, { district, ward: String(center.ward) }) : district}
          </CardDescription>
        </div>
        <StatusBadge tone={statusTone(center.status)}>{statusLabel(center.status, t)}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>{center.address}</p>
          {center.hours ? (
            <p className="text-muted-foreground">
              <span className="font-medium">{t.centerHours}:</span> {center.hours}
            </p>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.centerAccepts}</p>
          <div className="flex flex-wrap gap-2">
            {center.accepts.map((item) => (
              <Badge key={item} variant="secondary">
                {goodsLabel(item, language)}
              </Badge>
            ))}
          </div>
        </div>
        {controller.centerStatusError[center.id] ? (
          <p className="text-sm text-destructive" role="alert">
            {controller.centerStatusError[center.id]}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {controller.isOwner ? (
            <NativeSelect
              aria-label={t.centerStatusUpdate}
              value={center.status}
              onChange={(event) => void controller.changeCenterStatus(center, event.target.value as typeof center.status)}
              disabled={Boolean(controller.centerStatusUpdating[center.id])}
              className="min-w-40 sm:w-auto"
            >
              {CENTER_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {statusLabel(status, t)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : null}
          <Button variant="outline" onClick={() => controller.openQr(center)}>
            <QrCode />
            {t.showQr}
          </Button>
          {controller.isOwner ? (
            <Button variant="outline" onClick={() => controller.openEditCenter(center)}>
              <Pencil />
              {t.editCenter}
            </Button>
          ) : null}
          <Button onClick={() => controller.setSelectedCenterId(center.id)}>
            <ExternalLink />
            {t.openLedger}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
