import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  ackGuidelines,
  setMyDistricts,
  claimQueueItem,
  getAdminClimate,
  getAdminStats,
  getAdminUsers,
  getClaimsPrint,
  getModerationCenterFlags,
  getModerationDispatches,
  getModerationStories,
  moderateStory,
  getModerationFlags,
  getModerationOrgs,
  getModerationProjects,
  getModerationQueue,
  listNeeds,
  listOffers,
  lookupAdminUser,
  moderateDispatch,
  moderateNeed,
  moderateOrg,
  moderateProject,
  moderateProjectUpdate,
  redeemClaim,
  releaseQueueItem,
  setAdminUserRole,
  syncClaims,
  updateNeedStatus,
  type AdminStatsResponse,
  type AdminClimateStats,
  type AdminUser,
  type CenterFlagInboxItem,
  type ClaimPrintItem,
  type FlagInboxItem,
  type ModerationDispatchItem,
  type ModerationStoryItem,
  type ModerationOrgItem,
  type ModerationProjectItem,
  type ModerationQueueItem,
  type NeedPublic,
  type OfferPublic,
  type OrgStatus,
  type OrgTier,
  type SyncResult,
} from "@/lib/api";
import { useGoogleAuth } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { districtNames } from "@/lib/geo";
import { labels } from "@/i18n";
import { deskStrings } from "@/i18n/desk";
import { deskOrgStrings } from "@/i18n/desk-orgs";
import type { Language } from "@/lib/types";

export type DeskSection = "queue" | "boards" | "print" | "sync" | "flags" | "projects" | "dispatches" | "stories" | "orgs" | "admin" | "climate";

const sections = new Set<DeskSection>(["queue", "boards", "print", "sync", "flags", "projects", "dispatches", "stories", "orgs", "admin", "climate"]);

function initialSection(): DeskSection {
  if (typeof window !== "undefined") {
    const value = window.location.hash.slice(1) as DeskSection;
    if (sections.has(value)) return value;
  }
  return "queue";
}

function rejectReason(code: string, detail: string) {
  const reason = code.trim();
  const notes = detail.trim();
  return notes ? `${reason}: ${notes}` : reason;
}

