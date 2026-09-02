import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import QRCode from "qrcode";
import {
  ApiError,
  acceptOrgInvite,
  confirmDonation as confirmDonationApi,
  createCenter,
  createEntry,
  declineOrgInvite,
  getCenterStock,
  inviteOrgMember,
  listCenterDonations,
  listCenterEntries,
  listCenters,
  listInbound,
  listMyOrgs,
  listOrgCenters,
  listOrgMembers,
  receiveTransfer as receiveTransferApi,
  removeOrgMember,
  updateCenter,
  updateOrg,
  vouchOrg,
  ORG_TYPES,
  type CenterPrivate,
  type CenterPublic,
  type CenterStatus,
  type CreateCenterBody,
  type DonationStatus,
  type InboundTransfer,
  type MyOrg,
  type OrgMember,
  type OrgType,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { enqueue, flush, load as loadQueue, save as saveQueue, type QueuedEntry } from "@/lib/goods-queue";
import { orgStrings } from "@/i18n/orgs";
import { fillTemplate } from "@/lib/edition";
import type { Language } from "@/lib/types";
import type { CenterForm, DialogState, LogForm, OrgController, OrgEditForm } from "./org-types";

const emptyCenterForm = (): CenterForm => ({
  id: null,
  name: "",
  district: "",
  ward: "",
  address: "",
  lat: "",
  lng: "",
  hours: "",
  contactPhone: "",
  accepts: [],
  notes: "",
});
const emptyEditForm = (): OrgEditForm => ({
  name: "",
  orgType: "",
  registrationNumber: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  districts: [],
  description: "",
  website: "",
});
const defaultLogForm = (): LogForm => ({
  entryType: "intake",
  category: "",
  qty: "",
  note: "",
  destinationType: "center",
  destinationCenterId: "",
  destinationLabel: "",
  error: null,
  fieldErrors: {},
  submitting: false,
});
const emptyDialogs = (): DialogState => ({
  receive: { open: false, centerId: null, transfer: null, qtyReceived: "", note: "", error: null, submitting: false },
  correction: { open: false, centerId: null, entryId: null, note: "", error: null, submitting: false },
  donation: { open: false, ref: null, centerId: null, qty: "", error: null, submitting: false, mode: "receive" },
  remove: { open: false, member: null, error: null, submitting: false },
});

function validPhone(value: string) {
  return /^[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ""));
}
function validEmail(value: string) {
  return value.includes("@");
}
function validQty(value: string, allowZero = false) {
  return (
    value !== "" &&
    Number.isFinite(Number(value)) &&
    (allowZero ? Number(value) >= 0 : Number(value) > 0) &&
    Number(value) <= 1000000 &&
    /^\d+(\.\d{1,2})?$/.test(value.trim())
  );
}

function centerPayload(form: CenterForm): { body?: CreateCenterBody; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  const address = form.address.trim();
  if (name.length < 1 || name.length > 100) errors.name = "validationCenterName";
  if (!form.district) errors.district = "validationCenterDistrict";
  if (form.ward.trim() && (!Number.isInteger(Number(form.ward)) || Number(form.ward) < 1 || Number(form.ward) > 33))
    errors.ward = "validationCenterWard";
  if (address.length < 1 || address.length > 300) errors.address = "validationCenterAddress";
  const hasLat = form.lat.trim() !== "";
  const hasLng = form.lng.trim() !== "";
  if (hasLat !== hasLng) errors.latLng = "validationCenterLatLngPair";
  if (hasLat && (Number(form.lat) < 26 || Number(form.lat) > 31 || Number.isNaN(Number(form.lat)))) errors.lat = "validationCenterLat";
  if (hasLng && (Number(form.lng) < 80 || Number(form.lng) > 89 || Number.isNaN(Number(form.lng)))) errors.lng = "validationCenterLng";
  if (form.hours.trim().length > 200) errors.hours = "validationCenterHours";
  if (!validPhone(form.contactPhone.trim())) errors.contactPhone = "validationCenterContactPhone";
  if (form.accepts.length === 0) errors.accepts = "validationCenterAccepts";
  if (form.notes.trim().length > 500) errors.notes = "validationCenterNotes";
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    body: {
      name,
      district: form.district,
      ward: form.ward ? Number(form.ward) : undefined,
      address,
      lat: hasLat ? Number(form.lat) : undefined,
      lng: hasLng ? Number(form.lng) : undefined,
      hours: form.hours.trim() || undefined,
      contactPhone: form.contactPhone.trim(),
      accepts: form.accepts,
      notes: form.notes.trim() || undefined,
    },
  };
}

