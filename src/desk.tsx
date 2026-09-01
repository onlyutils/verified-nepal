import { useEffect, useState, useRef } from "react";
import {
  ApiError,
  getClaimsPrint,
  getModerationFlags,
  getModerationQueue,
  listNeeds,
  listOffers,
  moderateNeed,
  redeemClaim,
  syncClaims,
  updateNeedStatus,
  type ModerationQueueItem,
  type NeedPublic,
  type OfferPublic,
  type ClaimPrintItem,
  type FlagInboxItem,
  type SyncResult,
} from "./api";
import { useGoogleAuth } from "./auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { districtLabels, districtNames } from "./geo";
import { labels } from "./i18n";
import type { Language } from "./types";
import { fillTemplate } from "./edition";
import QRCode from "qrcode";

function statusBadgeVariant(status: string) {
  if (status === "published") return "default";
  if (status === "pending") return "secondary";
  if (status === "rejected") return "destructive";
  return "outline";
}

function FlagBadge({ count, t }: { count: number; t: Record<string, string> }) {
  if (!count) return null;
  return (
    <Badge variant="destructive" className="ml-2">
      {fillTemplate(t.deskFlagCount, { count: String(count) })}
    </Badge>
  );
}

function QrCell({ code }: { code: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(code, { width: 64, margin: 1 })
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);
  if (!url) return <span className="font-mono text-[10px]">{code}</span>;
  return <img src={url} alt={`QR ${code}`} width={64} height={64} className="h-16 w-16 object-contain" />;
}

