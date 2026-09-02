import { useEffect } from "react";
import { ArrowLeft, Send, Truck } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatNumber } from "@/lib/format";
import { goodsLabel, unitLabel, GOODS_CATEGORIES } from "@/lib/goods";
import { fillTemplate } from "@/lib/edition";
import type { CenterPrivate, GoodsEntry } from "@/lib/api";
import type { OrgController } from "./org-types";

function entryLabel(entry: GoodsEntry, t: Record<string, string>, controller: OrgController) {
  if (entry.entryType === "intake") return t.logEntryIntake;
  if (entry.entryType === "distribution") return t.logEntryDistribution;
  if (entry.entryType === "transfer_out")
    return t.transferSentLabel.replace(
      "{destination}",
      entry.destinationLabel ?? controller.publicCenters?.find((center) => center.id === entry.destinationCenterId)?.name ?? t.notAvailable,
    );
  if (entry.entryType === "transfer_in") return t.ledgerEntryTransferIn;
  return t.ledgerEntryCorrection;
}

function entryVariant(entry: GoodsEntry) {
  if (entry.entryType === "intake" || entry.entryType === "transfer_in") return "success" as const;
  if (entry.entryType === "distribution") return "secondary" as const;
  if (entry.entryType === "correction") return "warning" as const;
  return "outline" as const;
}

