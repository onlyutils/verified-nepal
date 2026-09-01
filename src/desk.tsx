import { useEffect, useState, useRef } from "react";
import {
  ApiError,
  getClaimsPrint,
  getModerationDispatches,
  moderateDispatch,
  type ModerationDispatchItem,
  getModerationFlags,
  getModerationQueue,
  getModerationProjects,
  listNeeds,
  listOffers,
  moderateNeed,
  moderateProject,
  moderateProjectUpdate,
  redeemClaim,
  syncClaims,
  updateNeedStatus,
  type ModerationQueueItem,
  type NeedPublic,
  type OfferPublic,
  type ClaimPrintItem,
  type FlagInboxItem,
  type SyncResult,
  type ModerationProjectItem,
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
  const [activeTab, setActiveTab] = useState<"queue" | "boards" | "print" | "sync" | "flags" | "projects" | "dispatches">("queue");

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

  // Projects moderation
  const [projects, setProjects] = useState<ModerationProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string|null>(null);
  const [projectActionLoading, setProjectActionLoading] = useState<string|null>(null);
  const [projectRejectId, setProjectRejectId] = useState<string|null>(null);
  const [projectRejectReason, setProjectRejectReason] = useState("");
  const [projectRejectError, setProjectRejectError] = useState<string|null>(null);
  const [verifyConfirmId, setVerifyConfirmId] = useState<string|null>(null);
  const [photoActionLoading, setPhotoActionLoading] = useState<string|null>(null);
  const [statusSelect, setStatusSelect] = useState<Record<string,string>>({});

  // Dispatches moderation
  const [dispatches, setDispatches] = useState<ModerationDispatchItem[]>([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);
  const [dispatchesError, setDispatchesError] = useState<string|null>(null);
  const [dispatchActionLoading, setDispatchActionLoading] = useState<string|null>(null);
  const [dispatchRejectId, setDispatchRejectId] = useState<string|null>(null);
  const [dispatchRejectReason, setDispatchRejectReason] = useState("");
  const [dispatchRejectError, setDispatchRejectError] = useState<string|null>(null);

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

  const loadDispatches = async () => {
    if (!auth.idToken) return;
    setDispatchesLoading(true);
    setDispatchesError(null);
    try {
      const res = await getModerationDispatches(auth.idToken);
      setDispatches(res.items);
    } catch (e) {
      const err = e as ApiError;
      setDispatchesError(err.message || (t as Record<string,string>).deskDispatchesError);
    } finally {
      setDispatchesLoading(false);
    }
  };

  const handleDispatchPublish = async (id: string) => {
    if (!auth.idToken) return;
    setDispatchActionLoading(id);
    try {
      await moderateDispatch(auth.idToken, id, { action: "publish" });
      await loadDispatches();
      setActionMsg((t as Record<string,string>).deskActionSuccess);
    } catch (e) {
      const err = e as ApiError;
      setDispatchesError(err.message || (t as Record<string,string>).deskDispatchesError);
    } finally {
      setDispatchActionLoading(null);
    }
  };
  const handleDispatchReject = async () => {
    if (!auth.idToken || !dispatchRejectId) return;
    if (!dispatchRejectReason.trim()) { setDispatchRejectError((t as Record<string,string>).deskDispatchesRejectPlaceholder); return; }
    setDispatchActionLoading(dispatchRejectId);
    try {
      await moderateDispatch(auth.idToken, dispatchRejectId, { action: "reject", reason: dispatchRejectReason.trim() });
      setDispatchRejectId(null);
      setDispatchRejectReason("");
      await loadDispatches();
      setActionMsg((t as Record<string,string>).deskActionSuccess);
    } catch (e) {
      const err = e as ApiError;
      setDispatchRejectError(err.message || (t as Record<string,string>).deskDispatchesError);
    } finally {
      setDispatchActionLoading(null);
    }
  };

  const loadProjects = async () => {
    if (!auth.idToken) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await getModerationProjects(auth.idToken);
      setProjects(res.items);
    } catch (e) {
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleVerify = async (p: ModerationProjectItem) => {
    if (!auth.idToken) return;
    setProjectActionLoading(p.id);
    try {
      await moderateProject(auth.idToken, p.id, { action: "verify-committee" });
      await loadProjects();
    } catch (e) {
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally {
      setProjectActionLoading(null);
      setVerifyConfirmId(null);
    }
  };
  const handleProjectPublish = async (id: string) => {
    if (!auth.idToken) return;
    setProjectActionLoading(id);
    try{
      await moderateProject(auth.idToken, id, { action: "publish" });
      await loadProjects();
    } catch(e){
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally { setProjectActionLoading(null); }
  };
  const handleProjectReject = async () => {
    if (!auth.idToken || !projectRejectId) return;
    if (!projectRejectReason.trim()) { setProjectRejectError((t as Record<string,string>).deskProjectsRejectPlaceholder); return; }
    setProjectActionLoading(projectRejectId);
    try{
      await moderateProject(auth.idToken, projectRejectId, { action: "reject", reason: projectRejectReason.trim() });
      setProjectRejectId(null);
      setProjectRejectReason("");
      await loadProjects();
    } catch(e){
      const err = e as ApiError;
      setProjectRejectError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally { setProjectActionLoading(null); }
  };
  const handleSetStatus = async (id: string) => {
    if (!auth.idToken) return;
    const s = statusSelect[id];
    if (!s) return;
    setProjectActionLoading(id);
    try{
      await moderateProject(auth.idToken, id, { action: "set-status", status: s as never });
      await loadProjects();
    } catch(e){
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally { setProjectActionLoading(null); }
  };
  const handlePhotoAction = async (projectId: string, fileId: string, action: "publish-photo"|"reject-photo") => {
    if (!auth.idToken) return;
    setPhotoActionLoading(fileId);
    try{
      await moderateProject(auth.idToken, projectId, { action, fileId });
      await loadProjects();
    } catch(e){
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally { setPhotoActionLoading(null); }
  };
  const handleUpdateAction = async (projectId: string, updateId: string, action: "publish"|"reject") => {
    if (!auth.idToken) return;
    setPhotoActionLoading(updateId);
    try{
      await moderateProjectUpdate(auth.idToken, projectId, updateId, { action, reason: action==="reject" ? "rejected" : undefined });
      await loadProjects();
    } catch(e){
      const err = e as ApiError;
      setProjectsError(err.message || (t as Record<string,string>).deskProjectsError);
    } finally { setPhotoActionLoading(null); }
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
    if (activeTab === "projects" && auth.idToken) loadProjects();
    if (activeTab === "dispatches" && auth.idToken) loadDispatches();
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
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          aria-pressed={activeTab === "projects"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "projects" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {(t as Record<string,string>).deskProjectsTab} {projects.length ? `· ${projects.length}` : ""}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dispatches")}
          aria-pressed={activeTab === "dispatches"}
          className={`min-h-10 border-b-2 px-4 font-sans text-xs font-semibold uppercase tracking-wide ${activeTab === "dispatches" ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {(t as Record<string,string>).deskDispatchesTab} {dispatches.length ? `· ${dispatches.length}` : ""}
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

      {activeTab === "dispatches" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{(t as Record<string,string>).deskDispatchesTitle}</h2>
            <Button variant="outline" size="sm" onClick={loadDispatches}>{(t as Record<string,string>).dispatchesTryAgain ?? "Retry"}</Button>
          </div>
          {dispatchesLoading ? <p className="font-sans text-sm text-muted-foreground">{(t as Record<string,string>).deskDispatchesLoading}</p> : dispatchesError ? <p className="font-sans text-sm text-destructive" role="alert">{dispatchesError}</p> : dispatches.length===0 ? <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{(t as Record<string,string>).deskDispatchesEmpty}</p> : (
            <div className="grid gap-4">
              {dispatches.map(d=> {
                const title = typeof d.title === "string" ? d.title : (d.title as {en:string; ne?:string}).en || (Object.values(d.title as object)[0] as string);
                const body = typeof d.body === "string" ? d.body : (d.body as {en:string; ne?:string}).en || (Object.values(d.body as object)[0] as string);
                return (
                <Card key={d.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base leading-6">{title}</CardTitle>
                      <Badge variant="secondary">{d.status}</Badge>
                    </div>
                    <CardDescription className="font-sans text-xs">
                      {(t as Record<string,string>).dispatchMetaBy} {d.author.displayName}{d.author.place ? ` · ${d.author.place}` : ""} · {new Date(d.createdAt).toLocaleString()} · {d.tags.join(", ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="border border-rule bg-paper p-3">
                      <p className="font-serif text-sm leading-6 whitespace-pre-wrap break-words">{body}</p>
                    </div>
                    <div className="border border-dashed border-rule bg-card p-3">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">Private (moderators only)</p>
                      <p className="mt-2 font-sans text-sm"><span className="font-semibold">Email:</span> {d.author.email}</p>
                      <p className="font-sans text-xs text-muted-foreground">{(t as Record<string,string>).dispatchWriteEmailHint}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={()=>handleDispatchPublish(d.id)} disabled={!!dispatchActionLoading}>{dispatchActionLoading===d.id ? "…" : (t as Record<string,string>).deskDispatchesPublish}</Button>
                      <Button size="sm" variant="outline" onClick={()=>{ setDispatchRejectId(d.id); setDispatchRejectError(null); }}>{(t as Record<string,string>).deskDispatchesReject}</Button>
                    </div>
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
          <Dialog open={!!dispatchRejectId} onOpenChange={(open)=>{ if (!open) { setDispatchRejectId(null); setDispatchRejectReason(""); setDispatchRejectError(null); }}}>
            <DialogContent>
              <DialogHeader><DialogTitle>{(t as Record<string,string>).deskDispatchesRejectTitle}</DialogTitle><DialogDescription>{(t as Record<string,string>).deskDispatchesRejectPlaceholder}</DialogDescription></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="dispatchRejectReason">{(t as Record<string,string>).deskDispatchesRejectTitle}</Label>
                <Textarea id="dispatchRejectReason" value={dispatchRejectReason} onChange={e=>{setDispatchRejectReason(e.target.value); setDispatchRejectError(null);}} placeholder={(t as Record<string,string>).deskDispatchesRejectPlaceholder} rows={3} />
                {dispatchRejectError ? <p className="font-sans text-sm text-destructive">{dispatchRejectError}</p> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>{ setDispatchRejectId(null); setDispatchRejectReason("");}}>{t.deskCancel}</Button>
                <Button onClick={handleDispatchReject} disabled={!!dispatchActionLoading}>{dispatchActionLoading ? "…" : (t as Record<string,string>).deskDispatchesRejectConfirm}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {activeTab === "projects" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{(t as Record<string,string>).deskProjectsTitle}</h2>
            <Button variant="outline" size="sm" onClick={loadProjects}>{(t as Record<string,string>).projectsTryAgain}</Button>
          </div>
          {projectsLoading ? <p className="font-sans text-sm text-muted-foreground">{(t as Record<string,string>).deskProjectsLoading}</p> : projectsError ? <p className="font-sans text-sm text-destructive" role="alert">{projectsError}</p> : projects.length===0 ? <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{(t as Record<string,string>).deskProjectsEmpty}</p> : (
            <div className="grid gap-4">
              {projects.map(p=> (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{language==='ne' ? (p.title.ne || p.title.en) : p.title.en} <Badge variant="outline" className="ml-2 capitalize">{p.status}</Badge> {p.committee.verified ? <Badge variant="default" className="ml-1">{(t as Record<string,string>).deskProjectsVerified}</Badge> : <Badge variant="secondary" className="ml-1">{(t as Record<string,string>).deskProjectsNotVerified}</Badge>}</CardTitle>
                      <span className="font-sans text-xs text-muted-foreground">{p.district} · W{p.ward}</span>
                    </div>
                    <CardDescription className="font-mono text-xs">{p.id} · {p.type} · NPR {p.costEstimateNpr}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="font-serif text-sm leading-6 whitespace-pre-wrap">{language==='ne' ? (p.description.ne || p.description.en) : p.description.en}</p>
                    <p className="font-sans text-xs text-muted-foreground">{p.locationText}</p>
                    {p.photos.length>0 ? <div className="grid grid-cols-3 gap-2">{p.photos.map(ph=> <img key={ph.fileId} src={ph.url} alt={ph.caption||""} className="h-24 w-full object-cover border border-rule" loading="lazy" />)}</div> : null}
                    <div className="border border-rule bg-secondary px-3 py-2">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide">{(t as Record<string,string>).deskProjectsPrivateTitle}</p>
                      <p className="mt-1 font-sans text-sm">{p.committee.name} — {p.committee.contactName} · {p.committee.phone}</p>
                      <p className="font-sans text-xs">Bank: {p.committee.bank.bankName} / {p.committee.bank.accountName} / {p.committee.bank.accountNumber} {p.committee.esewaId ? "· eSewa:"+p.committee.esewaId : ""} {p.committee.khaltiId ? "· Khalti:"+p.committee.khaltiId : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={()=> setVerifyConfirmId(p.id)} disabled={!!projectActionLoading}>{(t as Record<string,string>).deskProjectsVerify}</Button>
                      <Button size="sm" onClick={()=> handleProjectPublish(p.id)} disabled={!!projectActionLoading || !p.committee.verified} title={!p.committee.verified ? (t as Record<string,string>).deskProjectsPublishDisabledHint : undefined}>{projectActionLoading===p.id ? "…" : (t as Record<string,string>).deskProjectsPublish}</Button>
                      <Button size="sm" variant="destructive" onClick={()=> { setProjectRejectId(p.id); setProjectRejectError(null); }}>{(t as Record<string,string>).deskProjectsReject}</Button>
                      <div className="flex items-center gap-1">
                        <Select value={statusSelect[p.id] || p.status} onChange={e=> setStatusSelect(prev=> ({...prev, [p.id]: e.target.value}))}>
                          {["pending","published","in-progress","completed","rejected","archived"].map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </Select>
                        <Button size="sm" variant="secondary" onClick={()=> handleSetStatus(p.id)} disabled={!!projectActionLoading}>{(t as Record<string,string>).deskProjectsSetStatus}</Button>
                      </div>
                    </div>
                    {/* pending photos - supports both pendingPhotos field and photos with status pending */}
                    {(() => {
                      const pending = (p as unknown as { pendingPhotos?: { fileId:string; url:string; caption?:string }[] }).pendingPhotos || p.photos.filter(ph=>ph.status==="pending");
                      return pending.length>0 ? (
                      <div className="border border-rule px-3 py-3">
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide mb-2">{(t as Record<string,string>).deskProjectsPhotoPending}</p>
                        <div className="grid gap-3">
                          {pending.map(ph=> (
                            <div key={ph.fileId} className="flex items-center gap-2">
                              <img src={ph.url} alt={ph.caption||""} className="h-20 w-20 object-cover border border-rule" />
                              <span className="font-sans text-xs flex-1 truncate">{ph.caption || ph.fileId}</span>
                              <Button size="sm" onClick={()=> handlePhotoAction(p.id, ph.fileId, "publish-photo")} disabled={photoActionLoading===ph.fileId}>{(t as Record<string,string>).deskProjectsPhotoPublish}</Button>
                              <Button size="sm" variant="destructive" onClick={()=> handlePhotoAction(p.id, ph.fileId, "reject-photo")} disabled={photoActionLoading===ph.fileId}>{(t as Record<string,string>).deskProjectsPhotoReject}</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                    })()}
                    {/* pending updates */}
                    {(() => {
                      const pendingU = (p as unknown as { pendingUpdates?: { id:string; text:string; photos: { fileId:string; url:string }[]; spentNpr?:number; createdAt:string }[] }).pendingUpdates || (p.updates || []).filter((u: unknown)=> (u as {status:string}).status==="pending") as never[];
                      return pendingU.length>0 ? (
                      <div className="border border-rule px-3 py-3">
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide mb-2">{(t as Record<string,string>).deskProjectsUpdatePending}</p>
                        <div className="grid gap-3">
                          {pendingU.map(u=> (
                            <div key={u.id} className="border border-rule bg-card p-3">
                              <p className="font-serif text-sm leading-6">{u.text}</p>
                              {u.spentNpr!=null ? <p className="font-sans text-xs text-muted-foreground">Spent NPR {u.spentNpr}</p> : null}
                              {u.photos && u.photos.length>0 ? <div className="flex gap-2 mt-2">{u.photos.map(ph=> <img key={ph.fileId} src={ph.url} alt="" className="h-16 w-16 object-cover border border-rule" />)}</div> : null}
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" onClick={()=> handleUpdateAction(p.id, u.id, "publish")} disabled={photoActionLoading===u.id}>{(t as Record<string,string>).deskProjectsUpdatePublish}</Button>
                                <Button size="sm" variant="destructive" onClick={()=> handleUpdateAction(p.id, u.id, "reject")} disabled={photoActionLoading===u.id}>{(t as Record<string,string>).deskProjectsUpdateReject}</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                    })()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={!!verifyConfirmId} onOpenChange={(o)=> { if(!o) setVerifyConfirmId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{(t as Record<string,string>).deskProjectsVerify}</DialogTitle><DialogDescription>{(() => {
            const proj = projects.find(x=> x.id===verifyConfirmId);
            if (!proj) return "";
            const tmpl = (t as Record<string,string>).deskProjectsVerifyConfirm;
            return tmpl.replace("{contactName}", proj.committee.contactName).replace("{phone}", proj.committee.phone);
          })()}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={()=> setVerifyConfirmId(null)}>{(t as Record<string,string>).deskCancel}</Button>
            <Button onClick={()=> { const proj = projects.find(x=> x.id===verifyConfirmId); if (proj) handleVerify(proj); }} disabled={!!projectActionLoading}>{projectActionLoading ? "…" : (t as Record<string,string>).deskProjectsVerify}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!projectRejectId} onOpenChange={(o)=> { if(!o){ setProjectRejectId(null); setProjectRejectError(null);} }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{(t as Record<string,string>).deskProjectsRejectReason}</DialogTitle><DialogDescription>{(t as Record<string,string>).deskProjectsRejectPlaceholder}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="projectRejectReason">{(t as Record<string,string>).deskProjectsRejectReason} *</Label>
            <Textarea id="projectRejectReason" value={projectRejectReason} onChange={e=>setProjectRejectReason(e.target.value)} placeholder={(t as Record<string,string>).deskProjectsRejectPlaceholder} rows={3} />
            {projectRejectError ? <p className="font-sans text-sm text-destructive" role="alert">{projectRejectError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=> { setProjectRejectId(null); setProjectRejectError(null); }}>{(t as Record<string,string>).deskCancel}</Button>
            <Button variant="destructive" onClick={handleProjectReject} disabled={!!projectActionLoading}>{projectActionLoading ? "…" : (t as Record<string,string>).deskProjectsReject}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