export function Desk({ language }: { language: Language }) {
  const t = labels[language];
  const auth = useGoogleAuth();
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "boards" | "print" | "sync" | "flags">("queue");

  const [publishedNeeds, setPublishedNeeds] = useState<NeedPublic[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [offers, setOffers] = useState<OfferPublic[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<Record<string, string>>({});
  const [matchedContact, setMatchedContact] = useState<Record<string, unknown>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Print
  const [printDistrict, setPrintDistrict] = useState<string>(districtNames[0] ?? "Rasuwa");
  const [printWard, setPrintWard] = useState<string>("1");
  const [printItems, setPrintItems] = useState<ClaimPrintItem[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // Sync
  const [syncText, setSyncText] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Flags
  const [flags, setFlags] = useState<FlagInboxItem[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  // Redeem confirm
  const [redeemCode, setRedeemCode] = useState<string | null>(null);
  const [redeemNeedId, setRedeemNeedId] = useState<string | null>(null);
  const [redeemNote, setRedeemNote] = useState("");

  const loadQueue = async () => {
    if (!auth.idToken) return;
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await getModerationQueue(auth.idToken);
      setQueue(res.items);
    } catch (e) {
      const err = e as ApiError;
      setQueueError(err.message || t.deskQueueError);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadBoards = async () => {
    if (!auth.idToken) return;
    setBoardsLoading(true);
    try {
      const [needsRes, offersRes] = await Promise.all([listNeeds({}, auth.idToken ?? undefined), listOffers({}, auth.idToken ?? undefined)]);
      setPublishedNeeds(needsRes.items as NeedPublic[]);
      setOffers(offersRes.items);
    } catch {
      // keep empty
    } finally {
      setBoardsLoading(false);
    }
  };

  const loadFlags = async () => {
    if (!auth.idToken) return;
    setFlagsLoading(true);
    setFlagsError(null);
    try {
      const res = await getModerationFlags(auth.idToken);
      setFlags(res.items);
    } catch (e) {
      const err = e as ApiError;
      setFlagsError(err.message || t.deskFlagsError);
    } finally {
      setFlagsLoading(false);
    }
  };

  const loadPrint = async () => {
    if (!auth.idToken) return;
    if (!printDistrict || !printWard) return;
    setPrintLoading(true);
    setPrintError(null);
    try {
      const res = await getClaimsPrint(auth.idToken, { district: printDistrict, ward: Number(printWard) });
      setPrintItems(res.items);
    } catch (e) {
      const err = e as ApiError;
      setPrintError(err.message || t.deskPrintError);
      setPrintItems([]);
    } finally {
      setPrintLoading(false);
    }
  };

  const handleSync = async () => {
    if (!auth.idToken) return;
    const lines = syncText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setSyncError(t.deskSyncEmpty);
      return;
    }
    if (lines.length > 200) {
      setSyncError("Max 200 codes");
      return;
    }
    const redemptions = lines.map((line) => {
      const parts = line.split(/\s+/);
      const code = parts[0].toUpperCase();
      const note = parts.slice(1).join(" ") || undefined;
      return { code, redeemedAt: new Date().toISOString(), note };
    });
    setSyncLoading(true);
    setSyncError(null);
    try {
      const res = await syncClaims(auth.idToken, { redemptions });
      setSyncResults(res.results);
      setActionMsg(t.deskActionSuccess);
      loadBoards();
    } catch (e) {
      const err = e as ApiError;
      setSyncError(err.message || t.deskActionError);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!auth.idToken || !redeemCode) return;
    setActionLoading(redeemCode);
    try {
      await redeemClaim(auth.idToken, redeemCode, { note: redeemNote || undefined });
      setActionMsg(t.deskRedeemSuccess);
      setRedeemCode(null);
      setRedeemNote("");
      loadBoards();
    } catch (e) {
      const err = e as ApiError;
      const body = err.body as Record<string, unknown> | null;
      const errCode = body && typeof body.error === "string" ? body.error : err.message;
      if (errCode === "already_redeemed" || err.status === 409) setActionMsg(t.deskRedeemAlready);
      else if (err.status === 404) setActionMsg(t.deskRedeemUnknown);
      else setActionMsg(err.message || t.deskActionError);
      setRedeemCode(null);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (auth.profile && (auth.profile.role === "moderator" || auth.profile.role === "admin")) {
      loadQueue();
      loadBoards();
      loadFlags();
    }
  }, [auth.profile?.role, auth.idToken]);

  useEffect(() => {
    if (activeTab === "flags" && auth.idToken) loadFlags();
  }, [activeTab]);

  if (!auth.idToken) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t.deskTitle}</CardTitle>
            <CardDescription>{t.deskInviteOnly}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.clientId ? (
              <Button onClick={auth.signIn} className="w-full max-w-[280px]" aria-label="Continue with Google">
                {t.deskContinueWithGoogle}
              </Button>
            ) : (
              <p className="font-sans text-sm text-muted-foreground">{t.deskNotConfigured}</p>
            )}
            {auth.error ? <p className="font-sans text-sm text-destructive" role="alert">{t.deskSignInFailed}</p> : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auth.loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskTitle}</CardTitle>
            <CardDescription>{t.deskChecking}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskAuthErrorTitle}</CardTitle>
            <CardDescription>{t.deskAuthErrorBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.clientId ? (
              <Button onClick={auth.signIn} className="w-full max-w-[280px]">
                {t.deskContinueWithGoogle}
              </Button>
            ) : null}
            <Button variant="outline" onClick={auth.signOut}>
              {t.deskSignOut}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auth.profile) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskAuthErrorTitle}</CardTitle>
            <CardDescription>{t.deskAuthErrorBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.clientId ? (
              <Button onClick={auth.signIn} className="w-full max-w-[280px]">
                {t.deskContinueWithGoogle}
              </Button>
            ) : null}
            <Button variant="outline" onClick={auth.signOut}>
              {t.deskSignOut}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = auth.profile?.role;
  const isModerator = role === "moderator" || role === "admin";

  if (!isModerator) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskNotAuthorizedTitle}</CardTitle>
            <CardDescription>{t.deskNotAuthorizedBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.profile?.email || auth.profile?.name ? (
              <p className="font-sans text-xs text-muted-foreground">
                {fillTemplate(t.deskWelcome, { name: String(auth.profile.email || auth.profile.name || "") })}
              </p>
            ) : null}
            <Button variant="outline" onClick={auth.signOut}>
              {t.deskSignOut}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = auth.profile?.displayName || auth.profile?.name || auth.profile?.email;

  const handlePublish = async (id: string) => {
    if (!auth.idToken) return;
    setActionLoading(id);
    setActionMsg(null);
    try {
      await moderateNeed(auth.idToken, id, { action: "publish" });
      setActionMsg(t.deskActionSuccess);
      setQueue((prev) => prev.filter((x) => x.id !== id));
      loadBoards();
    } catch (e) {
      const err = e as ApiError;
      setActionMsg(err.message || t.deskActionError);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId || !auth.idToken) return;
    if (!rejectReason.trim()) {
      setRejectError(t.deskRejectReasonRequired);
      return;
    }
    setActionLoading(rejectId);
    try {
      await moderateNeed(auth.idToken, rejectId, { action: "reject", reason: rejectReason.trim() });
      setActionMsg(t.deskActionSuccess);
      setQueue((prev) => prev.filter((x) => x.id !== rejectId));
      setRejectId(null);
      setRejectReason("");
      setRejectError(null);
    } catch (e) {
      const err = e as ApiError;
      setRejectError(err.message || t.deskActionError);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatus = async (needId: string, status: "matched" | "fulfilled" | "archived") => {
    if (!auth.idToken) return;
    const offerId = selectedOfferId[needId];
    if (status === "matched" && !offerId) return;
    setActionLoading(needId + status);
    try {
      const res = await updateNeedStatus(auth.idToken, needId, { status, offerId: status === "matched" ? offerId : undefined });
      if (status === "matched" && res.contact) setMatchedContact((prev) => ({ ...prev, [needId]: res.contact }));
      setActionMsg(t.deskActionSuccess);
      loadBoards();
    } catch (e) {
      const err = e as ApiError;
      setActionMsg(err.message || t.deskActionError);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-1 py-2 sm:px-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t.deskTitle}</h1>
          {displayName ? <p className="mt-1 font-sans text-sm text-muted-foreground">{fillTemplate(t.deskWelcome, { name: displayName })}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={auth.signOut}>
          {t.deskSignOut}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-rule">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          aria-pressed={activeTab === "queue"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "queue" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.deskQueueNeedsTab} {queue.length ? `· ${queue.length}` : ""}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("boards")}
          aria-pressed={activeTab === "boards"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "boards" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.deskBoardsTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("print")}
          aria-pressed={activeTab === "print"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "print" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.deskPrintTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sync")}
          aria-pressed={activeTab === "sync"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "sync" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.deskSyncTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("flags")}
          aria-pressed={activeTab === "flags"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "flags" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.deskFlagsTab} {flags.length ? `· ${flags.length}` : ""}
        </button>
      </div>

      {actionMsg ? (
        <div className="mb-4 border border-rule bg-card px-3 py-2 font-sans text-sm" role="status">
          {actionMsg}
        </div>
      ) : null}

      {activeTab === "queue" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t.deskQueueTitleRevised}</h2>
            <Badge variant="secondary">{t.deskModeratorBadge}</Badge>
          </div>
          {queueLoading ? (
            <p className="font-sans text-sm text-muted-foreground">{t.deskQueueLoading}</p>
          ) : queueError ? (
            <div className="space-y-2">
              <p className="font-sans text-sm text-destructive" role="alert">
                {queueError}
              </p>
              <Button variant="outline" size="sm" onClick={loadQueue}>
                Retry
              </Button>
            </div>
          ) : queue.length === 0 ? (
            <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.deskQueueEmpty}</p>
          ) : (
            <div className="grid gap-4">
              {queue.map((item) => {
                const flagCount = (item.flagCount as number | undefined) ?? 0;
                return (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {item.maskedName || item.helperLabel || item.beneficiary?.name || item.id}
                        <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">{item.category || (item.categories || []).join(", ")}</span>
                        <FlagBadge count={flagCount} t={t as unknown as Record<string, string>} />
                      </CardTitle>
                      <Badge variant={statusBadgeVariant(String(item.status || "pending")) as never}>{String(item.status || t.deskNeedsStatusPending)}</Badge>
                    </div>
                    <CardDescription className="font-sans text-xs">
                      {item.district || (item.districts || []).join(", ")} {item.ward ? `· W${item.ward}` : ""} · {new Date(item.createdAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="border border-rule bg-paper p-3">
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">{t.deskQueuePublicPreview}</p>
                        <p className="mt-2 font-sans text-sm font-semibold">{item.maskedName || item.helperLabel || "—"}</p>
                        <p className="font-sans text-xs text-muted-foreground">
                          {(item.district || (item.districts || [])[0] || "—") + (item.ward ? ` · W${item.ward}` : "")}
                        </p>
                        <p className="font-sans text-xs capitalize text-muted-foreground">{String(item.category || (item.categories || []).join(", "))}</p>
                        <p className="mt-2 font-serif text-sm leading-6">{item.description}</p>
                      </div>
                      <div className="border border-dashed border-rule bg-card p-3">
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">{t.deskQueuePrivateDetails}</p>
                        {item.beneficiary ? (
                          <div className="mt-2 font-sans text-sm">
                            <p>
                              <span className="font-semibold">{t.deskQueueBeneficiary}:</span> {item.beneficiary.name}
                            </p>
                            {item.beneficiary.phone ? (
                              <p>
                                <span className="font-semibold">{t.deskQueueContact}:</span> {item.beneficiary.phone}
                              </p>
                            ) : null}
                            <p>
                              {item.beneficiary.district} · W{item.beneficiary.ward}
                            </p>
                            {typeof item.beneficiary.householdSize === "number" ? (
                              <p>
                                <span className="font-semibold">{t.deskQueueHousehold}:</span> {item.beneficiary.householdSize}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {item.registrant ? (
                          <p className="mt-2 font-sans text-sm">
                            <span className="font-semibold">{t.deskQueueRegistrant}:</span> {item.registrant.name} · {item.registrant.phone}
                          </p>
                        ) : (
                          <p className="mt-2 font-sans text-xs text-muted-foreground">{t.deskNoRegistrant}</p>
                        )}
                        {item.dupCandidates && item.dupCandidates.length > 0 ? (
                          <div className="mt-3">
                            <p className="font-sans text-xs font-semibold">{t.deskQueueDupTitle}</p>
                            <ul className="mt-1 font-sans text-xs">
                              {item.dupCandidates.map((d) => (
                                <li key={d.id}>
                                  {d.maskedName} · W{d.ward} ({d.id.slice(0, 8)})
                                </li>
                              ))}
                            </ul>
                            <p className="font-sans text-xs text-muted-foreground">{t.deskQueueDupHint}</p>
                          </div>
                        ) : (
                          <p className="mt-3 font-sans text-xs text-muted-foreground">{t.deskQueueDupEmpty}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handlePublish(item.id)} disabled={!!actionLoading}>
                        {actionLoading === item.id ? "…" : t.deskPublish}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectId(item.id)}>
                        {t.deskReject}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "boards" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t.deskBoardsTitle}</h2>
            <Button variant="outline" size="sm" onClick={loadBoards}>
              {t.deskRetry}
            </Button>
          </div>
          {boardsLoading ? (
            <p className="font-sans text-sm text-muted-foreground">{t.deskBoardsLoading}</p>
          ) : publishedNeeds.length === 0 ? (
            <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.deskBoardsEmpty}</p>
          ) : (
            <div className="grid gap-4">
              {publishedNeeds.map((need) => {
                const flagCount = need.flagCount ?? 0;
                const claimCode = need.claimCode;
                const showRedeem = (need.status === "published" || need.status === "matched") && claimCode;
                return (
                <Card key={need.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{need.maskedName} <FlagBadge count={flagCount} t={t as unknown as Record<string, string>} /></CardTitle>
                      <Badge variant={statusBadgeVariant(need.status) as never}>{need.status}</Badge>
                    </div>
                    <CardDescription className="font-sans text-xs">
                      {need.district} · W{need.ward} · {need.category} · {new Date(need.createdAt).toLocaleDateString()}
                    </CardDescription>
                    {claimCode ? (
                      <div className="mt-2 border border-rule bg-paper px-3 py-2">
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">{t.deskClaimCode}</p>
                        <p className="font-mono text-lg font-bold tracking-widest">{claimCode}</p>
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="font-serif text-sm leading-6">{need.description}</p>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="font-sans text-xs">{t.deskMatchPickOffer}</Label>
                      <div className="flex flex-wrap gap-2">
                        <Select value={selectedOfferId[need.id] || ""} onChange={(e) => setSelectedOfferId((p) => ({ ...p, [need.id]: e.target.value }))}>
                          <option value="">{t.deskSelectOfferPlaceholder}</option>
                          {offers.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.helperLabel} — {o.categories.join(", ")} ({o.id.slice(0, 8)})
                            </SelectItem>
                          ))}
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!selectedOfferId[need.id] || actionLoading === need.id + "matched"}
                          onClick={() => handleStatus(need.id, "matched")}
                        >
                          {actionLoading === need.id + "matched" ? "…" : t.deskMatch}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === need.id + "fulfilled"}
                          onClick={() => handleStatus(need.id, "fulfilled")}
                        >
                          {t.deskFulfill}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoading === need.id + "archived"}
                          onClick={() => handleStatus(need.id, "archived")}
                        >
                          {t.deskArchive}
                        </Button>
                        {showRedeem ? (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={actionLoading === claimCode}
                            onClick={() => {
                              setRedeemCode(claimCode);
                              setRedeemNeedId(need.id);
                            }}
                          >
                            {t.deskRedeem}
                          </Button>
                        ) : null}
                      </div>
                      {offers.length === 0 ? <p className="font-sans text-xs text-muted-foreground">{t.deskNoOffersHint}</p> : null}
                      {matchedContact[need.id] ? (
                        <div className="border border-ink bg-paper p-3">
                          <p className="font-sans text-xs font-semibold uppercase tracking-wide">{t.deskMatchedContactTitle}</p>
                          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(matchedContact[need.id], null, 2)}</pre>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "print" ? (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{t.deskPrintTitle}</h2>
          <p className="font-sans text-sm text-muted-foreground">{t.deskPrintLead}</p>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-4 no-print">
                <div className="min-w-[14rem]">
                  <Label>{t.deskPrintDistrict}</Label>
                  <Select value={printDistrict} onChange={(e) => setPrintDistrict(e.target.value)}>
                    {districtNames.map((d) => (
                      <SelectItem key={d} value={d}>
                        {districtLabels[d][language]}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="min-w-[8rem]">
                  <Label>{t.deskPrintWard}</Label>
                  <Select value={printWard} onChange={(e) => setPrintWard(e.target.value)}>
                    {Array.from({ length: 33 }, (_, i) => i + 1).map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        W{w}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={loadPrint} disabled={printLoading}>
                    {printLoading ? "…" : t.deskPrintLoad}
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} disabled={printItems.length === 0}>
                    {t.deskPrintPrintAction}
                  </Button>
                </div>
              </div>
              {printError ? <p className="font-sans text-sm text-destructive" role="alert">{printError}</p> : null}
              {printLoading ? <p className="font-sans text-sm text-muted-foreground">{t.deskBoardsLoading}</p> : null}
              {!printLoading && !printError && printItems.length === 0 ? <p className="font-sans text-sm text-muted-foreground">{t.deskPrintEmpty}</p> : null}
              {printItems.length > 0 ? (
                <div className="overflow-x-auto border border-rule bg-paper print:border-black print:bg-white">
                  <div className="p-4 text-center print:block">
                    <h3 className="font-display text-lg font-bold">{printDistrict} · W{printWard}</h3>
                    <p className="font-sans text-xs text-muted-foreground">{t.deskPrintTitle}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">{t.deskPrintTick}</TableHead>
                        <TableHead>{t.deskPrintQr}</TableHead>
                        <TableHead>{t.deskPrintCode}</TableHead>
                        <TableHead>{t.deskPrintMaskedName}</TableHead>
                        <TableHead>{t.deskPrintCategory}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {printItems.map((it) => (
                        <TableRow key={it.claimCode} className="print:break-inside-avoid">
                          <TableCell className="text-center">
                            <span className="inline-block h-5 w-5 border border-ink text-center leading-5">☐</span>
                          </TableCell>
                          <TableCell>
                            <QrCell code={it.claimCode} />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold tracking-widest">{it.claimCode}</TableCell>
                          <TableCell>{it.maskedName}</TableCell>
                          <TableCell className="capitalize">{it.category}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <style>{`@media print {
            body { background: white !important; color: black !important; }
            .no-print, header, nav, footer { display: none !important; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid black; color: black; background: white; }
            tr { page-break-inside: avoid; }
          }`}</style>
        </div>
      ) : null}

      {activeTab === "sync" ? (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{t.deskSyncTitle}</h2>
          <p className="font-sans text-sm text-muted-foreground">{t.deskSyncLead}</p>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="syncText">{t.deskSyncTitle}</Label>
                <Textarea id="syncText" value={syncText} onChange={(e) => setSyncText(e.target.value)} rows={8} placeholder={t.deskSyncPlaceholder} className="font-mono text-sm" />
              </div>
              {syncError ? <p className="font-sans text-sm text-destructive" role="alert">{syncError}</p> : null}
              <Button onClick={handleSync} disabled={syncLoading}>
                {syncLoading ? t.deskSyncSubmitting : t.deskSyncSubmit}
              </Button>
              {syncResults ? (
                <div className="space-y-2">
                  <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">Results</h3>
                  <ul className="space-y-1">
                    {syncResults.map((r) => (
                      <li key={r.code} className="flex justify-between border border-rule px-3 py-2 font-mono text-sm">
                        <span>{r.code}</span>
                        <span
                          className={
                            r.status === "redeemed"
                              ? "text-green-700"
                              : r.status === "already_redeemed"
                                ? "text-amber-700"
                                : "text-destructive"
                          }
                        >
                          {r.status === "redeemed" ? t.deskSyncResultRedeemed : r.status === "already_redeemed" ? t.deskSyncResultAlready : t.deskSyncResultUnknown}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "flags" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{t.deskFlagsTab}</h2>
            <Button variant="outline" size="sm" onClick={loadFlags}>
              {t.deskRetry}
            </Button>
          </div>
          {flagsLoading ? (
            <p className="font-sans text-sm text-muted-foreground">{t.deskFlagsLoading}</p>
          ) : flagsError ? (
            <p className="font-sans text-sm text-destructive" role="alert">{flagsError}</p>
          ) : flags.length === 0 ? (
            <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.deskFlagsEmpty}</p>
          ) : (
            <div className="grid gap-4">
              {flags.map((item) => (
                <Card key={item.needId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        {item.maskedName} · W{item.ward}
                        <FlagBadge count={item.flagCount} t={t as unknown as Record<string, string>} />
                      </CardTitle>
                      <span className="font-sans text-xs text-muted-foreground">{item.district}</span>
                    </div>
                    <CardDescription className="font-mono text-xs">{item.needId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="font-sans text-sm font-medium">{fillTemplate(t.deskFlagCount, { count: String(item.flagCount) })}</p>
                    <ul className="space-y-2">
                      {item.flags.map((f, idx) => (
                        <li key={idx} className="border border-rule bg-card px-3 py-2">
                          <p className="font-sans text-xs font-semibold capitalize">{f.reason}</p>
                          {f.details ? <p className="mt-1 font-serif text-sm leading-6">{f.details}</p> : null}
                          <p className="mt-1 font-sans text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deskRejectReasonTitle}</DialogTitle>
            <DialogDescription>{t.deskQueuePrivateDetails}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">{t.deskRejectReasonTitle} *</Label>
            <Textarea id="rejectReason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t.deskRejectReasonPlaceholder} rows={3} />
            {rejectError ? (
              <p className="font-sans text-sm text-destructive" role="alert">
                {rejectError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectError(null); }}>
              {t.deskCancel}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading ? "…" : t.deskRejectConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!redeemCode} onOpenChange={(o) => { if (!o) { setRedeemCode(null); setRedeemNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deskRedeemConfirmTitle}</DialogTitle>
            <DialogDescription>{redeemCode ? fillTemplate(t.deskRedeemConfirmBody, { code: redeemCode }) : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="redeemNote">Note (optional)</Label>
            <Input id="redeemNote" value={redeemNote} onChange={(e) => setRedeemNote(e.target.value)} placeholder="note" />
            {redeemCode ? <p className="font-mono text-lg font-bold tracking-widest">{redeemCode}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRedeemCode(null); setRedeemNote(""); }}>
              {t.deskCancel}
            </Button>
            <Button onClick={handleRedeem} disabled={!!actionLoading}>
              {actionLoading === redeemCode ? "…" : t.deskRedeem}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
