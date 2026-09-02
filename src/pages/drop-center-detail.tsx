import { useEffect, useState } from "react";
import { ApiError, declareDonation, flagCenter, getCenter, type CenterDetailResponse } from "../api";
import { apiErrorMessage } from "../api-error";
import { centerStrings } from "../i18n-centers";
import { districtLabels } from "../geo";
import { goodsLabel, unitLabel } from "../goods";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Headline, SectionLabel, RuledTable, Rule, SquareButton, StatusMark } from "../ui";
import type { Language, Page } from "../types";
import { fillTemplate } from "../edition";
import { TurnstileWidget } from "../components/turnstile";
import { GOODS_CATEGORIES } from "../goods";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TURNSTILE_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

function tierLabel(tier: string | undefined, language: Language): string {
  const s = centerStrings[language];
  if (tier === "known") return s.tierKnown;
  if (tier === "vouched") return s.tierVouched;
  return s.tierSelfDeclared;
}

function statusTone(status: string): "published" | "pending" | "archived" {
  if (status === "open") return "published";
  if (status === "paused") return "pending";
  return "archived";
}

function statusLabel(status: string, language: Language): string {
  const s = centerStrings[language];
  if (status === "open") return s.statusOpen;
  if (status === "paused") return s.statusPaused;
  return s.statusClosed;
}

function entryLabel(entry: CenterDetailResponse["recent"][number], language: Language): string {
  const s = centerStrings[language];
  if (entry.entryType === "intake") return s.activityIntake;
  if (entry.entryType === "distribution") return s.activityDistribution;
  if (entry.entryType === "transfer_out") {
    const dest = entry.destinationLabel || entry.destinationCenterId || "";
    return fillTemplate(s.activityTransferOut, { destination: dest });
  }
  if (entry.entryType === "transfer_in") {
    const src = entry.sourceLabel || entry.sourceCenterId || "";
    return fillTemplate(s.activityTransferIn, { source: src });
  }
  if (entry.entryType === "correction") return s.activityCorrection;
  return entry.entryType;
}