export function CenterLedger({ controller, center }: { controller: OrgController; center: CenterPrivate }) {
  const { t, language } = controller;
  useEffect(() => {
    if (!controller.stockById[center.id] && !controller.stockLoadingById[center.id]) void controller.fetchStock(center.id);
    if (!controller.entriesById[center.id] && !controller.entriesLoadingById[center.id]) void controller.fetchEntries(center.id);
    if (!controller.inboundById[center.id] && !controller.inboundLoadingById[center.id]) void controller.fetchInbound(center.id);
  }, [center.id, controller]);
  const log = controller.logFormById[center.id] ?? {
    entryType: "intake" as const,
    category: "",
    qty: "",
    note: "",
    destinationType: "center" as const,
    destinationCenterId: "",
    destinationLabel: "",
    error: null,
    fieldErrors: {},
    submitting: false,
  };
  const stock = controller.stockById[center.id] ?? [];
  const entries = controller.entriesById[center.id] ?? [];
  const inbound = controller.inboundById[center.id] ?? [];
  const updateLog = (patch: Partial<typeof log>) => controller.setLogFormById((state) => ({ ...state, [center.id]: { ...log, ...patch } }));
  const correctedIds = new Set(entries.filter((entry) => entry.correctsEntryId).map((entry) => entry.correctsEntryId));
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        as="h2"
        eyebrow={t.navCenters}
        title={center.name}
        description={t.ledgerDescription}
        actions={
          <Button variant="outline" onClick={() => controller.setSelectedCenterId(null)}>
            <ArrowLeft />
            {t.ledgerBack}
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t.stockTitle}</CardTitle>
          <CardDescription>{center.address}</CardDescription>
        </CardHeader>
        <CardContent>
          {controller.stockLoadingById[center.id] ? (
            <LoadingState label={t.orgDashboardLoading} />
          ) : controller.stockErrorById[center.id] ? (
            <p className="text-sm text-destructive" role="alert">
              {controller.stockErrorById[center.id]}
            </p>
          ) : !stock.length ? (
            <EmptyState title={t.stockEmpty} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.stockCategory}</TableHead>
                  <TableHead>{t.stockUnit}</TableHead>
                  <TableHead>{t.stockOnHand}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((item) => (
                  <TableRow key={item.category}>
                    <TableCell>{goodsLabel(item.category, language)}</TableCell>
                    <TableCell>{unitLabel(item.unit, language)}</TableCell>
                    <TableCell className="font-semibold tabular-nums">{formatNumber(item.qty, language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.logEntryTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void controller.submitEntry(center.id);
            }}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`entryType-${center.id}`}>{t.logEntryTypeLabel}</Label>
                <NativeSelect
                  id={`entryType-${center.id}`}
                  value={log.entryType}
                  onChange={(event) => {
                    const entryType = event.target.value as typeof log.entryType;
                    if (entryType === "transfer_out") void controller.loadPublicCenters();
                    updateLog({ entryType });
                  }}
                >
                  {<NativeSelectOption value="intake">{t.logEntryIntake}</NativeSelectOption>}
                  <NativeSelectOption value="distribution">{t.logEntryDistribution}</NativeSelectOption>
                  <NativeSelectOption value="transfer_out">{t.logEntryTransferOut}</NativeSelectOption>
                </NativeSelect>
                {log.fieldErrors.entryType ? (
                  <p className="text-sm text-destructive" role="alert">
                    {log.fieldErrors.entryType}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`entryCategory-${center.id}`}>{t.logEntryCategoryLabel}</Label>
                <NativeSelect
                  id={`entryCategory-${center.id}`}
                  value={log.category}
                  onChange={(event) => updateLog({ category: event.target.value })}
                >
                  <NativeSelectOption value="">{t.logEntryCategorySelect}</NativeSelectOption>
                  {GOODS_CATEGORIES.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {goodsLabel(item.id, language)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {log.fieldErrors.category ? (
                  <p className="text-sm text-destructive" role="alert">
                    {log.fieldErrors.category}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`entryQty-${center.id}`}>{t.logEntryQtyLabel}</Label>
                <Input
                  id={`entryQty-${center.id}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={log.qty}
                  onChange={(event) => updateLog({ qty: event.target.value })}
                />
                {log.fieldErrors.qty ? (
                  <p className="text-sm text-destructive" role="alert">
                    {log.fieldErrors.qty}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">{t.logEntryQtyHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`entryNote-${center.id}`}>{t.logEntryNoteLabel}</Label>
                <Textarea
                  id={`entryNote-${center.id}`}
                  value={log.note}
                  onChange={(event) => updateLog({ note: event.target.value })}
                  maxLength={500}
                  rows={2}
                />
                {log.fieldErrors.note ? (
                  <p className="text-sm text-destructive" role="alert">
                    {log.fieldErrors.note}
                  </p>
                ) : null}
              </div>
            </div>
            {log.entryType === "transfer_out" ? (
              <div className="grid gap-4 rounded-lg border bg-secondary p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`destinationType-${center.id}`}>{t.logEntryDestinationLabel}</Label>
                  <NativeSelect
                    id={`destinationType-${center.id}`}
                    value={log.destinationType}
                    onChange={(event) => {
                      const destinationType = event.target.value as typeof log.destinationType;
                      if (destinationType === "center") void controller.loadPublicCenters();
                      updateLog({ destinationType });
                    }}
                  >
                    <NativeSelectOption value="center">{t.logEntryDestinationCenterLabel}</NativeSelectOption>
                    <NativeSelectOption value="external">{t.logEntryDestinationExternalLabel}</NativeSelectOption>
                  </NativeSelect>
                </div>
                {log.destinationType === "center" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`destinationCenter-${center.id}`}>{t.logEntryDestinationCenterLabel}</Label>
                    <NativeSelect
                      id={`destinationCenter-${center.id}`}
                      value={log.destinationCenterId}
                      onChange={(event) => updateLog({ destinationCenterId: event.target.value })}
                      disabled={controller.publicCentersLoading}
                    >
                      <NativeSelectOption value="">
                        {controller.publicCentersLoading ? t.logEntryDestinationLoading : t.logEntryDestinationCenterSelect}
                      </NativeSelectOption>
                      {(controller.publicCenters ?? [])
                        .filter((item) => item.id !== center.id)
                        .map((item) => (
                          <NativeSelectOption key={item.id} value={item.id}>
                            {item.name} · {item.org.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor={`destinationLabel-${center.id}`}>{t.logEntryDestinationExternalLabel}</Label>
                    <Input
                      id={`destinationLabel-${center.id}`}
                      value={log.destinationLabel}
                      placeholder={t.logEntryDestinationExternalPlaceholder}
                      onChange={(event) => updateLog({ destinationLabel: event.target.value })}
                    />
                  </div>
                )}
                {log.fieldErrors.destination ? (
                  <p className="text-sm text-destructive sm:col-span-2" role="alert">
                    {log.fieldErrors.destination}
                  </p>
                ) : null}
              </div>
            ) : null}
            {log.error ? (
              <p className="text-sm text-destructive" role="alert">
                {log.error}
              </p>
            ) : null}
            <Button type="submit" disabled={log.submitting}>
              <Send />
              {log.submitting ? t.logEntrySubmitting : t.logEntrySubmit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.recentEntriesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {controller.entriesLoadingById[center.id] && !entries.length ? (
            <LoadingState label={t.orgDashboardLoading} />
          ) : controller.entriesErrorById[center.id] ? (
            <p className="text-sm text-destructive" role="alert">
              {controller.entriesErrorById[center.id]}
            </p>
          ) : !entries.length ? (
            <EmptyState title={t.recentEntriesEmpty} />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.ledgerEntryType}</TableHead>
                      <TableHead>{t.entryCategoryLabel}</TableHead>
                      <TableHead>{t.entryQtyLabel}</TableHead>
                      <TableHead>{t.ledgerActor}</TableHead>
                      <TableHead>{t.ledgerTime}</TableHead>
                      <TableHead>{t.ledgerDiscrepancy}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} controller={controller} corrected={correctedIds.has(entry.id)} />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} controller={controller} corrected={correctedIds.has(entry.id)} />
                ))}
              </div>
              {controller.cursorById[center.id] ? (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => void controller.fetchEntries(center.id, controller.cursorById[center.id], true)}
                  disabled={controller.entriesLoadingById[center.id]}
                >
                  {controller.entriesLoadingById[center.id] ? t.loadingShort : t.loadMore}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.inboundTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {controller.inboundLoadingById[center.id] ? (
            <LoadingState label={t.orgDashboardLoading} />
          ) : controller.inboundErrorById[center.id] ? (
            <p className="text-sm text-destructive" role="alert">
              {controller.inboundErrorById[center.id]}
            </p>
          ) : !inbound.length ? (
            <EmptyState icon={Truck} title={t.inboundEmpty} />
          ) : (
            <div className="space-y-3">
              {inbound.map((transfer) => (
                <div
                  key={transfer.transferId}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-semibold">
                      {goodsLabel(transfer.category, language)} · {formatNumber(transfer.qty, language)}{" "}
                      {unitLabel(transfer.unit, language)}
                    </p>
                    <p className="text-muted-foreground">{fillTemplate(t.inboundTransferFrom, { center: transfer.fromCenterName })}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(transfer.createdAt, language)}</p>
                  </div>
                  <Button
                    onClick={() =>
                      controller.setDialogs((state) => ({
                        ...state,
                        receive: {
                          open: true,
                          centerId: center.id,
                          transfer,
                          qtyReceived: String(transfer.qty),
                          note: "",
                          error: null,
                          submitting: false,
                        },
                      }))
                    }
                  >
                    {t.inboundConfirmButton}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EntryRow({ entry, controller, corrected }: { entry: GoodsEntry; controller: OrgController; corrected: boolean }) {
  const { t, language } = controller;
  return (
    <TableRow className={corrected ? "opacity-60" : undefined}>
      <TableCell>
        <Badge variant={entryVariant(entry)}>{entryLabel(entry, t, controller)}</Badge>
      </TableCell>
      <TableCell>{goodsLabel(entry.category, language)}</TableCell>
      <TableCell className="tabular-nums">
        {formatNumber(entry.qty, language)} {unitLabel(entry.unit, language)}
      </TableCell>
      <TableCell>{entry.createdByName ?? t.notAvailable}</TableCell>
      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(entry.createdAt, language)}</TableCell>
      <TableCell>
        {entry.discrepancy ? (
          <Badge variant="warning">
            {fillTemplate(t.inboundDiscrepancy, { value: String(entry.discrepancy), unit: unitLabel(entry.unit, language) })}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{t.ledgerNoDiscrepancy}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {!corrected && entry.entryType !== "correction" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              controller.setDialogs((state) => ({
                ...state,
                correction: { open: true, centerId: entry.centerId, entryId: entry.id, note: "", error: null, submitting: false },
              }))
            }
          >
            {t.ledgerCorrect}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function EntryCard({ entry, controller, corrected }: { entry: GoodsEntry; controller: OrgController; corrected: boolean }) {
  const { t, language } = controller;
  return (
    <div className={`space-y-2 rounded-lg border p-4 ${corrected ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entryVariant(entry)}>{entryLabel(entry, t, controller)}</Badge>
        <span className="font-medium">{goodsLabel(entry.category, language)}</span>
      </div>
      <p className="tabular-nums">
        {formatNumber(entry.qty, language)} {unitLabel(entry.unit, language)}
      </p>
      <p className="text-xs text-muted-foreground">
        {entry.createdByName ?? t.notAvailable} · {formatDateTime(entry.createdAt, language)}
      </p>
      {entry.discrepancy ? (
        <Badge variant="warning">
          {fillTemplate(t.inboundDiscrepancy, { value: String(entry.discrepancy), unit: unitLabel(entry.unit, language) })}
        </Badge>
      ) : null}
      {!corrected && entry.entryType !== "correction" ? (
        <Button
          variant="outline"
          onClick={() =>
            controller.setDialogs((state) => ({
              ...state,
              correction: { open: true, centerId: entry.centerId, entryId: entry.id, note: "", error: null, submitting: false },
            }))
          }
        >
          {t.ledgerCorrect}
        </Button>
      ) : null}
    </div>
  );
}
