import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatNumber } from "@/lib/format";
import { fillTemplate } from "@/lib/edition";
import { orgStatusLabel, statusTone } from "./use-org";
import type { OrgController } from "./org-types";

export function Overview({ controller }: { controller: OrgController }) {
  const { t, language, selectedOrg, centers, entriesById, donationsById, isOwner } = controller;
  if (!selectedOrg) return null;
  const entries = Object.values(entriesById).reduce((total, items) => total + items.length, 0);
  const donations = Object.values(donationsById).reduce((total, items) => total + items.length, 0);
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader eyebrow={t.navOverview} title={selectedOrg.name} description={t.overviewDescription} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={formatNumber(centers.length, language)} label={t.statCenters} />
        <StatCard
          value={formatNumber(centers.filter((center) => center.status === "open").length, language)}
          label={t.statOpenCenters}
          tone="primary"
        />
        <StatCard value={formatNumber(entries, language)} label={t.statEntries} />
        <StatCard value={formatNumber(donations, language)} label={t.statDonations} />
      </div>
      <p className="text-xs text-subtle">{t.statsLocalHint}</p>

      {selectedOrg.status !== "verified" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>{t.orgStatusNextTitle}</CardTitle>
              <CardDescription className="mt-2">
                {selectedOrg.status === "pending"
                  ? t.orgStatusPendingNext
                  : selectedOrg.status === "rejected"
                    ? t.orgStatusRejectedNext
                    : t.orgStatusSuspendedNext}
              </CardDescription>
            </div>
            <StatusBadge tone={statusTone(selectedOrg.status)}>{orgStatusLabel(selectedOrg, t)}</StatusBadge>
          </CardHeader>
        </Card>
      ) : null}

      {controller.queueLength > 0 ? (
        <Alert>
          <AlertTitle>
            {controller.queueLength === 1
              ? t.queueBannerOne
              : fillTemplate(t.queueBanner, { n: formatNumber(controller.queueLength, language) })}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.queueOfflineNotice}</span>
            <Button variant="outline" onClick={() => void controller.handleFlushQueue()} disabled={controller.queueFlushing}>
              {controller.queueFlushing ? t.queueRetrying : t.queueSendNow}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.orgIdTitle}</CardTitle>
            <CardDescription>{t.orgIdDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-md border bg-secondary p-3 font-mono text-sm">{selectedOrg.id}</code>
            <Button variant="outline" onClick={() => void controller.copyOrgId()}>
              {controller.copiedOrgId ? t.copied : t.copyId}
            </Button>
          </CardContent>
        </Card>
        {selectedOrg.status === "pending" ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.pendingVouchBoxTitle}</CardTitle>
              <CardDescription>{t.pendingVouchBoxBody}</CardDescription>
            </CardHeader>
          </Card>
        ) : selectedOrg.status === "verified" && isOwner ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.vouchBoxTitle}</CardTitle>
              <CardDescription>{t.vouchDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="vouchTargetId">{t.vouchInputLabel}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="vouchTargetId"
                  value={controller.vouchTargetId}
                  onChange={(event) => controller.setVouchTargetId(event.target.value)}
                  placeholder={t.vouchInputPlaceholder}
                />
                <Button onClick={() => void controller.vouch()} disabled={controller.vouchSubmitting}>
                  {controller.vouchSubmitting ? t.vouchSubmitting : t.vouchButton}
                </Button>
              </div>
              {controller.vouchError ? (
                <p className="text-sm text-destructive" role="alert">
                  {controller.vouchError}
                </p>
              ) : null}
              {controller.vouchMsg ? (
                <p className="text-sm text-success" role="status">
                  {controller.vouchMsg}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
      {selectedOrg.vouches?.length ? (
        <Card>
          <CardHeader>
            <SectionHeader title={t.vouchesLabel} />
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {selectedOrg.vouches.map((vouch) => (
                <li key={vouch.orgId}>
                  {fillTemplate(t.vouchFromAt, {
                    name: vouch.orgName,
                    date: new Date(vouch.at).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US"),
                  })}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