export function DropCenterDetail({ language, navigate, id }: { language: Language; navigate: (page: Page) => void; id: string }) {
  const s = centerStrings[language];
  const [data, setData] = useState<CenterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // flag form state
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagTurnstileToken, setFlagTurnstileToken] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState(false);
  const [flagFieldError, setFlagFieldError] = useState<string | null>(null);

  const [dropOpen, setDropOpen] = useState(false);
  const [dropCategory, setDropCategory] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [dropNote, setDropNote] = useState("");
  const [dropTurnstileToken, setDropTurnstileToken] = useState("");
  const [dropSubmitting, setDropSubmitting] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [dropRef, setDropRef] = useState<string | null>(null);
  const [dropCopied, setDropCopied] = useState(false);
  const [dropFieldError, setDropFieldError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    getCenter(id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setNotFound(true);
        } else {
          setError(apiErrorMessage(e, language));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, language]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("drop") === "1") setDropOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const handleDeclare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropCategory) {
      setDropFieldError(s.dropValidationCategory);
      return;
    }
    const qtyNum = Number(dropQty);
    const qtyValid = dropQty.trim() !== "" && !Number.isNaN(qtyNum) && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 1000000 && /^\d+(\.\d{1,2})?$/.test(dropQty.trim());
    if (!qtyValid) {
      setDropFieldError(s.dropValidationQty);
      return;
    }
    if (dropNote.trim().length > 500) {
      setDropFieldError(s.dropValidationNote);
      return;
    }
    setDropFieldError(null);
    setDropSubmitting(true);
    setDropError(null);
    try {
      const res = await declareDonation(id, {
        category: dropCategory,
        qty: qtyNum,
        note: dropNote.trim() || undefined,
        turnstileToken: dropTurnstileToken || undefined,
      });
      setDropRef(res.ref);
    } catch (err) {
      setDropError(apiErrorMessage(err, language));
    } finally {
      setDropSubmitting(false);
    }
  };

  const handleCopyRef = async () => {
    if (!dropRef) return;
    try {
      await navigator.clipboard.writeText(dropRef);
      setDropCopied(true);
      setTimeout(() => setDropCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagReason) {
      setFlagFieldError(s.reportValidationReason);
      return;
    }
    if (flagDetails.trim().length > 500) {
      setFlagFieldError(s.reportValidationDetails);
      return;
    }
    setFlagFieldError(null);
    setFlagSubmitting(true);
    setFlagError(null);
    try {
      await flagCenter(id, {
        reason: flagReason as "not_real" | "closed" | "misuse" | "other",
        details: flagDetails.trim() || undefined,
        turnstileToken: flagTurnstileToken || undefined,
      });
      setFlagSuccess(true);
      setFlagOpen(false);
      setFlagReason("");
      setFlagDetails("");
      setFlagTurnstileToken("");
    } catch (err) {
      setFlagError(apiErrorMessage(err, language));
    } finally {
      setFlagSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="font-sans text-sm text-muted">{s.loading}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="border-ink">
          <CardHeader>
            <CardTitle className="font-serif text-xl">{s.centerNotFoundTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-sans text-sm text-muted">{s.centerNotFoundBody}</p>
            <Button className="min-h-11" onClick={() => navigate("dropCenters")}>
              {s.backToCenters}
            </Button>
          </CardContent>
        </Card>
        <Rule />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="font-sans text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button className="min-h-11" onClick={() => navigate("dropCenters")}>
          {s.backToCenters}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const districtLabel = districtLabels[data.district as keyof typeof districtLabels]?.[language] ?? data.district;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => navigate("dropCenters")}
        className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
      >
        ← {s.backToCenters}
      </button>

      <header className="border-b border-rule pb-6">
        <SectionLabel>{s.centersSectionLabel}</SectionLabel>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.org.status === "verified" ? (
            <Badge variant="default" className="text-[0.62rem] uppercase">
              {tierLabel(data.org.tier, language)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-rule text-[0.62rem] uppercase text-muted">
              {s.unverifiedOrg}
            </Badge>
          )}
          <span className="font-sans text-xs text-muted">{data.org.name}</span>
          <StatusMark tone={statusTone(data.status)}>{statusLabel(data.status, language)}</StatusMark>
        </div>
        <Headline level={1} className="mt-3 text-3xl">
          {data.name}
        </Headline>
        <div className="mt-3 space-y-1 font-sans text-sm text-muted">
          <p>
            {s.addressLabel}: {data.address}
          </p>
          <p>{data.ward ? fillTemplate(s.districtWard, { district: districtLabel, ward: String(data.ward) }) : districtLabel}</p>
          {data.hours ? <p>{s.hoursLabel}: {data.hours}</p> : null}
          <p>
            {s.phoneLabel}:{" "}
            <a href={`tel:${data.contactPhone}`} className="font-semibold text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red">
              {data.contactPhone}
            </a>
          </p>
        </div>
        {data.accepts.length ? (
          <div className="mt-4">
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{s.acceptsLabel}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.accepts.map((a) => (
                <Badge key={a} variant="secondary" className="text-[0.68rem]">
                  {goodsLabel(a, language)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {data.status === "open" ? (
          <div className="mt-5">
            <SquareButton tone="primary" onClick={() => setDropOpen(true)}>
              {s.dropButton}
            </SquareButton>
          </div>
        ) : null}
      </header>

      <Dialog open={dropOpen} onOpenChange={(o) => { if (!o) { setDropOpen(false); setDropFieldError(null); setDropError(null); } }}>
        <DialogContent>
          {dropRef ? (
            <>
              <DialogHeader>
                <DialogTitle>{s.dropSuccessTitle}</DialogTitle>
              </DialogHeader>
              <p className="break-all font-mono text-3xl font-semibold tracking-[0.12em] text-ink">{dropRef}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" className="min-h-11" onClick={handleCopyRef}>
                  {dropCopied ? s.dropCopied : s.dropCopyButton}
                </Button>
                <span className="font-sans text-sm text-muted">
                  {s.dropLinkLabel}{" "}
                  <a href={`/donation/${encodeURIComponent(dropRef)}`} className="font-semibold text-ink underline underline-offset-4">
                    /donation/{dropRef}
                  </a>
                </span>
              </div>
              <p className="mt-4 font-sans text-sm italic text-muted">{s.dropKeepCode}</p>
              <DialogFooter>
                <Button type="button" className="min-h-11" onClick={() => setDropOpen(false)}>
                  {s.dropDone}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleDeclare} className="space-y-4" noValidate>
              <DialogHeader>
                <DialogTitle>{s.dropDialogTitle}</DialogTitle>
                <DialogDescription>{s.dropDialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="dropCategory">{s.dropCategoryLabel}</Label>
                <Select id="dropCategory" value={dropCategory} onChange={(e) => setDropCategory(e.target.value)} className="min-h-11" required>
                  <option value="">{s.dropCategorySelect}</option>
                  {(data.accepts.length ? data.accepts : GOODS_CATEGORIES.map((c) => c.id)).map((cat) => (
                    <SelectItem key={cat} value={cat}>{goodsLabel(cat, language)}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropQty">{s.dropQtyLabel}</Label>
                <Input id="dropQty" type="number" inputMode="decimal" min="0.01" step="0.01" value={dropQty} onChange={(e) => setDropQty(e.target.value)} className="min-h-11" required />
                <p className="font-sans text-xs text-muted-foreground">{s.dropQtyHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropNote">{s.dropNoteLabel}</Label>
                <Textarea id="dropNote" value={dropNote} onChange={(e) => setDropNote(e.target.value)} placeholder={s.dropNotePlaceholder} rows={3} maxLength={500} />
              </div>
              {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setDropTurnstileToken} /> : null}
              {dropFieldError ? <p className="font-sans text-sm text-destructive" role="alert">{dropFieldError}</p> : null}
              {dropError ? (
                <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                  {dropError}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setDropOpen(false)}>
                  {s.dropCancel}
                </Button>
                <Button type="submit" disabled={dropSubmitting} className="min-h-11">
                  {dropSubmitting ? s.dropSubmitting : s.dropSubmit}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{s.stockTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.stock.length === 0 ? (
            <p className="font-sans text-sm text-muted">{s.stockEmpty}</p>
          ) : (
            <RuledTable
              caption={s.stockTitle}
              rows={data.stock.map((item) => ({
                key: item.category,
                label: goodsLabel(item.category, language),
                value: `${item.qty} ${unitLabel(item.unit, language)}`,
              }))}
            />
          )}
          <p className="mt-4 border-t border-rule pt-3 font-sans text-xs italic text-muted">{s.stockNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{s.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="font-sans text-sm text-muted">{s.activityEmpty}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.recent.map((entry) => {
                const corrected = !!entry.correctedByEntryId;
                const isCorrection = entry.entryType === "correction";
                return (
                  <li key={entry.id} className={`flex flex-col gap-1 px-2 py-3 font-sans text-sm ${corrected ? "line-through text-muted" : "text-ink"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{entryLabel(entry, language)}</span>
                      <span className="text-xs text-muted">
                        {goodsLabel(entry.category, language)} · {entry.qty} {unitLabel(entry.unit, language)}
                      </span>
                      {corrected ? <Badge variant="outline" className="text-[0.62rem]">{s.activityCorrected}</Badge> : null}
                      {isCorrection ? <Badge variant="secondary" className="text-[0.62rem]">{s.activityCorrection}</Badge> : null}
                      {entry.discrepancy !== undefined && entry.discrepancy !== 0 ? (
                        <span className="text-xs text-red">{fillTemplate(s.transferDiscrepancy, { value: String(entry.discrepancy), unit: unitLabel(entry.unit, language) })}</span>
                      ) : null}
                    </div>
                    {entry.transferStatus ? (
                      <span className="font-sans text-xs text-muted">
                        {entry.transferStatus === "in_transit" ? "in transit" : entry.transferStatus === "received" ? `received${entry.qtyReceived !== undefined ? ` (${entry.qtyReceived} ${unitLabel(entry.unit, language)})` : ""}` : entry.transferStatus}
                      </span>
                    ) : null}
                    <span className="font-sans text-xs text-muted">{new Date(entry.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}</span>
                    {entry.note ? <span className="font-sans text-xs italic text-muted">{entry.note}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-rule">
        <CardHeader>
          <CardTitle className="font-serif text-base">{s.reportProblemTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!flagOpen ? (
            <Button variant="outline" className="min-h-11" onClick={() => setFlagOpen(true)}>
              {s.reportProblemDisclosure}
            </Button>
          ) : (
            <form onSubmit={handleFlag} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="flagReason">{s.reportReasonLabel}</Label>
                <Select id="flagReason" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} className="min-h-11" required>
                  <option value="">{s.reportReasonSelect}</option>
                  <SelectItem value="not_real">{s.reportReasonNotReal}</SelectItem>
                  <SelectItem value="closed">{s.reportReasonClosed}</SelectItem>
                  <SelectItem value="misuse">{s.reportReasonMisuse}</SelectItem>
                  <SelectItem value="other">{s.reportReasonOther}</SelectItem>
                </Select>
                {flagFieldError && !flagReason ? <p className="font-sans text-sm text-destructive" role="alert">{flagFieldError}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="flagDetails">{s.reportDetailsLabel}</Label>
                <Textarea id="flagDetails" value={flagDetails} onChange={(e) => setFlagDetails(e.target.value)} placeholder={s.reportDetailsPlaceholder} rows={3} maxLength={500} />
                <p className="font-sans text-xs text-muted-foreground">{s.reportDetailsHint}</p>
                {flagFieldError && flagDetails.trim().length > 500 ? <p className="font-sans text-sm text-destructive" role="alert">{flagFieldError}</p> : null}
              </div>
              {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setFlagTurnstileToken} /> : null}
              {flagError ? (
                <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                  {flagError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={flagSubmitting} className="min-h-11">
                  {flagSubmitting ? s.reportSubmitting : s.reportSubmit}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => { setFlagOpen(false); setFlagFieldError(null); setFlagError(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          {flagSuccess ? (
            <p className="font-sans text-sm text-emerald-700" role="status">
              {s.reportSuccess}
            </p>
          ) : null}
          {flagError && !flagOpen ? (
            <p className="font-sans text-sm text-destructive" role="alert">
              {flagError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Rule />
      <div className="flex">
        <Button variant="outline" className="min-h-11" onClick={() => navigate("dropCenters")}>
          {s.backToCenters}
        </Button>
      </div>
    </div>
  );
}
