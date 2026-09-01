import { useEffect, useState } from "react";
import { ApiError, getModerationQueue, listNeeds, listOffers, moderateNeed, updateNeedStatus, type ModerationQueueItem, type NeedPublic, type OfferPublic } from "./api";
import { useGoogleAuth } from "./auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { districtLabels } from "./geo";
import { labels } from "./i18n";
import type { Language } from "./types";
import { fillTemplate } from "./edition";

function statusBadgeVariant(status: string) {
  if (status === "published") return "default";
  if (status === "pending") return "secondary";
  if (status === "rejected") return "destructive";
  return "outline";
}

export function Desk({ language }: { language: Language }) {
  const t = labels[language];
  const auth = useGoogleAuth();
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "boards">("queue");

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
      const [needsRes, offersRes] = await Promise.all([listNeeds({}), listOffers({})]);
      setPublishedNeeds(needsRes.items);
      setOffers(offersRes.items);
    } catch {
      // keep empty
    } finally {
      setBoardsLoading(false);
    }
  };

  useEffect(() => {
    if (auth.profile && (auth.profile.role === "moderator" || auth.profile.role === "admin")) {
      loadQueue();
      loadBoards();
    }
  }, [auth.profile?.role, auth.idToken]);

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

      <div className="mb-6 flex gap-2 border-b border-rule">
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
              {queue.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {item.maskedName || item.helperLabel || item.beneficiary?.name || item.id}
                        <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">{item.category || (item.categories || []).join(", ")}</span>
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
                            {item.beneficiary.householdSize ? (
                              <p>
                                {t.deskQueueHousehold}: {item.beneficiary.householdSize}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {item.registrant ? (
                          <div className="mt-2 font-sans text-sm">
                            <p>
                              <span className="font-semibold">{t.deskQueueRegistrant}:</span> {item.registrant.name} · {item.registrant.phone}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 font-sans text-xs text-muted-foreground">{t.deskNoRegistrant}</p>
                        )}
                        {item.phone ? (
                          <p className="mt-1 font-sans text-sm">
                            <span className="font-semibold">{t.deskQueueContact}:</span> {item.phone}
                          </p>
                        ) : null}
                        {item.org ? (
                          <p className="mt-1 font-sans text-sm">
                            {item.org.name} · {item.org.contact}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="border border-amber-200 bg-amber-50 p-3">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide">{t.deskQueueDupTitle}</p>
                      <p className="font-sans text-xs text-muted-foreground">{t.deskQueueDupHint}</p>
                      {item.dupCandidates && item.dupCandidates.length > 0 ? (
                        <ul className="mt-2 list-disc pl-5 font-sans text-sm">
                          {item.dupCandidates.map((d) => (
                            <li key={d.id}>
                              {d.maskedName} · W{d.ward} <span className="text-xs text-muted-foreground">({d.id})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 font-sans text-sm text-muted-foreground">{t.deskQueueDupEmpty}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handlePublish(item.id)} disabled={!!actionLoading}>
                        {actionLoading === item.id ? "…" : t.deskPublish}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => { setRejectId(item.id); setRejectError(null); }}>
                        {t.deskReject}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{t.deskBoardsTitle}</h2>
          {boardsLoading ? (
            <p className="font-sans text-sm text-muted-foreground">{t.deskBoardsLoading}</p>
          ) : publishedNeeds.length === 0 ? (
            <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.deskBoardsEmpty}</p>
          ) : (
            <div className="grid gap-4">
              {publishedNeeds.map((need) => (
                <Card key={need.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{need.maskedName}</CardTitle>
                      <Badge variant={statusBadgeVariant(need.status) as never}>{need.status}</Badge>
                    </div>
                    <CardDescription className="font-sans text-xs">
                      {need.district} · W{need.ward} · {need.category} · {new Date(need.createdAt).toLocaleDateString()}
                    </CardDescription>
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
              ))}
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