export function statusTone(status: string) {
  if (status === "open" || status === "verified" || status === "received") return "success" as const;
  if (status === "pending" || status === "paused" || status === "declared" || status === "in_transit") return "warning" as const;
  if (status === "rejected" || status === "suspended" || status === "closed" || status === "not_received") return "danger" as const;
  return "neutral" as const;
}

export function orgStatusLabel(org: MyOrg, t: Record<string, string>) {
  if (org.status === "pending") return t.orgStatusPending;
  if (org.status === "rejected")
    return `${t.orgStatusRejected}${org.rejectionReason ? ` — ${t.orgStatusReasonPrefix} ${org.rejectionReason}` : ""}`;
  if (org.status === "suspended")
    return `${t.orgStatusSuspended}${org.suspensionReason ? ` — ${t.orgStatusReasonPrefix} ${org.suspensionReason}` : ""}`;
  return org.tier === "known"
    ? t.orgStatusVerifiedKnown
    : org.tier === "vouched"
      ? t.orgStatusVerifiedVouched
      : t.orgStatusVerifiedSelfDeclared;
}

export function useOrg(language: Language): OrgController {
  const t = orgStrings[language] as Record<string, string>;
  const auth = useGoogleAuth();
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [invites, setInvites] = useState<{ orgId: string; orgName: string }[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centers, setCenters] = useState<CenterPrivate[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [centersError, setCentersError] = useState<string | null>(null);
  const [stockById, setStockById] = useState<Record<string, import("@/lib/api").StockItem[]>>({});
  const [stockLoadingById, setStockLoadingById] = useState<Record<string, boolean>>({});
  const [stockErrorById, setStockErrorById] = useState<Record<string, string | null>>({});
  const [entriesById, setEntriesById] = useState<Record<string, import("@/lib/api").GoodsEntry[]>>({});
  const [cursorById, setCursorById] = useState<Record<string, string | undefined>>({});
  const [entriesLoadingById, setEntriesLoadingById] = useState<Record<string, boolean>>({});
  const [entriesErrorById, setEntriesErrorById] = useState<Record<string, string | null>>({});
  const [inboundById, setInboundById] = useState<Record<string, InboundTransfer[]>>({});
  const [inboundLoadingById, setInboundLoadingById] = useState<Record<string, boolean>>({});
  const [inboundErrorById, setInboundErrorById] = useState<Record<string, string | null>>({});
  const [donationsById, setDonationsById] = useState<Record<string, DonationStatus[]>>({});
  const [donationsLoadingById, setDonationsLoadingById] = useState<Record<string, boolean>>({});
  const [donationsErrorById, setDonationsErrorById] = useState<Record<string, string | null>>({});
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [publicCenters, setPublicCenters] = useState<CenterPublic[] | null>(null);
  const [publicCentersLoading, setPublicCentersLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [logFormById, setLogFormById] = useState<Record<string, LogForm>>({});
  const [centerStatusUpdating, setCenterStatusUpdating] = useState<Record<string, boolean>>({});
  const [centerStatusError, setCenterStatusError] = useState<Record<string, string | null>>({});
  const [queue, setQueue] = useState<QueuedEntry[]>(() => loadQueue());
  const [queueFlushing, setQueueFlushing] = useState(false);
  const [centerForm, setCenterForm] = useState(emptyCenterForm);
  const [centerFormOpen, setCenterFormOpen] = useState(false);
  const [centerFormErrors, setCenterFormErrors] = useState<Record<string, string>>({});
  const [centerFormApiError, setCenterFormApiError] = useState<string | null>(null);
  const [centerSubmitting, setCenterSubmitting] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editApiError, setEditApiError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [vouchTargetId, setVouchTargetId] = useState("");
  const [vouchSubmitting, setVouchSubmitting] = useState(false);
  const [vouchMsg, setVouchMsg] = useState<string | null>(null);
  const [vouchError, setVouchError] = useState<string | null>(null);
  const [copiedOrgId, setCopiedOrgId] = useState(false);
  const [dialogs, setDialogs] = useState<DialogState>(emptyDialogs);
  const [qrCenter, setQrCenter] = useState<CenterPrivate | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteActing, setInviteActing] = useState<string | null>(null);
  const selectedOrg = useMemo(() => orgs?.find((org) => org.id === selectedId) ?? null, [orgs, selectedId]);
  const isOwner = selectedOrg?.role === "owner";

  const fetchOrgs = useCallback(async () => {
    if (!auth.idToken) return;
    setLoadingOrgs(true);
    setOrgsError(null);
    try {
      const response = await listMyOrgs(auth.idToken);
      setOrgs(response.items);
      setInvites(response.invites ?? []);
      setSelectedId((current) =>
        response.items.length === 0 ? null : current && response.items.some((org) => org.id === current) ? current : response.items[0].id,
      );
    } catch (error) {
      setOrgsError(apiErrorMessage(error, language));
    } finally {
      setLoadingOrgs(false);
    }
  }, [auth.idToken, language]);

  const fetchCenters = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) {
      setCenters([]);
      return;
    }
    setLoadingCenters(true);
    setCentersError(null);
    try {
      setCenters((await listOrgCenters(auth.idToken, selectedOrg.id)).items);
    } catch (error) {
      setCentersError(apiErrorMessage(error, language));
    } finally {
      setLoadingCenters(false);
    }
  }, [auth.idToken, language, selectedOrg]);

  const fetchStock = useCallback(
    async (centerId: string) => {
      setStockLoadingById((state) => ({ ...state, [centerId]: true }));
      setStockErrorById((state) => ({ ...state, [centerId]: null }));
      try {
        const response = await getCenterStock(centerId);
        setStockById((state) => ({ ...state, [centerId]: response.items }));
      } catch (error) {
        setStockErrorById((state) => ({ ...state, [centerId]: apiErrorMessage(error, language) }));
      } finally {
        setStockLoadingById((state) => ({ ...state, [centerId]: false }));
      }
    },
    [language],
  );

  const fetchEntries = useCallback(
    async (centerId: string, cursor?: string, append = false) => {
      setEntriesLoadingById((state) => ({ ...state, [centerId]: true }));
      setEntriesErrorById((state) => ({ ...state, [centerId]: null }));
      try {
        const response = await listCenterEntries(centerId, cursor ? { cursor } : {}, auth.idToken ?? undefined);
        setEntriesById((state) => ({ ...state, [centerId]: append ? [...(state[centerId] ?? []), ...response.items] : response.items }));
        setCursorById((state) => ({ ...state, [centerId]: response.cursor }));
      } catch (error) {
        setEntriesErrorById((state) => ({ ...state, [centerId]: apiErrorMessage(error, language) }));
      } finally {
        setEntriesLoadingById((state) => ({ ...state, [centerId]: false }));
      }
    },
    [auth.idToken, language],
  );

  const fetchInbound = useCallback(
    async (centerId: string) => {
      if (!auth.idToken) return;
      setInboundLoadingById((state) => ({ ...state, [centerId]: true }));
      setInboundErrorById((state) => ({ ...state, [centerId]: null }));
      try {
        const response = await listInbound(auth.idToken!, centerId);
        setInboundById((state) => ({ ...state, [centerId]: response.items }));
      } catch (error) {
        setInboundErrorById((state) => ({ ...state, [centerId]: apiErrorMessage(error, language) }));
      } finally {
        setInboundLoadingById((state) => ({ ...state, [centerId]: false }));
      }
    },
    [auth.idToken, language],
  );

  const fetchDonations = useCallback(
    async (centerId: string) => {
      if (!auth.idToken) return;
      setDonationsLoadingById((state) => ({ ...state, [centerId]: true }));
      setDonationsErrorById((state) => ({ ...state, [centerId]: null }));
      try {
        const response = await listCenterDonations(auth.idToken!, centerId, "declared");
        setDonationsById((state) => ({ ...state, [centerId]: response.items }));
      } catch (error) {
        setDonationsErrorById((state) => ({ ...state, [centerId]: apiErrorMessage(error, language) }));
      } finally {
        setDonationsLoadingById((state) => ({ ...state, [centerId]: false }));
      }
    },
    [auth.idToken, language],
  );

  const fetchMembers = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      setMembers((await listOrgMembers(auth.idToken, selectedOrg.id)).items);
    } catch (error) {
      setMembersError(apiErrorMessage(error, language));
    } finally {
      setMembersLoading(false);
    }
  }, [auth.idToken, language, selectedOrg]);

  const loadPublicCenters = useCallback(async () => {
    if (publicCenters !== null || publicCentersLoading) return;
    setPublicCentersLoading(true);
    try {
      const items: CenterPublic[] = [];
      let cursor: string | undefined;
      do {
        const response = await listCenters(cursor ? { cursor } : {});
        items.push(...response.items);
        cursor = response.cursor;
      } while (cursor);
      setPublicCenters(items);
    } catch {
      setPublicCenters([]);
    } finally {
      setPublicCentersLoading(false);
    }
  }, [publicCenters, publicCentersLoading]);

  const handleFlushQueue = useCallback(async () => {
    if (!auth.idToken || queue.length === 0) return;
    setQueueFlushing(true);
    const remaining = await flush(queue, (item) => createEntry(auth.idToken!, item.centerId, item.body));
    const succeeded = queue.filter((item) => !remaining.some((other) => other.id === item.id));
    setQueue(remaining);
    saveQueue(remaining);
    await Promise.all([...new Set(succeeded.map((item) => item.centerId))].flatMap((id) => [fetchStock(id), fetchEntries(id)]));
    setQueueFlushing(false);
  }, [auth.idToken, fetchEntries, fetchStock, queue]);

  useEffect(() => {
    if (auth.idToken) void fetchOrgs();
    else {
      setOrgs(null);
      setOrgsError(null);
    }
  }, [auth.idToken, fetchOrgs]);
  useEffect(() => {
    void fetchCenters();
  }, [fetchCenters]);
  useEffect(() => {
    if (selectedOrg?.role === "owner") void fetchMembers();
    else setMembers([]);
  }, [fetchMembers, selectedOrg]);
  useEffect(() => {
    if (!auth.idToken) return;
    void handleFlushQueue();
    const online = () => void handleFlushQueue();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [auth.idToken, handleFlushQueue]);
  useEffect(() => {
    if (!qrCenter) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    QRCode.toDataURL(`${window.location.origin}/drop-centers/${qrCenter.id}?drop=1`, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qrCenter]);

  const respondInvite = async (orgId: string, accept: boolean) => {
    if (!auth.idToken) return;
    setInviteActing(orgId);
    try {
      if (accept) await acceptOrgInvite(auth.idToken, orgId);
      else await declineOrgInvite(auth.idToken, orgId);
      await fetchOrgs();
    } catch {
      /* fetchOrgs reports the load failure */
    } finally {
      setInviteActing(null);
    }
  };

  const toggleExpanded = (centerId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(centerId)) next.delete(centerId);
      else {
        next.add(centerId);
        void fetchStock(centerId);
        void fetchEntries(centerId);
        void fetchInbound(centerId);
        void fetchDonations(centerId);
      }
      return next;
    });
  };

  const openAddCenter = () => {
    setCenterForm(emptyCenterForm());
    setCenterFormErrors({});
    setCenterFormApiError(null);
    setCenterFormOpen(true);
  };
  const openEditCenter = (center: CenterPrivate) => {
    setCenterForm({
      id: center.id,
      name: center.name,
      district: center.district,
      ward: center.ward ? String(center.ward) : "",
      address: center.address,
      lat: center.lat ? String(center.lat) : "",
      lng: center.lng ? String(center.lng) : "",
      hours: center.hours ?? "",
      contactPhone: center.contactPhone,
      accepts: center.accepts,
      notes: center.notes ?? "",
    });
    setCenterFormErrors({});
    setCenterFormApiError(null);
    setCenterFormOpen(true);
  };

  const submitCenter = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const result = centerPayload(centerForm);
    const translated = Object.fromEntries(Object.entries(result.errors).map(([key, value]) => [key, t[value] ?? value]));
    if (Object.keys(translated).length) {
      setCenterFormErrors(translated);
      return;
    }
    setCenterSubmitting(true);
    setCenterFormApiError(null);
    try {
      if (centerForm.id) await updateCenter(auth.idToken, centerForm.id, result.body!);
      else await createCenter(auth.idToken, selectedOrg.id, result.body!);
      setCenterFormOpen(false);
      await fetchCenters();
    } catch (error) {
      setCenterFormApiError(apiErrorMessage(error, language));
    } finally {
      setCenterSubmitting(false);
    }
  };

  const submitEntry = async (centerId: string) => {
    const form = logFormById[centerId] ?? defaultLogForm();
    const errors: Record<string, string> = {};
    if (!["intake", "distribution", "transfer_out"].includes(form.entryType)) errors.entryType = t.validationEntryType;
    if (!form.category) errors.category = t.validationEntryCategory;
    if (!validQty(form.qty)) errors.qty = t.validationEntryQty;
    if (form.note.trim().length > 500) errors.note = t.validationEntryNote;
    if (
      form.entryType === "transfer_out" &&
      (form.destinationType === "center"
        ? !form.destinationCenterId
        : form.destinationLabel.trim().length < 1 || form.destinationLabel.trim().length > 200)
    )
      errors.destination = form.destinationType === "center" ? t.validationDestinationCenter : t.validationDestinationLabel;
    if (Object.keys(errors).length) {
      setLogFormById((state) => ({ ...state, [centerId]: { ...form, fieldErrors: errors } }));
      return;
    }
    const body: Record<string, unknown> = {
      entryType: form.entryType,
      category: form.category,
      qty: Number(form.qty),
      note: form.note.trim() || undefined,
    };
    if (form.entryType === "transfer_out") {
      body.destinationType = form.destinationType;
      if (form.destinationType === "center") body.destinationCenterId = form.destinationCenterId;
      else body.destinationLabel = form.destinationLabel.trim();
    }
    setLogFormById((state) => ({ ...state, [centerId]: { ...form, submitting: true, fieldErrors: {}, error: null } }));
    try {
      if (!auth.idToken) return;
      await createEntry(auth.idToken, centerId, body as never);
      setLogFormById((state) => ({ ...state, [centerId]: defaultLogForm() }));
      await Promise.all([fetchStock(centerId), fetchEntries(centerId)]);
    } catch (error) {
      if (error instanceof TypeError || (error instanceof ApiError && error.status === 0)) {
        const next = enqueue(queue, centerId, body as never);
        setQueue(next);
        saveQueue(next);
        setLogFormById((state) => ({ ...state, [centerId]: defaultLogForm() }));
      } else
        setLogFormById((state) => ({
          ...state,
          [centerId]: { ...form, submitting: false, error: apiErrorMessage(error, language), fieldErrors: {} },
        }));
    }
  };

  const receiveTransfer = async () => {
    const dialog = dialogs.receive;
    if (!auth.idToken || !dialog.transfer || !dialog.centerId) return;
    if (!validQty(dialog.qtyReceived, true)) {
      setDialogs((state) => ({ ...state, receive: { ...dialog, error: t.validationQtyReceived } }));
      return;
    }
    if (dialog.note.trim().length > 500) {
      setDialogs((state) => ({ ...state, receive: { ...dialog, error: t.validationEntryNote } }));
      return;
    }
    setDialogs((state) => ({ ...state, receive: { ...dialog, submitting: true, error: null } }));
    try {
      await receiveTransferApi(auth.idToken, dialog.transfer.transferId, {
        qtyReceived: Number(dialog.qtyReceived),
        note: dialog.note.trim() || undefined,
      });
      const centerId = dialog.centerId;
      setDialogs((state) => ({ ...state, receive: emptyDialogs().receive }));
      await Promise.all([fetchInbound(centerId), fetchStock(centerId), fetchEntries(centerId)]);
    } catch (error) {
      setDialogs((state) => ({ ...state, receive: { ...dialog, submitting: false, error: apiErrorMessage(error, language) } }));
    }
  };

  const correctEntry = async () => {
    const dialog = dialogs.correction;
    if (!auth.idToken || !dialog.centerId || !dialog.entryId) return;
    if (dialog.note.trim().length < 3 || dialog.note.trim().length > 500) {
      setDialogs((state) => ({ ...state, correction: { ...dialog, error: t.validationCorrectionNote } }));
      return;
    }
    setDialogs((state) => ({ ...state, correction: { ...dialog, submitting: true, error: null } }));
    try {
      await createEntry(auth.idToken, dialog.centerId, {
        entryType: "correction",
        correctsEntryId: dialog.entryId,
        note: dialog.note.trim(),
      } as never);
      const centerId = dialog.centerId;
      setDialogs((state) => ({ ...state, correction: emptyDialogs().correction }));
      await Promise.all([fetchStock(centerId), fetchEntries(centerId)]);
    } catch (error) {
      setDialogs((state) => ({ ...state, correction: { ...dialog, submitting: false, error: apiErrorMessage(error, language) } }));
    }
  };

  const confirmDonation = async () => {
    const dialog = dialogs.donation;
    if (!auth.idToken || !dialog.ref || !dialog.centerId) return;
    if (dialog.mode === "receive" && !validQty(dialog.qty)) {
      setDialogs((state) => ({ ...state, donation: { ...dialog, error: t.donorValidationQty } }));
      return;
    }
    setDialogs((state) => ({ ...state, donation: { ...dialog, submitting: true, error: null } }));
    try {
      if (dialog.mode === "receive") await confirmDonationApi(auth.idToken, dialog.ref, { qty: Number(dialog.qty) });
      else await confirmDonationApi(auth.idToken, dialog.ref, { action: "not_received" });
      const centerId = dialog.centerId;
      setDialogs((state) => ({ ...state, donation: emptyDialogs().donation }));
      await fetchDonations(centerId);
      if (dialog.mode === "receive") await Promise.all([fetchStock(centerId), fetchEntries(centerId)]);
    } catch (error) {
      setDialogs((state) => ({ ...state, donation: { ...dialog, submitting: false, error: apiErrorMessage(error, language) } }));
    }
  };

  const inviteMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const email = inviteEmail.trim();
    if (!validEmail(email)) {
      setInviteError(t.staffValidationEmail);
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    setInviteMsg(null);
    try {
      const result = await inviteOrgMember(auth.idToken, selectedOrg.id, { email });
      setInviteMsg(result.status === "member" ? t.staffInviteAdded : t.staffInvited);
      setInviteEmail("");
      await fetchMembers();
    } catch (error) {
      setInviteError(apiErrorMessage(error, language));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const removeMember = async () => {
    const dialog = dialogs.remove;
    if (!auth.idToken || !selectedOrg || !dialog.member) return;
    setDialogs((state) => ({ ...state, remove: { ...dialog, submitting: true, error: null } }));
    try {
      await removeOrgMember(auth.idToken, selectedOrg.id, dialog.member.sub ?? dialog.member.email);
      setDialogs((state) => ({ ...state, remove: emptyDialogs().remove }));
      await fetchMembers();
    } catch (error) {
      setDialogs((state) => ({ ...state, remove: { ...dialog, submitting: false, error: apiErrorMessage(error, language) } }));
    }
  };

  const submitEditOrg = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const form = editForm;
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2 || form.name.trim().length > 150) errors.name = t.validationName;
    if (!form.orgType || !(ORG_TYPES as string[]).includes(form.orgType)) errors.orgType = t.validationOrgType;
    if (form.registrationNumber.trim().length > 100) errors.registrationNumber = t.validationRegistrationNumber;
    if (form.contactName.trim().length < 1 || form.contactName.trim().length > 100) errors.contactName = t.validationContactName;
    if (!validPhone(form.contactPhone.trim())) errors.contactPhone = t.validationContactPhone;
    if (form.contactEmail.trim() && !validEmail(form.contactEmail.trim())) errors.contactEmail = t.validationContactEmail;
    if (!form.districts.length || form.districts.length > 10) errors.districts = t.validationDistricts;
    if (form.description.trim().length < 10 || form.description.trim().length > 2000) errors.description = t.validationDescription;
    if (form.website.trim().length > 200) errors.website = t.validationWebsite;
    if (Object.keys(errors).length) {
      setEditErrors(errors);
      return;
    }
    setEditSubmitting(true);
    setEditApiError(null);
    try {
      await updateOrg(auth.idToken, selectedOrg.id, {
        name: form.name.trim(),
        orgType: form.orgType as OrgType,
        registrationNumber: form.registrationNumber.trim() || undefined,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || undefined,
        districts: form.districts,
        description: form.description.trim(),
        website: form.website.trim() || undefined,
      });
      setEditOpen(false);
      await fetchOrgs();
    } catch (error) {
      setEditApiError(apiErrorMessage(error, language));
    } finally {
      setEditSubmitting(false);
    }
  };

  const changeCenterStatus = async (center: CenterPrivate, status: CenterStatus) => {
    if (!auth.idToken) return;
    setCenterStatusUpdating((state) => ({ ...state, [center.id]: true }));
    setCenterStatusError((state) => ({ ...state, [center.id]: null }));
    try {
      await updateCenter(auth.idToken, center.id, { status });
      setCenters((state) => state.map((item) => (item.id === center.id ? { ...item, status } : item)));
    } catch (error) {
      setCenterStatusError((state) => ({ ...state, [center.id]: apiErrorMessage(error, language) }));
    } finally {
      setCenterStatusUpdating((state) => ({ ...state, [center.id]: false }));
    }
  };

  const vouch = async () => {
    if (!auth.idToken || !selectedOrg) return;
    const target = vouchTargetId.trim();
    if (!target) {
      setVouchError(t.vouchValidationRequired);
      return;
    }
    setVouchSubmitting(true);
    setVouchError(null);
    setVouchMsg(null);
    try {
      await vouchOrg(auth.idToken, target, selectedOrg.id);
      setVouchMsg(t.vouchSuccess);
      setVouchTargetId("");
      await fetchOrgs();
    } catch (error) {
      setVouchError(apiErrorMessage(error, language));
    } finally {
      setVouchSubmitting(false);
    }
  };

  const copyOrgId = async () => {
    if (!selectedOrg) return;
    try {
      await navigator.clipboard.writeText(selectedOrg.id);
      setCopiedOrgId(true);
      window.setTimeout(() => setCopiedOrgId(false), 2000);
    } catch {
      /* selectable id remains available */
    }
  };
  const openQr = (center: CenterPrivate) => setQrCenter(center);
  const closeQr = () => setQrCenter(null);

  return {
    language,
    t,
    orgs,
    invites,
    selectedId,
    setSelectedId,
    selectedOrg,
    isOwner,
    centers,
    loadingOrgs,
    orgsError,
    loadingCenters,
    centersError,
    stockById,
    stockLoadingById,
    stockErrorById,
    entriesById,
    cursorById,
    entriesLoadingById,
    entriesErrorById,
    inboundById,
    inboundLoadingById,
    inboundErrorById,
    donationsById,
    donationsLoadingById,
    donationsErrorById,
    members,
    membersLoading,
    membersError,
    publicCenters,
    publicCentersLoading,
    expanded,
    selectedCenterId,
    setSelectedCenterId,
    logFormById,
    setLogFormById,
    centerStatusUpdating,
    centerStatusError,
    queueLength: queue.length,
    queueFlushing,
    centerForm,
    setCenterForm,
    centerFormOpen,
    setCenterFormOpen,
    centerFormErrors,
    centerFormApiError,
    centerSubmitting,
    editForm,
    setEditForm,
    editOpen,
    setEditOpen,
    editErrors,
    editApiError,
    editSubmitting,
    vouchTargetId,
    setVouchTargetId,
    vouchError,
    vouchMsg,
    vouchSubmitting,
    copiedOrgId,
    dialogs,
    setDialogs,
    qrCenter,
    qrDataUrl,
    qrLoading,
    inviteEmail,
    setInviteEmail,
    inviteSubmitting,
    inviteMsg,
    inviteError,
    inviteActing,
    respondInvite,
    fetchOrgs,
    fetchCenters,
    fetchStock,
    fetchEntries,
    fetchInbound,
    fetchDonations,
    fetchMembers,
    loadPublicCenters,
    handleFlushQueue,
    toggleExpanded,
    openAddCenter,
    openEditCenter,
    submitCenter,
    submitEditOrg,
    changeCenterStatus,
    submitEntry,
    receiveTransfer,
    correctEntry,
    confirmDonation,
    inviteMember,
    removeMember,
    vouch,
    copyOrgId,
    openQr,
    closeQr,
    auth: {
      idToken: auth.idToken,
      clientId: auth.clientId,
      signIn: auth.signIn,
      signOut: auth.signOut,
      error: auth.error,
      profile: auth.profile,
    },
  };
}
