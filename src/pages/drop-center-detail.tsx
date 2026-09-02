import { useEffect, useState } from "react";
import { ApiError, declareDonation, flagCenter, getCenter, type CenterDetailResponse } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { centerStrings } from "@/i18n/centers";
import { districtLabels } from "@/lib/geo";
import { GOODS_CATEGORIES, goodsLabel, unitLabel } from "@/lib/goods";
import { fillTemplate } from "@/lib/edition";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { CodeDisplay } from "@/components/code-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TurnstileWidget } from "@/components/turnstile";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
function statusLabel(status: CenterDetailResponse["status"], language: Language) {
  const s = centerStrings[language];
  return status === "open" ? s.statusOpen : status === "paused" ? s.statusPaused : s.statusClosed;
}
function entryLabel(entry: CenterDetailResponse["recent"][number], language: Language) {
  const s = centerStrings[language];
  if (entry.entryType === "intake") return s.activityIntake;
  if (entry.entryType === "distribution") return s.activityDistribution;
  if (entry.entryType === "transfer_out")
    return fillTemplate(s.activityTransferOut, { destination: entry.destinationLabel || s.activityTransferOut });
  if (entry.entryType === "transfer_in") return fillTemplate(s.activityTransferIn, { source: entry.sourceLabel || s.activityTransferIn });
  return communityStrings[language].centerCorrection;
}
function dateLabel(value: string, language: Language) {
  return new Date(value).toLocaleString(language === "ne" ? "ne-NP" : "en-US");
}