export function useDesk(language: Language) {
  const auth = useGoogleAuth();
  const t = labels[language] as Record<string, string>;
  const ds = deskStrings[language] as Record<string, string>;
  const dos = deskOrgStrings[language] as Record<string, string>;

  const [activeSection, setActiveSectionState] = useState<DeskSection>(initialSection);
  const [ackedNow, setAckedNow] = useState(false);
  const [guidelinesChecked, setGuidelinesChecked] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [districtEditOpen, setDistrictEditOpen] = useState(false);
  const [districtSaving, setDistrictSaving] = useState(false);
  const [districtError, setDistrictError] = useState<string | null>(null);

  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueDistrict, setQueueDistrict] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState<Record<string, boolean>>({});
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState("");
  const [rejectDetail, setRejectDetail] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [claimActionLoading, setClaimActionLoading] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [publishedNeeds, setPublishedNeeds] = useState<NeedPublic[]>([]);
  const [offers, setOffers] = useState<OfferPublic[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<Record<string, string>>({});
  const [matchedContact, setMatchedContact] = useState<Record<string, unknown>>({});
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [fulfillId, setFulfillId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState<string | null>(null);
  const [redeemNote, setRedeemNote] = useState("");

  const [projects, setProjects] = useState<ModerationProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectActionLoading, setProjectActionLoading] = useState<string | null>(null);
  const [verifyProjectId, setVerifyProjectId] = useState<string | null>(null);
  const [projectRejectId, setProjectRejectId] = useState<string | null>(null);
  const [projectRejectCode, setProjectRejectCode] = useState("");
  const [projectRejectDetail, setProjectRejectDetail] = useState("");
  const [projectRejectError, setProjectRejectError] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<Record<string, string>>({});
  const [photoActionLoading, setPhotoActionLoading] = useState<string | null>(null);

  const [stories, setStories] = useState<ModerationStoryItem[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [dispatches, setDispatches] = useState<ModerationDispatchItem[]>([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);
  const [dispatchesError, setDispatchesError] = useState<string | null>(null);
  const [dispatchActionLoading, setDispatchActionLoading] = useState<string | null>(null);
  const [dispatchRejectId, setDispatchRejectId] = useState<string | null>(null);
  const [dispatchRejectCode, setDispatchRejectCode] = useState("");
  const [dispatchRejectDetail, setDispatchRejectDetail] = useState("");
  const [dispatchRejectError, setDispatchRejectError] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<ModerationOrgItem[]>([]);
  const [orgsStatus, setOrgsStatus] = useState<OrgStatus>("pending");
  const [orgsPendingCount, setOrgsPendingCount] = useState(0);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [orgActionLoading, setOrgActionLoading] = useState<string | null>(null);
  const [orgVerifyId, setOrgVerifyId] = useState<string | null>(null);
  const [orgVerifyTier, setOrgVerifyTier] = useState<OrgTier>("known");
  const [orgVerifyNote, setOrgVerifyNote] = useState("");
  const [orgVerifyError, setOrgVerifyError] = useState<string | null>(null);
  const [orgRejectId, setOrgRejectId] = useState<string | null>(null);
  const [orgRejectReason, setOrgRejectReason] = useState("");
  const [orgRejectError, setOrgRejectError] = useState<string | null>(null);
  const [orgSuspendId, setOrgSuspendId] = useState<string | null>(null);
  const [orgSuspendReason, setOrgSuspendReason] = useState("");
  const [orgSuspendError, setOrgSuspendError] = useState<string | null>(null);

  const [flags, setFlags] = useState<FlagInboxItem[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [centerFlags, setCenterFlags] = useState<CenterFlagInboxItem[]>([]);
  const [centerFlagsLoading, setCenterFlagsLoading] = useState(false);
  const [centerFlagsError, setCenterFlagsError] = useState<string | null>(null);

  const [printDistrict, setPrintDistrict] = useState<string>(districtNames[0] ?? "");
  const [printWard, setPrintWard] = useState("1");
  const [printItems, setPrintItems] = useState<ClaimPrintItem[]>([]);
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [syncText, setSyncText] = useState("");
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [adminLookupEmail, setAdminLookupEmail] = useState("");
  const [adminLookupUser, setAdminLookupUser] = useState<AdminUser | null>(null);
  const [adminLookupLoading, setAdminLookupLoading] = useState(false);
  const [adminLookupError, setAdminLookupError] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState("moderator");
  const [adminDistricts, setAdminDistricts] = useState<Record<string, boolean>>({});
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false);
  const [adminSaveLoading, setAdminSaveLoading] = useState(false);
  const [adminSaveMsg, setAdminSaveMsg] = useState<string | null>(null);
  const [adminSaveError, setAdminSaveError] = useState<string | null>(null);
  const [adminModerators, setAdminModerators] = useState<AdminUser[]>([]);
  const [adminModeratorsLoading, setAdminModeratorsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStatsResponse | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState<string | null>(null);
  const [climateStats, setClimateStats] = useState<AdminClimateStats | null>(null);
  const [climateStatsLoading, setClimateStatsLoading] = useState(false);
  const [climateStatsError, setClimateStatsError] = useState<string | null>(null);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionTimer = useRef<number | null>(null);
  const clearFeedback = useCallback(() => {
    setActionMsg(null);
    setActionError(null);
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
  }, []);
  const success = useCallback((message: string) => {
    setActionError(null);
    setActionMsg(message);
    if (actionTimer.current) window.clearTimeout(actionTimer.current);
    actionTimer.current = window.setTimeout(() => setActionMsg(null), 6000);
  }, []);
  useEffect(
    () => () => {
      if (actionTimer.current) window.clearTimeout(actionTimer.current);
    },
    [],
  );

  const isScoped = (auth.profile?.districts?.length ?? 0) > 0;
  const scopeDistricts = auth.profile?.districts ?? [];
  const scopeLabel = isScoped ? scopeDistricts.join(", ") : t.deskScopeAll;

  const setActiveSection = useCallback((section: DeskSection) => {
    setActiveSectionState(section);
    if (typeof window !== "undefined")
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${section}`);
  }, []);

  const loadQueue = useCallback(async () => {
    if (!auth.idToken) return;
    setQueueLoading(true);
    setQueueError(null);
    try {
      setQueue((await getModerationQueue(auth.idToken)).items);
    } catch (error) {
      setQueueError(apiErrorMessage(error, language));
    } finally {
      setQueueLoading(false);
    }
  }, [auth.idToken, language]);
  const loadBoards = useCallback(async () => {
    if (!auth.idToken) return;
    setBoardsLoading(true);
    setBoardsError(null);
    try {
      const [needs, availableOffers] = await Promise.all([listNeeds({}, auth.idToken), listOffers({}, auth.idToken)]);
      setPublishedNeeds(needs.items as NeedPublic[]);
      setOffers(availableOffers.items);
    } catch (error) {
      setBoardsError(apiErrorMessage(error, language));
    } finally {
      setBoardsLoading(false);
    }
  }, [auth.idToken, language]);
  const loadFlags = useCallback(async () => {
    if (!auth.idToken) return;
    setFlagsLoading(true);
    setFlagsError(null);
    try {
      setFlags((await getModerationFlags(auth.idToken)).items);
    } catch (error) {
      setFlagsError(apiErrorMessage(error, language));
    } finally {
      setFlagsLoading(false);
    }
  }, [auth.idToken, language]);
  const loadCenterFlags = useCallback(async () => {
    if (!auth.idToken) return;
    setCenterFlagsLoading(true);
    setCenterFlagsError(null);
    try {
      setCenterFlags((await getModerationCenterFlags(auth.idToken)).items);
    } catch (error) {
      setCenterFlagsError(apiErrorMessage(error, language));
    } finally {
      setCenterFlagsLoading(false);
    }
  }, [auth.idToken, language]);
  const loadProjects = useCallback(async () => {
    if (!auth.idToken) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      setProjects((await getModerationProjects(auth.idToken)).items);
    } catch (error) {
      setProjectsError(apiErrorMessage(error, language));
    } finally {
      setProjectsLoading(false);
    }
  }, [auth.idToken, language]);
  const loadDispatches = useCallback(async () => {
    if (!auth.idToken) return;
    setDispatchesLoading(true);
    setDispatchesError(null);
    try {
      setDispatches((await getModerationDispatches(auth.idToken)).items);
    } catch (error) {
      setDispatchesError(apiErrorMessage(error, language));
    } finally {
      setDispatchesLoading(false);
    }
  }, [auth.idToken, language]);
  const loadStories = useCallback(async () => {
    if (!auth.idToken) return;
    setStoriesLoading(true);
    setStoriesError(null);
    try {
      setStories((await getModerationStories(auth.idToken)).items);
    } catch (error) {
      setStoriesError(apiErrorMessage(error, language));
    } finally {
      setStoriesLoading(false);
    }
  }, [auth.idToken, language]);
  const loadOrgs = useCallback(
    async (status: OrgStatus = orgsStatus) => {
      if (!auth.idToken) return;
      setOrgsLoading(true);
      setOrgsError(null);
      try {
        setOrgs((await getModerationOrgs(auth.idToken, status)).items);
      } catch (error) {
        setOrgsError(apiErrorMessage(error, language));
      } finally {
        setOrgsLoading(false);
      }
    },
    [auth.idToken, language, orgsStatus],
  );
  const loadOrgCount = useCallback(async () => {
    if (!auth.idToken) return;
    try {
      setOrgsPendingCount((await getModerationOrgs(auth.idToken, "pending")).items.length);
    } catch {
      /* retain count */
    }
  }, [auth.idToken]);
  const loadPrint = useCallback(async () => {
    if (!auth.idToken || !printDistrict || !printWard) return;
    setPrintLoading(true);
    setPrintError(null);
    try {
      setPrintItems((await getClaimsPrint(auth.idToken, { district: printDistrict, ward: Number(printWard) })).items);
    } catch (error) {
      setPrintItems([]);
      setPrintError(apiErrorMessage(error, language));
    } finally {
      setPrintLoading(false);
    }
  }, [auth.idToken, language, printDistrict, printWard]);
  const loadAdminModerators = useCallback(async () => {
    if (!auth.idToken) return;
    setAdminModeratorsLoading(true);
    try {
      setAdminModerators((await getAdminUsers(auth.idToken, { role: "moderator" })).items);
    } catch {
      setAdminModerators([]);
    } finally {
      setAdminModeratorsLoading(false);
    }
  }, [auth.idToken]);
  const loadAdminStats = useCallback(async () => {
    if (!auth.idToken) return;
    setAdminStatsLoading(true);
    setAdminStatsError(null);
    try {
      setAdminStats(await getAdminStats(auth.idToken));
    } catch (error) {
      setAdminStatsError(apiErrorMessage(error, language));
    } finally {
      setAdminStatsLoading(false);
    }
  }, [auth.idToken, language]);
  const loadClimateStats = useCallback(async () => {
    if (!auth.idToken) return;
    setClimateStatsLoading(true);
    setClimateStatsError(null);
    try {
      setClimateStats(await getAdminClimate(auth.idToken));
    } catch (error) {
      setClimateStatsError(apiErrorMessage(error, language));
    } finally {
      setClimateStatsLoading(false);
    }
  }, [auth.idToken, language]);

  useEffect(() => {
    if (!auth.idToken || !auth.profile || (auth.profile.role !== "moderator" && auth.profile.role !== "admin")) return;
    void loadQueue();
    void loadBoards();
    void loadFlags();
    void loadCenterFlags();
    void loadOrgCount();
  }, [auth.idToken, auth.profile?.role, loadBoards, loadCenterFlags, loadFlags, loadOrgCount, loadQueue]);
  useEffect(() => {
    if (!auth.idToken) return;
    if (activeSection === "projects") void loadProjects();
    if (activeSection === "dispatches") void loadDispatches();
    if (activeSection === "stories") void loadStories();
    if (activeSection === "orgs") void loadOrgs(orgsStatus);
    if (activeSection === "flags") {
      void loadFlags();
      void loadCenterFlags();
    }
    if (activeSection === "admin") {
      void loadAdminModerators();
      void loadAdminStats();
    }
    if (activeSection === "climate" && auth.profile?.role === "admin") void loadClimateStats();
  }, [
    activeSection,
    auth.idToken,
    auth.profile?.role,
    loadAdminModerators,
    loadAdminStats,
    loadClimateStats,
    loadCenterFlags,
    loadDispatches,
    loadStories,
    loadFlags,
    loadOrgs,
    loadProjects,
    orgsStatus,
  ]);
  useEffect(() => {
    if (isScoped && scopeDistricts[0]) setPrintDistrict(scopeDistricts[0] as string);
  }, [isScoped, scopeDistricts]);
  useEffect(() => {
    if (activeSection !== "queue") return;
    if (!queue.some((item) => item.claimExpiresAt)) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeSection, queue]);

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) => {
        const district = item.district || item.districts?.[0] || "";
        const text =
          `${item.maskedName ?? ""} ${item.helperLabel ?? ""} ${item.category ?? ""} ${(item.categories ?? []).join(" ")}`.toLowerCase();
        const inScope = !isScoped || !district || scopeDistricts.includes(String(district));
        return (
          inScope &&
          (!queueDistrict || district === queueDistrict) &&
          (!queueSearch.trim() || text.includes(queueSearch.trim().toLowerCase()))
        );
      }),
    [isScoped, queue, queueDistrict, queueSearch, scopeDistricts],
  );
  const filteredNeeds = useMemo(
    () => (isScoped ? publishedNeeds.filter((n) => scopeDistricts.includes(String(n.district))) : publishedNeeds),
    [isScoped, publishedNeeds, scopeDistricts],
  );
  const filteredProjects = useMemo(
    () => (isScoped ? projects.filter((p) => scopeDistricts.includes(String(p.district))) : projects),
    [isScoped, projects, scopeDistricts],
  );
  const filteredOffers = useMemo(
    () =>
      isScoped ? offers.filter((offer) => offer.districts.length === 0 || offer.districts.some((d) => scopeDistricts.includes(d))) : offers,
    [isScoped, offers, scopeDistricts],
  );
  const filteredPrintItems = useMemo(
    () =>
      isScoped
        ? printItems.filter((item) => scopeDistricts.includes(String((item as unknown as { district?: string }).district ?? printDistrict)))
        : printItems,
    [isScoped, printDistrict, printItems, scopeDistricts],
  );

  const handlePublish = async (id: string) => {
    if (!auth.idToken) return;
    clearFeedback();
    setActionError(null);
    try {
      await moderateNeed(auth.idToken, id, { action: "publish" });
      success(t.deskActionSuccess);
      setQueue((items) => items.filter((item) => item.id !== id));
      void loadBoards();
    } catch (error) {
      setActionError(apiErrorMessage(error, language));
    }
  };
  const handleReject = async () => {
    if (!auth.idToken || !rejectId || !rejectCode) {
      setRejectError(t.deskRejectReasonRequired);
      return;
    }
    clearFeedback();
    setRejectError(null);
    try {
      await moderateNeed(auth.idToken, rejectId, { action: "reject", reason: rejectReason(rejectCode, rejectDetail) });
      success(t.deskActionSuccess);
      setQueue((items) => items.filter((item) => item.id !== rejectId));
      setRejectId(null);
    } catch (error) {
      setRejectError(apiErrorMessage(error, language));
    }
  };
  const handleClaim = async (id: string) => {
    if (!auth.idToken) return;
    setClaimActionLoading(id);
    clearFeedback();
    try {
      const result = await claimQueueItem(auth.idToken, id);
      setQueue((items) => items.map((item) => (item.id === id ? { ...item, ...result } : item)));
    } catch (error) {
      const apiError = error as ApiError;
      setActionError(apiError.status === 409 ? t.deskAlreadyClaimed : apiErrorMessage(error, language));
      void loadQueue();
    } finally {
      setClaimActionLoading(null);
    }
  };
  const handleRelease = async (id: string) => {
    if (!auth.idToken) return;
    setClaimActionLoading(id);
    clearFeedback();
    try {
      await releaseQueueItem(auth.idToken, id);
      setQueue((items) =>
        items.map((item) => (item.id === id ? { ...item, claimedBy: undefined, claimedByName: undefined, claimExpiresAt: undefined } : item)),
      );
    } catch (error) {
      setActionError(apiErrorMessage(error, language));
    } finally {
      setClaimActionLoading(null);
    }
  };
  const handleNeedStatus = async (needId: string, status: "matched" | "fulfilled" | "archived") => {
    if (!auth.idToken) return;
    const offerId = selectedOfferId[needId];
    if (status === "matched" && !offerId) return;
    clearFeedback();
    try {
      const result = await updateNeedStatus(auth.idToken, needId, { status, offerId: status === "matched" ? offerId : undefined });
      if (result.contact) setMatchedContact((items) => ({ ...items, [needId]: result.contact }));
      success(t.deskActionSuccess);
      setArchiveId(null);
      setFulfillId(null);
      void loadBoards();
    } catch (error) {
      setActionError(apiErrorMessage(error, language));
    }
  };
  const handleRedeem = async () => {
    if (!auth.idToken || !redeemCode) return;
    clearFeedback();
    try {
      await redeemClaim(auth.idToken, redeemCode, { note: redeemNote || undefined });
      success(t.deskRedeemSuccess);
      setRedeemCode(null);
      setRedeemNote("");
      void loadBoards();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 409) setActionError(t.deskRedeemAlready);
      else if (apiError.status === 404) setActionError(t.deskRedeemUnknown);
      else setActionError(apiErrorMessage(error, language));
      setRedeemCode(null);
    }
  };
  const handleSync = async () => {
    if (!auth.idToken) return;
    const lines = syncText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setSyncError(t.deskSyncEmpty);
      return;
    }
    if (lines.length > 200) {
      setSyncError(ds.syncMaxCodes);
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      const redemptions = lines.map((line) => {
        const [code, ...note] = line.split(/\s+/);
        return { code: code.toUpperCase(), redeemedAt: new Date().toISOString(), note: note.join(" ") || undefined };
      });
      setSyncResults((await syncClaims(auth.idToken, { redemptions })).results);
      success(t.deskActionSuccess);
      void loadBoards();
    } catch (error) {
      setSyncError(apiErrorMessage(error, language));
    } finally {
      setSyncLoading(false);
    }
  };
  const handleDispatchPublish = async (id: string) => {
    if (!auth.idToken) return;
    setDispatchActionLoading(id);
    try {
      await moderateDispatch(auth.idToken, id, { action: "publish" });
      success(t.deskActionSuccess);
      void loadDispatches();
    } catch (error) {
      setDispatchesError(apiErrorMessage(error, language));
    } finally {
      setDispatchActionLoading(null);
    }
  };
  const handleStoryModerate = async (id: string, action: "publish" | "reject", reason?: string) => {
    if (!auth.idToken) return;
    try {
      await moderateStory(auth.idToken, id, reason ? { action, reason } : { action });
      success(t.deskActionSuccess);
      void loadStories();
    } catch (error) {
      setStoriesError(apiErrorMessage(error, language));
    }
  };
  const handleDispatchReject = async () => {
    if (!auth.idToken || !dispatchRejectId || !dispatchRejectCode) {
      setDispatchRejectError(t.deskRejectReasonRequired);
      return;
    }
    setDispatchActionLoading(dispatchRejectId);
    try {
      await moderateDispatch(auth.idToken, dispatchRejectId, {
        action: "reject",
        reason: rejectReason(dispatchRejectCode, dispatchRejectDetail),
      });
      success(t.deskActionSuccess);
      setDispatchRejectId(null);
      void loadDispatches();
    } catch (error) {
      setDispatchRejectError(apiErrorMessage(error, language));
    } finally {
      setDispatchActionLoading(null);
    }
  };
  const handleProject = async (id: string, body: Parameters<typeof moderateProject>[2]) => {
    if (!auth.idToken) return;
    setProjectActionLoading(id);
    try {
      await moderateProject(auth.idToken, id, body);
      success(t.deskActionSuccess);
      void loadProjects();
    } catch (error) {
      setProjectsError(apiErrorMessage(error, language));
    } finally {
      setProjectActionLoading(null);
      setVerifyProjectId(null);
    }
  };
  const handleProjectReject = async () => {
    if (!projectRejectId || !projectRejectCode) {
      setProjectRejectError(t.deskRejectReasonRequired);
      return;
    }
    await handleProject(projectRejectId, { action: "reject", reason: rejectReason(projectRejectCode, projectRejectDetail) });
    setProjectRejectId(null);
  };
  const handleProjectUpdate = async (projectId: string, updateId: string, action: "publish" | "reject") => {
    if (!auth.idToken) return;
    setPhotoActionLoading(updateId);
    try {
      await moderateProjectUpdate(auth.idToken, projectId, updateId, { action, reason: action === "reject" ? "rejected" : undefined });
      success(t.deskActionSuccess);
      void loadProjects();
    } catch (error) {
      setProjectsError(apiErrorMessage(error, language));
    } finally {
      setPhotoActionLoading(null);
    }
  };
  const handleOrg = async (id: string, body: Parameters<typeof moderateOrg>[2]) => {
    if (!auth.idToken) return;
    setOrgActionLoading(id);
    try {
      await moderateOrg(auth.idToken, id, body);
      success(dos.orgActionSuccess);
      setOrgVerifyId(null);
      setOrgRejectId(null);
      setOrgSuspendId(null);
      void loadOrgs();
      void loadOrgCount();
    } catch (error) {
      setOrgsError(apiErrorMessage(error, language));
    } finally {
      setOrgActionLoading(null);
    }
  };
  const handleAdminLookup = async () => {
    if (!auth.idToken || !adminLookupEmail.trim()) return;
    setAdminLookupLoading(true);
    setAdminLookupError(null);
    try {
      const user = await lookupAdminUser(auth.idToken, adminLookupEmail.trim());
      setAdminLookupUser(user);
      setAdminRole(user.role);
      setAdminDistricts(Object.fromEntries((user.districts ?? []).map((district) => [district, true])));
    } catch (error) {
      setAdminLookupUser(null);
      setAdminLookupError((error as ApiError).status === 404 ? t.deskAdminLookupEmpty : t.deskAdminLookupError);
    } finally {
      setAdminLookupLoading(false);
    }
  };
  const handleAdminSave = async () => {
    if (!auth.idToken || !adminLookupUser) return;
    setAdminSaveLoading(true);
    setAdminSaveError(null);
    try {
      await setAdminUserRole(auth.idToken, adminLookupUser.sub, {
        role: adminRole,
        districts: Object.keys(adminDistricts).filter((district) => adminDistricts[district]),
      });
      setAdminSaveMsg(t.deskAdminSaveSuccess);
      success(t.deskAdminSaveSuccess);
      setAdminConfirmOpen(false);
      void loadAdminModerators();
      void loadAdminStats();
    } catch (error) {
      setAdminSaveError(apiErrorMessage(error, language));
    } finally {
      setAdminSaveLoading(false);
    }
  };
  const handleAck = async () => {
    if (!auth.idToken) return;
    if (!guidelinesChecked) {
      setAckError(ds.guidelinesAckRequired);
      return;
    }
    setAckLoading(true);
    setAckError(null);
    try {
      await ackGuidelines(auth.idToken);
      setAckedNow(true);
      setGuidelinesChecked(false);
    } catch (error) {
      setAckError(apiErrorMessage(error, language));
    } finally {
      setAckLoading(false);
    }
  };
  const handleSetDistricts = async (districts: string[]) => {
    if (!auth.idToken) return;
    setDistrictSaving(true);
    setDistrictError(null);
    try {
      await setMyDistricts(auth.idToken, districts);
      if (auth.profile) auth.setProfile({ ...auth.profile, districts });
      setDistrictEditOpen(false);
    } catch (error) {
      setDistrictError(apiErrorMessage(error, language));
    } finally {
      setDistrictSaving(false);
    }
  };

  return {
    auth,
    t,
    ds,
    dos,
    language,
    activeSection,
    setActiveSection,
    ackedNow,
    guidelinesChecked,
    setGuidelinesChecked,
    ackLoading,
    ackError,
    handleAck,
    districtEditOpen,
    setDistrictEditOpen,
    districtSaving,
    districtError,
    handleSetDistricts,
    isScoped,
    scopeDistricts,
    scopeLabel,
    queue,
    filteredQueue,
    queueLoading,
    queueError,
    loadQueue,
    queueDistrict,
    setQueueDistrict,
    queueSearch,
    setQueueSearch,
    publishConfirmed,
    setPublishConfirmed,
    rejectId,
    setRejectId,
    rejectCode,
    setRejectCode,
    rejectDetail,
    setRejectDetail,
    rejectError,
    setRejectError,
    handlePublish,
    handleReject,
    claimActionLoading,
    nowTick,
    myModeratorId: auth.profile?.sub,
    handleClaim,
    handleRelease,
    publishedNeeds,
    filteredNeeds,
    filteredOffers,
    boardsLoading,
    boardsError,
    loadBoards,
    selectedOfferId,
    setSelectedOfferId,
    matchedContact,
    archiveId,
    setArchiveId,
    fulfillId,
    setFulfillId,
    redeemCode,
    setRedeemCode,
    redeemNote,
    setRedeemNote,
    handleNeedStatus,
    handleRedeem,
    projects: filteredProjects,
    projectsCount: projects.length,
    projectsLoading,
    projectsError,
    loadProjects,
    projectActionLoading,
    verifyProjectId,
    setVerifyProjectId,
    projectRejectId,
    setProjectRejectId,
    projectRejectCode,
    setProjectRejectCode,
    projectRejectDetail,
    setProjectRejectDetail,
    projectRejectError,
    setProjectRejectError,
    projectStatus,
    setProjectStatus,
    photoActionLoading,
    handleProject,
    handleProjectReject,
    handleProjectUpdate,
    dispatches,
    dispatchesLoading,
    dispatchesError,
    loadDispatches,
    dispatchActionLoading,
    dispatchRejectId,
    setDispatchRejectId,
    dispatchRejectCode,
    setDispatchRejectCode,
    dispatchRejectDetail,
    setDispatchRejectDetail,
    dispatchRejectError,
    setDispatchRejectError,
    handleDispatchPublish,
    handleDispatchReject,
    stories,
    storiesLoading,
    storiesError,
    loadStories,
    handleStoryModerate,
    orgs,
    orgsStatus,
    setOrgsStatus,
    orgsPendingCount,
    orgsLoading,
    orgsError,
    loadOrgs,
    orgActionLoading,
    orgVerifyId,
    setOrgVerifyId,
    orgVerifyTier,
    setOrgVerifyTier,
    orgVerifyNote,
    setOrgVerifyNote,
    orgVerifyError,
    setOrgVerifyError,
    orgRejectId,
    setOrgRejectId,
    orgRejectReason,
    setOrgRejectReason,
    orgRejectError,
    setOrgRejectError,
    orgSuspendId,
    setOrgSuspendId,
    orgSuspendReason,
    setOrgSuspendReason,
    orgSuspendError,
    setOrgSuspendError,
    handleOrg,
    flags,
    flagsLoading,
    flagsError,
    loadFlags,
    centerFlags,
    centerFlagsLoading,
    centerFlagsError,
    loadCenterFlags,
    printDistrict,
    setPrintDistrict,
    printWard,
    setPrintWard,
    printItems: filteredPrintItems,
    printLoading,
    printError,
    loadPrint,
    syncText,
    setSyncText,
    syncResults,
    syncLoading,
    syncError,
    handleSync,
    adminLookupEmail,
    setAdminLookupEmail,
    adminLookupUser,
    adminLookupLoading,
    adminLookupError,
    adminRole,
    setAdminRole,
    adminDistricts,
    setAdminDistricts,
    adminConfirmOpen,
    setAdminConfirmOpen,
    adminSaveLoading,
    adminSaveMsg,
    adminSaveError,
    adminModerators,
    adminModeratorsLoading,
    adminStats,
    adminStatsLoading,
    adminStatsError,
    loadAdminStats,
    climateStats,
    climateStatsLoading,
    climateStatsError,
    loadClimateStats,
    handleAdminLookup,
    handleAdminSave,
    actionMsg,
    actionError,
  };
}

export type DeskModel = ReturnType<typeof useDesk>;