export function DropCenterDetail({ language, navigate, id }: { language: Language; navigate: (page: Page) => void; id: string }) {
  const t = communityStrings[language];
  const s = centerStrings[language];
  const [data, setData] = useState<CenterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropRef, setDropRef] = useState<string | null>(null);
  const [dropCategory, setDropCategory] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [dropNote, setDropNote] = useState("");
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropToken, setDropToken] = useState("");
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagToken, setFlagToken] = useState("");
  const load = async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setData(await getCenter(id));
    } catch (cause) {
      const api = cause as ApiError;
      if (api.status === 404) setNotFound(true);
      else setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, language]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("drop") === "1") setDropOpen(true);
  }, []);
  const declare = async (event: React.FormEvent) => {
    event.preventDefault();
    const qty = Number(dropQty);
    if (
      !dropCategory ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      qty > 1000000 ||
      !/^\d+(\.\d{1,2})?$/.test(dropQty.trim()) ||
      dropNote.length > 500
    ) {
      setDropError(s.dropValidationQty);
      return;
    }
    setDropSubmitting(true);
    setDropError(null);
    try {
      const result = await declareDonation(id, {
        category: dropCategory,
        qty,
        note: dropNote.trim() || undefined,
        turnstileToken: dropToken || undefined,
      });
      setDropRef(result.ref);
    } catch (cause) {
      setDropError(apiErrorMessage(cause, language));
    } finally {
      setDropSubmitting(false);
    }
  };
  const report = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!flagReason || flagDetails.length > 500) {
      setFlagError(s.reportValidationReason);
      return;
    }
    setFlagSubmitting(true);
    setFlagError(null);
    try {
      await flagCenter(id, {
        reason: flagReason as "not_real" | "closed" | "misuse" | "other",
        details: flagDetails.trim() || undefined,
        turnstileToken: flagToken || undefined,
      });
      setFlagSuccess(true);
      setFlagOpen(false);
    } catch (cause) {
      setFlagError(apiErrorMessage(cause, language));
    } finally {
      setFlagSubmitting(false);
    }
  };
  if (loading) return <LoadingState label={t.centersLoading} />;
  if (notFound)
    return (
      <EmptyState
        title={s.centerNotFoundTitle}
        description={s.centerNotFoundBody}
        action={<Button onClick={() => navigate("dropCenters")}>{s.backToCenters}</Button>}
      />
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error || t.centersError}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={() => navigate("dropCenters")}>
          {s.backToCenters}
        </Button>
      </div>
    );
  const district = districtLabels[data.district as keyof typeof districtLabels]?.[language] ?? data.district;
  const accepted = data.accepts.length ? data.accepts : GOODS_CATEGORIES.map((item) => item.id);
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Button variant="link" className="h-auto min-h-11 px-0" onClick={() => navigate("dropCenters")}>
        ← {s.backToCenters}
      </Button>
      <PageHeader
        eyebrow={t.dropCentersEyebrow}
        title={data.name}
        description={`${data.address} · ${data.ward ? fillTemplate(s.districtWard, { district, ward: String(data.ward) }) : district}${data.hours ? ` · ${s.hoursLabel}: ${data.hours}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.org.status === "verified" ? "info" : "outline"}>
              {data.org.status === "verified" ? s.tierSelfDeclared : t.centerUnverified}
            </Badge>
            <span className="text-sm text-muted-foreground">{data.org.name}</span>
            <StatusBadge tone={toneForStatus(data.status === "paused" ? "limited" : data.status)}>
              {statusLabel(data.status, language)}
            </StatusBadge>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`tel:${data.contactPhone}`}
          className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold underline-offset-4 hover:underline"
        >
          {s.phoneLabel}: {data.contactPhone}
        </a>
        {data.status === "open" ? <Button onClick={() => setDropOpen(true)}>{t.centerDrop}</Button> : null}
        {flagSuccess ? (
          <Alert>
            <AlertDescription>{t.centerReportSuccess}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.centerStock}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.stock.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{s.acceptsLabel}</TableHead>
                    <TableHead>{t.donationQuantity}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stock.map((item) => (
                    <TableRow key={item.category}>
                      <TableCell>{goodsLabel(item.category, language)}</TableCell>
                      <TableCell>
                        {item.qty} {unitLabel(item.unit, language)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title={t.centerStockEmpty} />
            )}
            <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{t.centerStockNote}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.centerActivity}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent.length ? (
              <ul className="divide-y rounded-lg border">
                {data.recent.map((entry) => (
                  <li
                    key={entry.id}
                    className={`space-y-1 px-4 py-4 ${entry.correctedByEntryId ? "text-muted-foreground line-through" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{entryLabel(entry, language)}</span>
                      <span className="text-sm">
                        {goodsLabel(entry.category, language)} · {entry.qty} {unitLabel(entry.unit, language)}
                      </span>
                      {entry.correctedByEntryId ? <Badge variant="outline">{t.centerCorrected}</Badge> : null}
                      {entry.discrepancy ? (
                        <span className="text-sm text-destructive">
                          {fillTemplate(t.centerDiscrepancy, { value: String(entry.discrepancy), unit: unitLabel(entry.unit, language) })}
                        </span>
                      ) : null}
                    </div>
                    {entry.transferStatus ? (
                      <p className="text-sm text-muted-foreground">
                        {entry.transferStatus === "in_transit" ? t.centerInTransit : t.centerReceived}
                      </p>
                    ) : null}
                    <time className="block text-sm text-muted-foreground" dateTime={entry.createdAt}>
                      {dateLabel(entry.createdAt, language)}
                    </time>
                    {entry.note ? <p className="text-sm text-muted-foreground">{entry.note}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t.centerActivityEmpty} />
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.centerReportTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {!flagOpen ? (
            <Button variant="secondary" onClick={() => setFlagOpen(true)}>
              {t.centerReportOpen}
            </Button>
          ) : (
            <form onSubmit={report} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="center-flag-reason">{s.reportReasonLabel}</Label>
                <NativeSelect id="center-flag-reason" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} required>
                  <NativeSelectOption value="">{s.reportReasonSelect}</NativeSelectOption>
                  <NativeSelectOption value="not_real">{s.reportReasonNotReal}</NativeSelectOption>
                  <NativeSelectOption value="closed">{s.reportReasonClosed}</NativeSelectOption>
                  <NativeSelectOption value="misuse">{s.reportReasonMisuse}</NativeSelectOption>
                  <NativeSelectOption value="other">{s.reportReasonOther}</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="center-flag-details">{s.reportDetailsLabel}</Label>
                <Textarea
                  id="center-flag-details"
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </div>
              {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setFlagToken} /> : null}
              {flagError ? (
                <Alert variant="destructive">
                  <AlertDescription>{flagError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={flagSubmitting}>
                  {flagSubmitting ? s.reportSubmitting : t.centerReportSubmit}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFlagOpen(false)}>
                  {s.dropCancel}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={dropOpen}
        onOpenChange={(open) => {
          setDropOpen(open);
          if (!open) {
            setDropRef(null);
            setDropError(null);
          }
        }}
      >
        <DialogContent>
          {dropRef ? (
            <>
              <DialogHeader>
                <DialogTitle>{t.centerDropCode}</DialogTitle>
              </DialogHeader>
              <CodeDisplay code={dropRef} kind="ref" label={t.centerDropCode} />
              <p className="text-sm text-muted-foreground">{t.centerDropKeep}</p>
              <DialogFooter>
                <Button onClick={() => setDropOpen(false)}>{t.centerDropDone}</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={declare} className="space-y-5">
              <DialogHeader>
                <DialogTitle>{t.centerDropTitle}</DialogTitle>
                <DialogDescription>{t.centerDropDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="drop-category">{s.dropCategoryLabel}</Label>
                <NativeSelect id="drop-category" value={dropCategory} onChange={(e) => setDropCategory(e.target.value)} required>
                  <NativeSelectOption value="">{s.dropCategorySelect}</NativeSelectOption>
                  {accepted.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {goodsLabel(category, language)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drop-quantity">{s.dropQtyLabel}</Label>
                <Input
                  id="drop-quantity"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  value={dropQty}
                  onChange={(e) => setDropQty(e.target.value)}
                  required
                />
                <p className="text-sm text-muted-foreground">{s.dropQtyHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drop-note">{s.dropNoteLabel}</Label>
                <Textarea id="drop-note" value={dropNote} onChange={(e) => setDropNote(e.target.value)} maxLength={500} rows={3} />
              </div>
              {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setDropToken} /> : null}
              {dropError ? (
                <Alert variant="destructive">
                  <AlertDescription>{dropError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDropOpen(false)}>
                  {s.dropCancel}
                </Button>
                <Button type="submit" disabled={dropSubmitting}>
                  {dropSubmitting ? s.dropSubmitting : s.dropSubmit}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
