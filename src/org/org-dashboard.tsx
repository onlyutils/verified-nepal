import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  confirmDonation,
  createCenter,
  createEntry,
  getCenterStock,
  inviteOrgMember,
  listCenterDonations,
  listCenters,
  listCenterEntries,
  listInbound,
  listMyOrgs,
  acceptOrgInvite,
  declineOrgInvite,
  listOrgCenters,
  listOrgMembers,
  receiveTransfer,
  removeOrgMember,
  updateCenter,
  updateOrg,
  vouchOrg,
  type CenterPrivate,
  type CenterPublic,
  type DonationStatus,
  type MyOrg,
  type OrgMember,
  type OrgType,
  ORG_TYPES,
  type CenterStatus,
  CENTER_STATUSES,
  type StockItem,
  type GoodsEntry,
  type InboundTransfer,
} from "@/lib/api";
import QRCode from "qrcode";
import { enqueue, flush, load as loadQueue, save as saveQueue, type QueuedEntry } from "@/lib/goods-queue";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { districtLabels, districtNames } from "@/lib/geo";
import { GOODS_CATEGORIES, goodsLabel, unitLabel } from "@/lib/goods";
import { orgStrings } from "@/i18n/orgs";
import type { Language, Page } from "@/lib/types";
import { Rule, SectionLabel, SquareButton, StatusMark } from "@/components/legacy";
import { fillTemplate } from "@/lib/edition";

type FieldKey = "name" | "orgType" | "registrationNumber" | "contactName" | "contactPhone" | "contactEmail" | "districts" | "description" | "website";

function isValidPhone(phone: string): boolean {
  const stripped = phone.replace(/[\s-]/g, "");
  return /^[0-9]{7,15}$/.test(stripped);
}
function isValidEmail(email: string): boolean {
  return email.includes("@");
}

function orgStatusTone(status: string): "pending" | "verified" | "rejected" | "neutral" {
  if (status === "pending") return "pending";
  if (status === "verified") return "verified";
  if (status === "rejected" || status === "suspended") return "rejected";
  return "neutral";
}

function orgStatusText(org: MyOrg, t: Record<string, string>): string {
  if (org.status === "pending") return t.orgStatusPending;
  if (org.status === "verified") {
    if (org.tier === "known") return t.orgStatusVerifiedKnown;
    if (org.tier === "vouched") return t.orgStatusVerifiedVouched;
    if (org.tier === "self_declared") return t.orgStatusVerifiedSelfDeclared;
    return t.orgStatusVerifiedSelfDeclared;
  }
  if (org.status === "rejected") return `${t.orgStatusRejected}${org.rejectionReason ? ` — ${t.orgStatusReasonPrefix} ${org.rejectionReason}` : ""}`;
  if (org.status === "suspended") return `${t.orgStatusSuspended}${org.suspensionReason ? ` — ${t.orgStatusReasonPrefix} ${org.suspensionReason}` : ""}`;
  return org.status;
}

type LogForm = {
  entryType: "intake" | "distribution" | "transfer_out";
  category: string;
  qty: string;
  note: string;
  destinationType: "center" | "external";
  destinationCenterId: string;
  destinationLabel: string;
  error: string | null;
  fieldErrors: Record<string, string>;
  submitting: boolean;
};

function defaultLogForm(): LogForm {
  return {
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
  };
}

function entryDisplayLabel(en: GoodsEntry, language: Language, t: Record<string, string>): string {
  if (en.entryType === "intake") return t.activityIntake ?? "Received";
  if (en.entryType === "distribution") return t.activityDistribution ?? "Distributed";
  if (en.entryType === "transfer_out") {
    const dest = en.destinationLabel || "";
    return fillTemplate(t.transferSentLabel, { destination: dest || en.destinationCenterId || "" });
  }
  if (en.entryType === "transfer_in") {
    const src = en.sourceLabel || "";
    return fillTemplate(t.transferReceivedLabel, { source: src || en.sourceCenterId || "" });
  }
  if (en.entryType === "correction") return t.activityCorrection ?? "Correction of an earlier entry";
  return en.entryType;
}

function formatDiscrepancy(en: GoodsEntry, language: Language): string | null {
  if (en.discrepancy === undefined || en.discrepancy === null) return null;
  if (en.discrepancy === 0) return null;
  return String(en.discrepancy);
}

export function OrgDashboard({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = orgStrings[language] as Record<string, string>;
  const auth = useGoogleAuth();

  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ orgId: string; orgName: string }[]>([]);
  const [inviteActing, setInviteActing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [centers, setCenters] = useState<CenterPrivate[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [centersError, setCentersError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOrgType, setEditOrgType] = useState<OrgType | "">("");
  const [editRegistrationNumber, setEditRegistrationNumber] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editDistricts, setEditDistricts] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editErrors, setEditErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [editApiError, setEditApiError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [addCenterOpen, setAddCenterOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cDistrict, setCDistrict] = useState("");
  const [cWard, setCWard] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cLat, setCLat] = useState("");
  const [cLng, setCLng] = useState("");
  const [cHours, setCHours] = useState("");
  const [cContactPhone, setCContactPhone] = useState("");
  const [cAccepts, setCAccepts] = useState<string[]>([]);
  const [cNotes, setCNotes] = useState("");
  const [cErrors, setCErrors] = useState<Record<string, string>>({});
  const [cApiError, setCApiError] = useState<string | null>(null);
  const [cSubmitting, setCSubmitting] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stockById, setStockById] = useState<Record<string, StockItem[]>>({});
  const [stockLoadingById, setStockLoadingById] = useState<Record<string, boolean>>({});
  const [stockErrorById, setStockErrorById] = useState<Record<string, string | null>>({});
  const [entriesById, setEntriesById] = useState<Record<string, GoodsEntry[]>>({});
  const [cursorById, setCursorById] = useState<Record<string, string | undefined>>({});
  const [entriesLoadingById, setEntriesLoadingById] = useState<Record<string, boolean>>({});
  const [entriesErrorById, setEntriesErrorById] = useState<Record<string, string | null>>({});
  const [centerStatusUpdating, setCenterStatusUpdating] = useState<Record<string, boolean>>({});
  const [centerStatusError, setCenterStatusError] = useState<Record<string, string | null>>({});
  const [logFormById, setLogFormById] = useState<Record<string, LogForm>>({});

  // public centers for transfer destination
  const [publicCenters, setPublicCenters] = useState<CenterPublic[] | null>(null);
  const [publicCentersLoading, setPublicCentersLoading] = useState(false);

  // inbound transfers
  const [inboundById, setInboundById] = useState<Record<string, InboundTransfer[]>>({});
  const [inboundLoadingById, setInboundLoadingById] = useState<Record<string, boolean>>({});
  const [inboundErrorById, setInboundErrorById] = useState<Record<string, string | null>>({});
  const [receiveDialog, setReceiveDialog] = useState<{
    open: boolean;
    centerId: string | null;
    transfer: InboundTransfer | null;
    qtyReceived: string;
    note: string;
    error: string | null;
    submitting: boolean;
  }>({ open: false, centerId: null, transfer: null, qtyReceived: "", note: "", error: null, submitting: false });

  // correction dialog
  const [correctDialog, setCorrectDialog] = useState<{
    open: boolean;
    centerId: string | null;
    entryId: string | null;
    note: string;
    error: string | null;
    submitting: boolean;
  }>({ open: false, centerId: null, entryId: null, note: "", error: null, submitting: false });

  // vouching
  const [vouchTargetId, setVouchTargetId] = useState("");
  const [vouchSubmitting, setVouchSubmitting] = useState(false);
  const [vouchMsg, setVouchMsg] = useState<string | null>(null);
  const [vouchError, setVouchError] = useState<string | null>(null);
  const [copiedOrgId, setCopiedOrgId] = useState(false);

  // offline queue
  const [queue, setQueue] = useState<QueuedEntry[]>(() => loadQueue());
  const [queueFlushing, setQueueFlushing] = useState(false);

  // staff
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean; member: OrgMember | null; error: string | null; submitting: boolean }>({
    open: false,
    member: null,
    error: null,
    submitting: false,
  });

  // donor drops per center
  const [donationsById, setDonationsById] = useState<Record<string, DonationStatus[]>>({});
  const [donationsLoadingById, setDonationsLoadingById] = useState<Record<string, boolean>>({});
  const [donationsErrorById, setDonationsErrorById] = useState<Record<string, string | null>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; ref: string | null; centerId: string | null; qty: string; error: string | null; submitting: boolean; mode: "receive" | "not_received" }>({
    open: false,
    ref: null,
    centerId: null,
    qty: "",
    error: null,
    submitting: false,
    mode: "receive",
  });

  // QR dialog
  const [qrCenter, setQrCenter] = useState<CenterPrivate | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const selectedOrg = orgs?.find((o) => o.id === selectedId) ?? null;
  const isOwner = selectedOrg?.role === "owner";

  const fetchOrgs = useCallback(async () => {
    if (!auth.idToken) return;
    setLoadingOrgs(true);
    setOrgsError(null);
    try {
      const res = await listMyOrgs(auth.idToken);
      setOrgs(res.items);
      setInvites(res.invites || []);
      if (res.items.length > 0 && !selectedId) {
        setSelectedId(res.items[0].id);
      } else if (res.items.length === 0) {
        setSelectedId(null);
      } else if (selectedId && !res.items.find((o) => o.id === selectedId)) {
        setSelectedId(res.items[0].id);
      }
    } catch (err) {
      setOrgsError(apiErrorMessage(err, language));
    } finally {
      setLoadingOrgs(false);
    }
  }, [auth.idToken, language, selectedId]);

  useEffect(() => {
    if (auth.idToken) fetchOrgs();
    else {
      setOrgs(null);
      setOrgsError(null);
    }
  }, [auth.idToken, fetchOrgs]);

  const fetchCenters = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) {
      setCenters([]);
      return;
    }
    setLoadingCenters(true);
    setCentersError(null);
    try {
      const res = await listOrgCenters(auth.idToken, selectedOrg.id);
      setCenters(res.items);
    } catch (err) {
      setCentersError(apiErrorMessage(err, language));
    } finally {
      setLoadingCenters(false);
    }
  }, [auth.idToken, language, selectedOrg]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  const fetchStock = useCallback(async (centerId: string) => {
    setStockLoadingById((prev) => ({ ...prev, [centerId]: true }));
    setStockErrorById((prev) => ({ ...prev, [centerId]: null }));
    try {
      const res = await getCenterStock(centerId);
      setStockById((prev) => ({ ...prev, [centerId]: res.items }));
    } catch (err) {
      setStockErrorById((prev) => ({ ...prev, [centerId]: apiErrorMessage(err, language) }));
    } finally {
      setStockLoadingById((prev) => ({ ...prev, [centerId]: false }));
    }
  }, [language]);

  const fetchEntries = useCallback(async (centerId: string, cursor?: string, append = false) => {
    setEntriesLoadingById((prev) => ({ ...prev, [centerId]: true }));
    setEntriesErrorById((prev) => ({ ...prev, [centerId]: null }));
    try {
      const res = await listCenterEntries(centerId, cursor ? { cursor } : {}, auth.idToken ?? undefined);
      setEntriesById((prev) => {
        const existing = append ? prev[centerId] ?? [] : [];
        const nextItems = append ? [...existing, ...res.items] : res.items;
        return { ...prev, [centerId]: nextItems };
      });
      setCursorById((prev) => ({ ...prev, [centerId]: res.cursor }));
    } catch (err) {
      setEntriesErrorById((prev) => ({ ...prev, [centerId]: apiErrorMessage(err, language) }));
    } finally {
      setEntriesLoadingById((prev) => ({ ...prev, [centerId]: false }));
    }
  }, [auth.idToken, language]);

  const fetchInbound = useCallback(async (centerId: string) => {
    if (!auth.idToken) return;
    setInboundLoadingById((prev) => ({ ...prev, [centerId]: true }));
    setInboundErrorById((prev) => ({ ...prev, [centerId]: null }));
    try {
      const res = await listInbound(auth.idToken, centerId);
      setInboundById((prev) => ({ ...prev, [centerId]: res.items }));
    } catch (err) {
      setInboundErrorById((prev) => ({ ...prev, [centerId]: apiErrorMessage(err, language) }));
    } finally {
      setInboundLoadingById((prev) => ({ ...prev, [centerId]: false }));
    }
  }, [auth.idToken, language]);

  const loadPublicCenters = useCallback(async () => {
    if (publicCenters !== null || publicCentersLoading) return;
    setPublicCentersLoading(true);
    try {
      const all: CenterPublic[] = [];
      let cursor: string | undefined = undefined;
      do {
        const res = await listCenters(cursor ? { cursor } : {});
        all.push(...res.items);
        cursor = res.cursor;
      } while (cursor);
      setPublicCenters(all);
    } catch {
      setPublicCenters([]);
    } finally {
      setPublicCentersLoading(false);
    }
  }, [publicCenters, publicCentersLoading]);

  const fetchMembers = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await listOrgMembers(auth.idToken, selectedOrg.id);
      setMembers(res.items);
    } catch (err) {
      setMembersError(apiErrorMessage(err, language));
    } finally {
      setMembersLoading(false);
    }
  }, [auth.idToken, selectedOrg, language]);

  const fetchDonations = useCallback(async (centerId: string) => {
    if (!auth.idToken) return;
    setDonationsLoadingById((prev) => ({ ...prev, [centerId]: true }));
    setDonationsErrorById((prev) => ({ ...prev, [centerId]: null }));
    try {
      const res = await listCenterDonations(auth.idToken, centerId, "declared");
      setDonationsById((prev) => ({ ...prev, [centerId]: res.items }));
    } catch (err) {
      setDonationsErrorById((prev) => ({ ...prev, [centerId]: apiErrorMessage(err, language) }));
    } finally {
      setDonationsLoadingById((prev) => ({ ...prev, [centerId]: false }));
    }
  }, [auth.idToken, language]);

  const handleFlushQueue = useCallback(async () => {
    if (!auth.idToken) return;
    if (queue.length === 0) return;
    setQueueFlushing(true);
    const remaining = await flush(queue, (item) => createEntry(auth.idToken!, item.centerId, item.body));
    const succeeded = queue.filter((q) => !remaining.some((r) => r.id === q.id));
    const affected = new Set(succeeded.map((s) => s.centerId));
    setQueue(remaining);
    saveQueue(remaining);
    for (const cid of affected) {
      fetchStock(cid);
      fetchEntries(cid);
    }
    setQueueFlushing(false);
  }, [auth.idToken, queue, fetchStock, fetchEntries]);

  useEffect(() => {
    if (!auth.idToken) return;
    handleFlushQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.idToken]);

  useEffect(() => {
    if (!auth.idToken) return;
    const onOnline = () => handleFlushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [auth.idToken, handleFlushQueue]);

  useEffect(() => {
    if (selectedOrg && selectedOrg.role === "owner") {
      fetchMembers();
    } else {
      setMembers([]);
    }
  }, [selectedOrg, fetchMembers]);

  useEffect(() => {
    if (!qrCenter) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    const url = `${window.location.origin}/drop-centers/${qrCenter.id}?drop=1`;
    QRCode.toDataURL(url, { width: 240, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
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
      // fetchOrgs surfaces any load error; ignore transient action error
    } finally {
      setInviteActing(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      setInviteError(t.staffValidationEmail);
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    setInviteMsg(null);
    try {
      const res = await inviteOrgMember(auth.idToken, selectedOrg.id, { email });
      setInviteMsg(res.status === "member" ? t.staffInviteAdded : t.staffInvited);
      setInviteEmail("");
      fetchMembers();
    } catch (err) {
      setInviteError(apiErrorMessage(err, language));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!auth.idToken || !selectedOrg || !removeConfirm.member) return;
    setRemoveConfirm((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const identifier = removeConfirm.member.sub ?? removeConfirm.member.email;
      await removeOrgMember(auth.idToken, selectedOrg.id, identifier);
      setRemoveConfirm({ open: false, member: null, error: null, submitting: false });
      fetchMembers();
    } catch (err) {
      setRemoveConfirm((prev) => ({ ...prev, submitting: false, error: apiErrorMessage(err, language) }));
    }
  };

  const handleConfirmDonation = async () => {
    if (!auth.idToken || !confirmDialog.ref || !confirmDialog.centerId) return;
    if (confirmDialog.mode === "receive") {
      const qtyStr = confirmDialog.qty.trim();
      const qtyNum = Number(qtyStr);
      const qtyValid = qtyStr !== "" && !Number.isNaN(qtyNum) && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 1000000 && /^\d+(\.\d{1,2})?$/.test(qtyStr);
      if (!qtyValid) {
        setConfirmDialog((prev) => ({ ...prev, error: t.donorValidationQty }));
        return;
      }
      setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
      try {
        await confirmDonation(auth.idToken, confirmDialog.ref!, { qty: qtyNum });
        setConfirmDialog({ open: false, ref: null, centerId: null, qty: "", error: null, submitting: false, mode: "receive" });
        fetchDonations(confirmDialog.centerId!);
        fetchStock(confirmDialog.centerId!);
        fetchEntries(confirmDialog.centerId!);
      } catch (err) {
        setConfirmDialog((prev) => ({ ...prev, submitting: false, error: apiErrorMessage(err, language) }));
      }
    } else {
      setConfirmDialog((prev) => ({ ...prev, submitting: true, error: null }));
      try {
        await confirmDonation(auth.idToken, confirmDialog.ref!, { action: "not_received" });
        setConfirmDialog({ open: false, ref: null, centerId: null, qty: "", error: null, submitting: false, mode: "receive" });
        fetchDonations(confirmDialog.centerId!);
      } catch (err) {
        setConfirmDialog((prev) => ({ ...prev, submitting: false, error: apiErrorMessage(err, language) }));
      }
    }
  };

  const toggleExpanded = (centerId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(centerId)) next.delete(centerId);
      else {
        next.add(centerId);
        if (!stockById[centerId] && !stockLoadingById[centerId]) fetchStock(centerId);
        if (!entriesById[centerId] && !entriesLoadingById[centerId]) fetchEntries(centerId);
        if (!inboundById[centerId] && !inboundLoadingById[centerId]) fetchInbound(centerId);
        if (!donationsById[centerId] && !donationsLoadingById[centerId]) fetchDonations(centerId);
      }
      return next;
    });
  };

  const openEdit = () => {
    if (!selectedOrg) return;
    setEditName(selectedOrg.name);
    setEditOrgType(selectedOrg.orgType);
    setEditRegistrationNumber(selectedOrg.registrationNumber ?? "");
    setEditContactName(selectedOrg.contactName);
    setEditContactPhone(selectedOrg.contactPhone);
    setEditContactEmail(selectedOrg.contactEmail ?? "");
    setEditDistricts([...selectedOrg.districts]);
    setEditDescription(selectedOrg.description);
    setEditWebsite(selectedOrg.website ?? "");
    setEditErrors({});
    setEditApiError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    const trimmedName = editName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 150) nextErrors.name = t.validationName;
    if (!editOrgType || !(ORG_TYPES as string[]).includes(editOrgType)) nextErrors.orgType = t.validationOrgType;
    if (editRegistrationNumber.trim().length > 100) nextErrors.registrationNumber = t.validationRegistrationNumber;
    const trimmedContactName = editContactName.trim();
    if (trimmedContactName.length < 1 || trimmedContactName.length > 100) nextErrors.contactName = t.validationContactName;
    const trimmedPhone = editContactPhone.trim();
    if (!trimmedPhone || !isValidPhone(trimmedPhone)) nextErrors.contactPhone = t.validationContactPhone;
    const trimmedEmail = editContactEmail.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) nextErrors.contactEmail = t.validationContactEmail;
    if (editDistricts.length === 0 || editDistricts.length > 10) nextErrors.districts = t.validationDistricts;
    const trimmedDesc = editDescription.trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) nextErrors.description = t.validationDescription;
    if (editWebsite.trim().length > 200) nextErrors.website = t.validationWebsite;
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }
    setEditErrors({});
    setEditSubmitting(true);
    setEditApiError(null);
    try {
      await updateOrg(auth.idToken, selectedOrg.id, {
        name: trimmedName,
        orgType: editOrgType as OrgType,
        registrationNumber: editRegistrationNumber.trim() || undefined,
        contactName: trimmedContactName,
        contactPhone: trimmedPhone,
        contactEmail: trimmedEmail || undefined,
        districts: editDistricts,
        description: trimmedDesc,
        website: editWebsite.trim() || undefined,
      });
      setEditOpen(false);
      fetchOrgs();
    } catch (err) {
      setEditApiError(apiErrorMessage(err, language));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleAddCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken || !selectedOrg) return;
    const nextErrors: Record<string, string> = {};
    const trimmedName = cName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) nextErrors.cName = t.validationCenterName;
    if (!cDistrict) nextErrors.cDistrict = t.validationCenterDistrict;
    let wardNum: number | undefined;
    if (cWard.trim()) {
      const n = Number(cWard);
      if (!Number.isInteger(n) || n < 1 || n > 33) nextErrors.cWard = t.validationCenterWard;
      else wardNum = n;
    }
    const trimmedAddress = cAddress.trim();
    if (trimmedAddress.length < 1 || trimmedAddress.length > 300) nextErrors.cAddress = t.validationCenterAddress;
    let latNum: number | undefined;
    let lngNum: number | undefined;
    const hasLat = cLat.trim() !== "";
    const hasLng = cLng.trim() !== "";
    if (hasLat || hasLng) {
      if (!hasLat || !hasLng) nextErrors.cLatLng = t.validationCenterLatLngPair;
      else {
        const lat = Number(cLat);
        const lng = Number(cLng);
        if (Number.isNaN(lat) || lat < 26 || lat > 31) nextErrors.cLat = t.validationCenterLat;
        else latNum = lat;
        if (Number.isNaN(lng) || lng < 80 || lng > 89) nextErrors.cLng = t.validationCenterLng;
        else lngNum = lng;
      }
    }
    if (cHours.trim().length > 200) nextErrors.cHours = t.validationCenterHours;
    const trimmedPhone = cContactPhone.trim();
    if (!trimmedPhone || !isValidPhone(trimmedPhone)) nextErrors.cContactPhone = t.validationCenterContactPhone;
    if (cAccepts.length === 0) nextErrors.cAccepts = t.validationCenterAccepts;
    if (cNotes.trim().length > 500) nextErrors.cNotes = t.validationCenterNotes;
    if (Object.keys(nextErrors).length > 0) {
      setCErrors(nextErrors);
      return;
    }
    setCErrors({});
    setCSubmitting(true);
    setCApiError(null);
    try {
      await createCenter(auth.idToken, selectedOrg.id, {
        name: trimmedName,
        district: cDistrict,
        ward: wardNum,
        address: trimmedAddress,
        lat: latNum,
        lng: lngNum,
        hours: cHours.trim() || undefined,
        contactPhone: trimmedPhone,
        accepts: cAccepts,
        notes: cNotes.trim() || undefined,
      });
      setAddCenterOpen(false);
      setCName("");
      setCDistrict("");
      setCWard("");
      setCAddress("");
      setCLat("");
      setCLng("");
      setCHours("");
      setCContactPhone("");
      setCAccepts([]);
      setCNotes("");
      fetchCenters();
    } catch (err) {
      setCApiError(apiErrorMessage(err, language));
    } finally {
      setCSubmitting(false);
    }
  };

  const handleCenterStatusChange = async (center: CenterPrivate, newStatus: CenterStatus) => {
    if (!auth.idToken) return;
    setCenterStatusUpdating((prev) => ({ ...prev, [center.id]: true }));
    setCenterStatusError((prev) => ({ ...prev, [center.id]: null }));
    try {
      await updateCenter(auth.idToken, center.id, { status: newStatus });
      setCenters((prev) => prev.map((c) => (c.id === center.id ? { ...c, status: newStatus } : c)));
    } catch (err) {
      setCenterStatusError((prev) => ({ ...prev, [center.id]: apiErrorMessage(err, language) }));
    } finally {
      setCenterStatusUpdating((prev) => ({ ...prev, [center.id]: false }));
    }
  };

  const handleLogEntry = async (centerId: string) => {
    const form = logFormById[centerId];
    if (!form || !auth.idToken) return;
    const fieldErrors: Record<string, string> = {};
    if (!["intake", "distribution", "transfer_out"].includes(form.entryType)) fieldErrors.entryType = t.validationEntryType;
    if (!form.category) fieldErrors.category = t.validationEntryCategory;
    const qtyNum = Number(form.qty);
    const qtyValid = !Number.isNaN(qtyNum) && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 1000000 && /^\d+(\.\d{1,2})?$/.test(form.qty.trim());
    if (!qtyValid) fieldErrors.qty = t.validationEntryQty;
    if (form.note.trim().length > 500) fieldErrors.note = t.validationEntryNote;
    if (form.entryType === "transfer_out") {
      if (form.destinationType === "center") {
        if (!form.destinationCenterId) fieldErrors.destination = t.validationDestinationCenter;
      } else {
        const dl = form.destinationLabel.trim();
        if (dl.length < 1 || dl.length > 200) fieldErrors.destination = t.validationDestinationLabel;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, fieldErrors, error: null } }));
      return;
    }
    setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, submitting: true, error: null, fieldErrors: {} } }));
    const body: Record<string, unknown> = {
      entryType: form.entryType,
      category: form.category,
      qty: qtyNum,
      note: form.note.trim() || undefined,
    };
    if (form.entryType === "transfer_out") {
      body.destinationType = form.destinationType;
      if (form.destinationType === "center") body.destinationCenterId = form.destinationCenterId;
      else body.destinationLabel = form.destinationLabel.trim();
    }
    try {
      await createEntry(auth.idToken, centerId, body as never);
      setLogFormById((prev) => ({ ...prev, [centerId]: { ...defaultLogForm(), submitting: false, error: null, fieldErrors: {} } }));
      fetchStock(centerId);
      fetchEntries(centerId);
    } catch (err) {
      const isNetwork = err instanceof TypeError || (err instanceof ApiError && err.status === 0);
      if (isNetwork) {
        const next = enqueue(queue, centerId, body as never);
        setQueue(next);
        saveQueue(next);
        setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, submitting: false, error: null, fieldErrors: {} } }));
      } else {
        setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, submitting: false, error: apiErrorMessage(err, language), fieldErrors: {} } }));
      }
    }
  };

  const handleReceive = async () => {
    if (!auth.idToken || !receiveDialog.transfer || !receiveDialog.centerId) return;
    const qtyStr = receiveDialog.qtyReceived.trim();
    const qtyNum = Number(qtyStr);
    const qtyValid = qtyStr !== "" && !Number.isNaN(qtyNum) && Number.isFinite(qtyNum) && qtyNum >= 0 && qtyNum <= 1000000 && /^\d+(\.\d{1,2})?$/.test(qtyStr);
    if (!qtyValid) {
      setReceiveDialog((prev) => ({ ...prev, error: t.validationQtyReceived }));
      return;
    }
    if (receiveDialog.note.trim().length > 500) {
      setReceiveDialog((prev) => ({ ...prev, error: t.validationEntryNote }));
      return;
    }
    setReceiveDialog((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await receiveTransfer(auth.idToken, receiveDialog.transfer.transferId, {
        qtyReceived: qtyNum,
        note: receiveDialog.note.trim() || undefined,
      });
      setReceiveDialog({ open: false, centerId: null, transfer: null, qtyReceived: "", note: "", error: null, submitting: false });
      if (receiveDialog.centerId) {
        fetchInbound(receiveDialog.centerId);
        fetchStock(receiveDialog.centerId);
        fetchEntries(receiveDialog.centerId);
      }
    } catch (err) {
      setReceiveDialog((prev) => ({ ...prev, submitting: false, error: apiErrorMessage(err, language) }));
    }
  };

  const handleCorrection = async () => {
    if (!auth.idToken || !correctDialog.centerId || !correctDialog.entryId) return;
    const noteTrim = correctDialog.note.trim();
    if (noteTrim.length < 3 || noteTrim.length > 500) {
      setCorrectDialog((prev) => ({ ...prev, error: t.validationCorrectionNote }));
      return;
    }
    setCorrectDialog((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      await createEntry(auth.idToken, correctDialog.centerId, {
        entryType: "correction",
        correctsEntryId: correctDialog.entryId,
        note: noteTrim,
      } as never);
      setCorrectDialog({ open: false, centerId: null, entryId: null, note: "", error: null, submitting: false });
      if (correctDialog.centerId) {
        fetchStock(correctDialog.centerId);
        fetchEntries(correctDialog.centerId);
      }
    } catch (err) {
      setCorrectDialog((prev) => ({ ...prev, submitting: false, error: apiErrorMessage(err, language) }));
    }
  };

  const handleVouch = async () => {
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
      fetchOrgs();
    } catch (err) {
      setVouchError(apiErrorMessage(err, language));
    } finally {
      setVouchSubmitting(false);
    }
  };

  const handleCopyOrgId = async () => {
    if (!selectedOrg) return;
    try {
      await navigator.clipboard.writeText(selectedOrg.id);
      setCopiedOrgId(true);
      setTimeout(() => setCopiedOrgId(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!auth.idToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.orgDashboardTitle}</h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">{t.orgDashboardGateTitle}</CardTitle>
            <CardDescription className="font-sans text-sm leading-6">{t.orgDashboardGateBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.clientId ? (
              <SquareButton onClick={auth.signIn} tone="primary" className="min-h-11 w-full max-w-[280px]">
                {t.registerOrgGateSignIn}
              </SquareButton>
            ) : null}
            {auth.error ? (
              <p className="font-sans text-sm text-destructive" role="alert">
                {apiErrorMessage(new Error(auth.error), language)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Rule />
      </div>
    );
  }

  if (loadingOrgs || orgs === null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
        <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgDashboardLoading}</p>
      </div>
    );
  }

  if (orgsError) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
        <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
          {orgsError}
        </p>
        <Button onClick={fetchOrgs} className="min-h-11">
          {t.loadMore}
        </Button>
      </div>
    );
  }

  const invitesBlock = invites.length > 0 ? (
    <Card className="border-ink">
      <CardHeader>
        <CardTitle className="font-serif text-base">{t.invitesTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((iv) => (
          <div key={iv.orgId} className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3 last:border-0 last:pb-0">
            <p className="font-sans text-sm text-ink">{t.invitesFrom.replace("{org}", iv.orgName)}</p>
            <div className="flex gap-2">
              <Button className="min-h-11" disabled={inviteActing === iv.orgId} onClick={() => respondInvite(iv.orgId, true)}>
                {inviteActing === iv.orgId ? t.invitesAccepting : t.invitesAccept}
              </Button>
              <Button variant="outline" className="min-h-11" disabled={inviteActing === iv.orgId} onClick={() => respondInvite(iv.orgId, false)}>
                {inviteActing === iv.orgId ? t.invitesDeclining : t.invitesDecline}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  ) : null;

  if (orgs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.orgDashboardTitle}</h1>
        </header>
        {invitesBlock}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">{t.orgDashboardEmptyTitle}</CardTitle>
            <CardDescription className="font-sans text-sm leading-6">{t.orgDashboardEmptyBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <SquareButton onClick={() => navigate("registerOrg")} tone="primary">
              {t.orgDashboardEmptyCta}
            </SquareButton>
          </CardContent>
        </Card>
        <Rule />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.orgDashboardTitle}</h1>
      </header>

      {invitesBlock}

      {orgs.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="orgSelector">{t.orgDashboardSelectorLabel}</Label>
          <NativeSelect id="orgSelector" value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="min-h-11 max-w-sm">
            {orgs.map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>
                {o.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {selectedOrg ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="font-serif text-xl">{selectedOrg.name}</CardTitle>
                <StatusMark tone={orgStatusTone(selectedOrg.status)}>{orgStatusText(selectedOrg, t)}</StatusMark>
              </div>
              <CardDescription className="font-sans text-sm">{selectedOrg.orgType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 font-sans text-sm">
              <p>
                <span className="font-semibold">{t.orgContactLabel}:</span> {selectedOrg.contactName} · {selectedOrg.contactPhone}
                {selectedOrg.contactEmail ? ` · ${selectedOrg.contactEmail}` : ""}
              </p>
              <p>
                <span className="font-semibold">{t.orgDistrictsLabel}:</span> {selectedOrg.districts.map((d) => districtLabels[d as keyof typeof districtLabels]?.[language] ?? d).join(" · ")}
              </p>
              <p className="font-serif leading-6 text-muted-foreground-foreground">{selectedOrg.description}</p>
              {selectedOrg.website ? (
                <p>
                  <span className="font-semibold">{t.orgWebsiteLabel}:</span>{" "}
                  <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="underline">
                    {selectedOrg.website}
                  </a>
                </p>
              ) : null}
              {selectedOrg.vouches && selectedOrg.vouches.length > 0 ? (
                <div className="border border-rule bg-card p-3">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wide">{t.vouchesLabel}</p>
                  <ul className="mt-2 space-y-1">
                    {selectedOrg.vouches.map((v) => (
                      <li key={v.orgId} className="font-sans text-xs">
                        {fillTemplate(t.vouchFromAt, { name: v.orgName, date: new Date(v.at).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US") })}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {isOwner ? (
                <Button variant="outline" className="min-h-11" onClick={openEdit}>
                  {t.orgEditButton}
                </Button>
              ) : (
                <p className="font-sans text-xs text-muted-foreground-foreground">{t.unauthorizedEdit}</p>
              )}
            </CardContent>
          </Card>

          {selectedOrg.status === "pending" ? (
            <Card className="border-rule">
              <CardHeader>
                <CardTitle className="font-serif text-base">{t.pendingVouchBoxTitle}</CardTitle>
                <CardDescription className="font-sans text-sm leading-6">{t.pendingVouchBoxBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="pendingOrgId">{t.pendingVouchOrgIdLabel}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <code id="pendingOrgId" className="flex-1 break-all border border-rule bg-secondary px-3 py-2 font-mono text-xs">
                    {selectedOrg.id}
                  </code>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleCopyOrgId}>
                    {copiedOrgId ? t.pendingVouchCopied : t.pendingVouchCopyButton}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {selectedOrg.status === "verified" && isOwner ? (
            <Card className="border-rule">
              <CardHeader>
                <CardTitle className="font-serif text-base">{t.vouchBoxTitle}</CardTitle>
                <CardDescription className="font-sans text-sm leading-6">{t.vouchBoxBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="vouchTargetId">{t.vouchInputLabel}</Label>
                  <Input
                    id="vouchTargetId"
                    value={vouchTargetId}
                    onChange={(e) => setVouchTargetId(e.target.value)}
                    placeholder={t.vouchInputPlaceholder}
                    className="min-h-11"
                  />
                </div>
                {vouchError ? (
                  <p className="font-sans text-sm text-destructive" role="alert">
                    {vouchError}
                  </p>
                ) : null}
                {vouchMsg ? (
                  <p className="font-sans text-sm text-emerald-700" role="status">
                    {vouchMsg}
                  </p>
                ) : null}
                <Button type="button" className="min-h-11" onClick={handleVouch} disabled={vouchSubmitting}>
                  {vouchSubmitting ? t.vouchSubmitting : t.vouchButton}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {queue.length > 0 ? (
            <div aria-live="polite" className="flex flex-wrap items-center gap-3 border border-amber-600 bg-amber-50 px-4 py-3 font-sans text-sm">
              <span>
                {queue.length === 1 ? t.queueBannerOne : fillTemplate(t.queueBanner, { n: String(queue.length) })}
              </span>
              <Button variant="outline" size="sm" className="min-h-11" onClick={handleFlushQueue} disabled={queueFlushing}>
                {queueFlushing ? t.queueRetrying : t.queueRetry}
              </Button>
            </div>
          ) : null}

          {selectedOrg && isOwner ? (
            <section className="space-y-4 border border-rule p-4">
              <h2 className="font-serif text-lg font-bold">{t.staffTitle}</h2>
              {membersLoading ? (
                <p className="font-sans text-sm text-muted-foreground-foreground">{t.staffLoading}</p>
              ) : membersError ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {membersError}
                </p>
              ) : members.length === 0 ? (
                <p className="font-sans text-sm text-muted-foreground-foreground">{t.staffEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse font-sans text-sm">
                    <thead>
                      <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted-foreground-foreground">
                        <th className="py-2 pr-3 font-semibold">{t.staffEmailLabel}</th>
                        <th className="py-2 pr-3 font-semibold">{t.staffNameLabel}</th>
                        <th className="py-2 pr-3 font-semibold">{t.staffRoleLabel}</th>
                        <th className="py-2 pr-3 font-semibold">{t.staffStatusLabel}</th>
                        <th className="py-2 pr-3 font-semibold">{t.staffDateLabel}</th>
                        <th className="py-2 text-right font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.email} className="border-b border-rule">
                          <td className="py-2 pr-3 font-mono text-xs">{m.email}</td>
                          <td className="py-2 pr-3">{m.name ?? "—"}</td>
                          <td className="py-2 pr-3">{m.role === "owner" ? t.staffRoleOwner : t.staffRoleStaff}</td>
                          <td className="py-2 pr-3">{m.status === "member" ? t.staffStatusMember : t.staffStatusInvited}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground-foreground">
                            {new Date(m.createdAt).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US")}
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => setRemoveConfirm({ open: true, member: m, error: null, submitting: false })}>
                              {t.staffRemove}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2" noValidate>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="inviteEmail">{t.staffInviteLabel}</Label>
                  <Input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t.staffInvitePlaceholder} className="min-h-11" required />
                </div>
                <Button type="submit" disabled={inviteSubmitting} className="min-h-11">
                  {inviteSubmitting ? t.staffInviteSubmitting : t.staffInviteSubmit}
                </Button>
              </form>
              {inviteError ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {inviteError}
                </p>
              ) : null}
              {inviteMsg ? (
                <p className="font-sans text-sm text-emerald-700" role="status">
                  {inviteMsg}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-bold">{t.orgCentersTitle}</h2>
              {isOwner ? (
                <Button onClick={() => setAddCenterOpen(true)} className="min-h-11">
                  {t.orgAddCenter}
                </Button>
              ) : null}
            </div>
            {loadingCenters ? (
              <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgDashboardLoading}</p>
            ) : centersError ? (
              <p className="font-sans text-sm text-destructive" role="alert">
                {centersError}
              </p>
            ) : centers.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgCentersEmpty}</p>
            ) : (
              <div className="grid gap-4">
                {centers.map((center) => {
                  const isExpanded = expanded.has(center.id);
                  const stock = stockById[center.id] ?? [];
                  const entries = entriesById[center.id] ?? [];
                  const inbound = inboundById[center.id] ?? [];
                  const logForm = logFormById[center.id] ?? defaultLogForm();
                  const publicOptions = (publicCenters ?? []).filter((c) => c.id !== center.id);
                  return (
                    <Card key={center.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="font-serif text-base">{center.name}</CardTitle>
                            <CardDescription className="font-sans text-xs">
                              {districtLabels[center.district as keyof typeof districtLabels]?.[language] ?? center.district} · {center.status}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="font-sans text-xs">
                            {center.status === "open" ? t.centerStatusOpen : center.status === "paused" ? t.centerStatusPaused : t.centerStatusClosed}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button variant="outline" size="sm" className="min-h-11" onClick={() => toggleExpanded(center.id)} aria-expanded={isExpanded}>
                          {isExpanded ? t.centerCollapse : t.centerExpand}
                        </Button>
                        {isExpanded ? (
                          <div className="space-y-6 border-t border-rule pt-4">
                            <div className="space-y-2">
                              <Label className="font-sans text-xs font-semibold uppercase tracking-wide">{t.centerStatusLabel}</Label>
                              <p className="font-sans text-sm">{center.address}</p>
                              {center.hours ? <p className="font-sans text-xs text-muted-foreground-foreground">{center.hours}</p> : null}
                              <div className="flex flex-wrap gap-1">
                                {center.accepts.map((a) => (
                                  <Badge key={a} variant="secondary" className="text-xs">
                                    {goodsLabel(a, language)}
                                  </Badge>
                                ))}
                              </div>
                              {isOwner ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <NativeSelect
                                    value={center.status}
                                    onChange={(e) => handleCenterStatusChange(center, e.target.value as CenterStatus)}
                                    className="min-h-11 max-w-[160px]"
                                    disabled={Boolean(centerStatusUpdating[center.id])}
                                    aria-label={t.centerStatusLabel}
                                  >
                                    {CENTER_STATUSES.map((s) => (
                                      <NativeSelectOption key={s} value={s}>
                                        {s === "open" ? t.centerStatusOpen : s === "paused" ? t.centerStatusPaused : t.centerStatusClosed}
                                      </NativeSelectOption>
                                    ))}
                                  </NativeSelect>
                                  {centerStatusUpdating[center.id] ? <span className="font-sans text-xs text-muted-foreground-foreground">…</span> : null}
                                </div>
                              ) : null}
                              {centerStatusError[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {centerStatusError[center.id]}
                                </p>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.stockTitle}</h3>
                              {stockLoadingById[center.id] ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgDashboardLoading}</p>
                              ) : stockErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {stockErrorById[center.id]}
                                </p>
                              ) : stock.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.stockEmpty}</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse font-sans text-sm">
                                    <thead>
                                      <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted-foreground-foreground">
                                        <th className="py-2 pr-3 font-semibold">{t.stockCategory}</th>
                                        <th className="py-2 text-right font-semibold">{t.stockQty}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {stock.map((s) => (
                                        <tr key={s.category} className="border-b border-rule">
                                          <td className="py-2 pr-3">{goodsLabel(s.category, language)}</td>
                                          <td className="py-2 text-right font-semibold tabular-nums">
                                            {s.qty} {unitLabel(s.unit, language)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className="space-y-3 border border-rule bg-card p-4">
                              <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.logEntryTitle}</h3>
                              <fieldset className="flex flex-wrap gap-4">
                                <legend className="sr-only">{t.logEntryTypeLabel}</legend>
                                <label className="flex items-center gap-2 font-sans text-sm">
                                  <input
                                    type="radio"
                                    name={`entryType-${center.id}`}
                                    checked={logForm.entryType === "intake"}
                                    onChange={() => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, entryType: "intake" } }))}
                                  />
                                  {t.logEntryIntake}
                                </label>
                                <label className="flex items-center gap-2 font-sans text-sm">
                                  <input
                                    type="radio"
                                    name={`entryType-${center.id}`}
                                    checked={logForm.entryType === "distribution"}
                                    onChange={() => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, entryType: "distribution" } }))}
                                  />
                                  {t.logEntryDistribution}
                                </label>
                                <label className="flex items-center gap-2 font-sans text-sm">
                                  <input
                                    type="radio"
                                    name={`entryType-${center.id}`}
                                    checked={logForm.entryType === "transfer_out"}
                                    onChange={() => {
                                      loadPublicCenters();
                                      setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, entryType: "transfer_out" } }));
                                    }}
                                  />
                                  {t.logEntryTransferOut}
                                </label>
                              </fieldset>
                              {logForm.fieldErrors.entryType ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.entryType}</p> : null}

                              {logForm.entryType === "transfer_out" ? (
                                <div className="space-y-3 border border-rule p-3">
                                  <fieldset className="flex flex-col gap-2">
                                    <legend className="font-sans text-xs font-semibold uppercase tracking-wide">{t.logEntryDestinationLabel} *</legend>
                                    <label className="flex items-center gap-2 font-sans text-sm">
                                      <input
                                        type="radio"
                                        name={`destType-${center.id}`}
                                        checked={logForm.destinationType === "center"}
                                        onChange={() => {
                                          loadPublicCenters();
                                          setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, destinationType: "center" } }));
                                        }}
                                      />
                                      {t.logEntryDestinationCenterLabel}
                                    </label>
                                    <label className="flex items-center gap-2 font-sans text-sm">
                                      <input
                                        type="radio"
                                        name={`destType-${center.id}`}
                                        checked={logForm.destinationType === "external"}
                                        onChange={() => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, destinationType: "external" } }))}
                                      />
                                      {t.logEntryDestinationExternalLabel}
                                    </label>
                                  </fieldset>
                                  {logForm.destinationType === "center" ? (
                                    <div className="space-y-2">
                                      <Label htmlFor={`destCenter-${center.id}`}>{t.logEntryDestinationCenterLabel} *</Label>
                                      {publicCentersLoading ? (
                                        <p className="font-sans text-xs text-muted-foreground-foreground">{t.logEntryDestinationLoading}</p>
                                      ) : (
                                        <NativeSelect
                                          id={`destCenter-${center.id}`}
                                          value={logForm.destinationCenterId}
                                          onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, destinationCenterId: e.target.value } }))}
                                          className="min-h-11"
                                        >
                                          <option value="">{t.logEntryDestinationCenterSelect}</option>
                                          {publicOptions.map((c) => (
                                            <NativeSelectOption key={c.id} value={c.id}>
                                              {c.name} — {districtLabels[c.district as keyof typeof districtLabels]?.[language] ?? c.district} — {c.org.name}
                                            </NativeSelectOption>
                                          ))}
                                        </NativeSelect>
                                      )}
                                      {publicOptions.length === 0 && !publicCentersLoading ? (
                                        <p className="font-sans text-xs text-muted-foreground-foreground">{t.logEntryDestinationEmpty}</p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label htmlFor={`destLabel-${center.id}`}>{t.logEntryDestinationExternalLabel} *</Label>
                                      <Input
                                        id={`destLabel-${center.id}`}
                                        value={logForm.destinationLabel}
                                        onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, destinationLabel: e.target.value } }))}
                                        placeholder={t.logEntryDestinationExternalPlaceholder}
                                        maxLength={200}
                                        className="min-h-11"
                                      />
                                    </div>
                                  )}
                                  {logForm.fieldErrors.destination ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.destination}</p> : null}
                                </div>
                              ) : null}

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`cat-${center.id}`}>{t.logEntryCategoryLabel} *</Label>
                                  <NativeSelect
                                    id={`cat-${center.id}`}
                                    value={logForm.category}
                                    onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, category: e.target.value } }))}
                                    className="min-h-11"
                                  >
                                    <option value="">{t.logEntryCategorySelect}</option>
                                    {GOODS_CATEGORIES.map((gc) => (
                                      <NativeSelectOption key={gc.id} value={gc.id}>
                                        {goodsLabel(gc.id, language)}
                                      </NativeSelectOption>
                                    ))}
                                  </NativeSelect>
                                  {logForm.fieldErrors.category ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.category}</p> : null}
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`qty-${center.id}`}>{t.logEntryQtyLabel} *</Label>
                                  <Input
                                    id={`qty-${center.id}`}
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min="0.01"
                                    value={logForm.qty}
                                    onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, qty: e.target.value } }))}
                                    className="min-h-11"
                                  />
                                  <p className="font-sans text-xs text-muted-foreground-foreground">{t.logEntryQtyHint}</p>
                                  {logForm.fieldErrors.qty ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.qty}</p> : null}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`note-${center.id}`}>{t.logEntryNoteLabel}</Label>
                                <Textarea id={`note-${center.id}`} value={logForm.note} onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, note: e.target.value } }))} rows={2} maxLength={500} />
                                {logForm.fieldErrors.note ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.note}</p> : null}
                              </div>
                              {logForm.error ? (
                                <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                                  {logForm.error}
                                </p>
                              ) : null}
                              <Button type="button" onClick={() => handleLogEntry(center.id)} disabled={logForm.submitting} className="min-h-11 w-full">
                                {logForm.submitting ? t.logEntrySubmitting : t.logEntrySubmit}
                              </Button>
                            </div>

                            <div className="space-y-2">
                              <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.inboundTitle}</h3>
                              {inboundLoadingById[center.id] ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgDashboardLoading}</p>
                              ) : inboundErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {inboundErrorById[center.id]}
                                </p>
                              ) : inbound.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.inboundEmpty}</p>
                              ) : (
                                <ul className="divide-y divide-rule border border-rule">
                                  {inbound.map((ib) => (
                                    <li key={ib.transferId} className="flex flex-col gap-2 px-3 py-3 font-sans text-sm">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">{t.inboundFromLabel} {ib.fromCenterName}</span>
                                        <span className="text-muted-foreground-foreground">
                                          {goodsLabel(ib.category, language)} · {ib.qty} {unitLabel(ib.unit, language)}
                                        </span>
                                        <span className="text-xs text-muted-foreground-foreground">{new Date(ib.createdAt).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US")}</span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="min-h-11 w-fit"
                                        onClick={() => setReceiveDialog({ open: true, centerId: center.id, transfer: ib, qtyReceived: String(ib.qty), note: "", error: null, submitting: false })}
                                      >
                                        {t.inboundConfirmButton}
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.donorDropsTitle}</h3>
                                <Button variant="outline" size="sm" className="min-h-11" onClick={() => setQrCenter(center)}>
                                  {t.printQrButton}
                                </Button>
                              </div>
                              {donationsLoadingById[center.id] ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.donorLoading}</p>
                              ) : donationsErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {donationsErrorById[center.id]}
                                </p>
                              ) : !(donationsById[center.id] ?? []).length ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.donorDropsEmpty}</p>
                              ) : (
                                <ul className="divide-y divide-rule border border-rule">
                                  {(donationsById[center.id] ?? []).map((d) => (
                                    <li key={d.ref} className="flex flex-col gap-2 px-3 py-3 font-sans text-sm">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold">{goodsLabel(d.category, language)}</span>
                                        <span className="tabular-nums">
                                          {d.qty} {unitLabel(d.unit, language)}
                                        </span>
                                        {d.note ? <span className="text-xs text-muted-foreground-foreground italic">{d.note}</span> : null}
                                        <span className="font-mono text-xs">{d.ref}</span>
                                        <span className="text-xs text-muted-foreground-foreground">{new Date(d.declaredAt).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US")}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="min-h-11"
                                          onClick={() => setConfirmDialog({ open: true, ref: d.ref, centerId: center.id, qty: String(d.qty), error: null, submitting: false, mode: "receive" })}
                                        >
                                          {t.donorConfirmReceived}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="min-h-11"
                                          onClick={() => setConfirmDialog({ open: true, ref: d.ref, centerId: center.id, qty: String(d.qty), error: null, submitting: false, mode: "not_received" })}
                                        >
                                          {t.donorNotReceived}
                                        </Button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.recentEntriesTitle}</h3>
                              {entriesLoadingById[center.id] && entries.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.orgDashboardLoading}</p>
                              ) : entriesErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {entriesErrorById[center.id]}
                                </p>
                              ) : entries.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground-foreground">{t.recentEntriesEmpty}</p>
                              ) : (
                                <>
                                  <ul className="divide-y divide-rule border border-rule">
                                    {entries.map((en) => {
                                      const corrected = Boolean(en.correctedByEntryId);
                                      const isCorrection = en.entryType === "correction";
                                      const canCorrect = !corrected && !isCorrection && !(en.entryType === "transfer_out" && en.transferStatus === "received");
                                      // Build transfer status line
                                      let transferLine: string | null = null;
                                      if (en.entryType === "transfer_out") {
                                        const dest = en.destinationLabel || "";
                                        const status = en.transferStatus === "received"
                                          ? en.discrepancy !== undefined && en.discrepancy !== 0
                                            ? fillTemplate(t.transferReceivedStatus, { qty: String(en.qtyReceived ?? ""), discrepancy: String(en.discrepancy) })
                                            : fillTemplate(t.transferReceivedNoDiscrepancy, { qty: String(en.qtyReceived ?? en.qty) })
                                          : en.transferStatus === "in_transit" ? t.transferInTransit : t.transferInTransit;
                                        // if status already contains detail, show "Sent to X · status"
                                        if (dest) transferLine = `${fillTemplate(t.transferSentLabel, { destination: dest })} · ${status}`;
                                        else transferLine = status;
                                      } else if (en.entryType === "transfer_in") {
                                        const src = en.sourceLabel || "";
                                        transferLine = fillTemplate(t.transferReceivedLabel, { source: src });
                                        if (en.discrepancy !== undefined && en.discrepancy !== 0) {
                                          transferLine += ` · ${fillTemplate(t.inboundDiscrepancy, { value: String(en.discrepancy), unit: unitLabel(en.unit, language) })}`;
                                        }
                                      } else if (isCorrection) {
                                        transferLine = t.activityCorrection;
                                      }
                                      return (
                                        <li key={en.id} className={`flex flex-col gap-1 px-3 py-2 font-sans text-sm ${corrected ? "line-through opacity-60" : ""}`}>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={en.entryType === "intake" ? "default" : en.entryType === "distribution" ? "secondary" : "outline"} className="text-xs">
                                              {en.entryType}
                                            </Badge>
                                            <span className="font-medium">{goodsLabel(en.category, language)}</span>
                                            <span className="tabular-nums">
                                              {en.qty} {unitLabel(en.unit, language)}
                                            </span>
                                            {en.discrepancy !== undefined && en.discrepancy !== 0 ? (
                                              <span className="text-xs text-red">{fillTemplate(t.inboundDiscrepancy, { value: String(en.discrepancy), unit: unitLabel(en.unit, language) })}</span>
                                            ) : null}
                                            {corrected ? <Badge variant="destructive" className="text-xs">{t.correctedMark}</Badge> : null}
                                          </div>
                                          {transferLine ? <p className="text-xs text-muted-foreground-foreground">{transferLine}</p> : null}
                                          {en.note ? <p className="text-xs text-muted-foreground-foreground">{en.note}</p> : null}
                                          <p className="text-xs text-muted-foreground-foreground">
                                            {new Date(en.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}
                                            {en.createdByName ? ` · ${en.createdByName}` : ""}
                                          </p>
                                          {!corrected && canCorrect ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="min-h-11 w-fit px-2 text-xs"
                                              onClick={() => setCorrectDialog({ open: true, centerId: center.id, entryId: en.id, note: "", error: null, submitting: false })}
                                            >
                                              {t.correctionButton}
                                            </Button>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {cursorById[center.id] ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="min-h-11 w-full"
                                      onClick={() => fetchEntries(center.id, cursorById[center.id], true)}
                                      disabled={Boolean(entriesLoadingById[center.id])}
                                    >
                                      {entriesLoadingById[center.id] ? "…" : t.loadMore}
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <Dialog open={receiveDialog.open} onOpenChange={(o) => { if (!o) setReceiveDialog((prev) => ({ ...prev, open: false })); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t.inboundDialogTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">{t.inboundDialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qtyReceived">{t.inboundQtyReceivedLabel} *</Label>
                  <Input
                    id="qtyReceived"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={receiveDialog.qtyReceived}
                    onChange={(e) => setReceiveDialog((prev) => ({ ...prev, qtyReceived: e.target.value }))}
                    className="min-h-11"
                  />
                  {receiveDialog.transfer ? (
                    (() => {
                      const declared = receiveDialog.transfer.qty;
                      const received = Number(receiveDialog.qtyReceived);
                      if (receiveDialog.qtyReceived.trim() === "" || Number.isNaN(received)) return null;
                      const diff = declared - received;
                      if (diff === 0) return null;
                      return <p className="font-sans text-sm text-red">{fillTemplate(t.inboundDiscrepancy, { value: String(diff), unit: unitLabel(receiveDialog.transfer.unit, language) })}</p>;
                    })()
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiveNote">{t.inboundNoteLabel}</Label>
                  <Textarea id="receiveNote" value={receiveDialog.note} onChange={(e) => setReceiveDialog((prev) => ({ ...prev, note: e.target.value }))} rows={2} maxLength={500} />
                </div>
                {receiveDialog.error ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {receiveDialog.error}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" className="min-h-11" onClick={() => setReceiveDialog((prev) => ({ ...prev, open: false }))}>
                  Cancel
                </Button>
                <Button className="min-h-11" onClick={handleReceive} disabled={receiveDialog.submitting}>
                  {receiveDialog.submitting ? t.inboundSubmitting : t.inboundSubmit}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={correctDialog.open} onOpenChange={(o) => { if (!o) setCorrectDialog((prev) => ({ ...prev, open: false })); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t.correctionDialogTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">{t.correctionDialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="correctionNote">{t.correctionNoteLabel}</Label>
                  <Textarea id="correctionNote" value={correctDialog.note} onChange={(e) => setCorrectDialog((prev) => ({ ...prev, note: e.target.value }))} rows={3} maxLength={500} placeholder={t.correctionNotePlaceholder} />
                </div>
                {correctDialog.error ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {correctDialog.error}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" className="min-h-11" onClick={() => setCorrectDialog((prev) => ({ ...prev, open: false }))}>
                  Cancel
                </Button>
                <Button className="min-h-11" onClick={handleCorrection} disabled={correctDialog.submitting}>
                  {correctDialog.submitting ? t.correctionSubmitting : t.correctionSubmit}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={removeConfirm.open} onOpenChange={(o) => { if (!o) setRemoveConfirm((prev) => ({ ...prev, open: false })); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t.staffRemoveConfirmTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">
                  {removeConfirm.member ? fillTemplate(t.staffRemoveConfirmBody, { email: removeConfirm.member.email }) : ""}
                </DialogDescription>
              </DialogHeader>
              {removeConfirm.error ? (
                <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                  {removeConfirm.error}
                </p>
              ) : null}
              <DialogFooter>
                <Button variant="outline" className="min-h-11" onClick={() => setRemoveConfirm((prev) => ({ ...prev, open: false }))}>
                  {t.staffRemoveCancel}
                </Button>
                <Button className="min-h-11" onClick={handleRemoveMember} disabled={removeConfirm.submitting}>
                  {removeConfirm.submitting ? t.staffRemoving : t.staffRemoveConfirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmDialog.open} onOpenChange={(o) => { if (!o) setConfirmDialog((prev) => ({ ...prev, open: false })); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t.donorConfirmDialogTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">{t.donorConfirmDialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {confirmDialog.mode === "receive" ? (
                  <div className="space-y-2">
                    <Label htmlFor="donorConfirmQty">{t.donorQtyLabel}</Label>
                    <Input id="donorConfirmQty" type="number" inputMode="decimal" step="0.01" min="0.01" value={confirmDialog.qty} onChange={(e) => setConfirmDialog((prev) => ({ ...prev, qty: e.target.value }))} className="min-h-11" />
                    <p className="font-sans text-xs text-muted-foreground-foreground">{t.donorQtyHint}</p>
                  </div>
                ) : null}
                {confirmDialog.error ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {confirmDialog.error}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" className="min-h-11" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
                  {t.staffRemoveCancel}
                </Button>
                <Button className="min-h-11" onClick={handleConfirmDonation} disabled={confirmDialog.submitting}>
                  {confirmDialog.submitting ? (confirmDialog.mode === "receive" ? t.donorConfirmSubmitting : t.donorNotReceivedSubmitting) : confirmDialog.mode === "receive" ? t.donorConfirmSubmit : t.donorNotReceivedConfirm}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!qrCenter} onOpenChange={(o) => { if (!o) setQrCenter(null); }}>
            <DialogContent className="print:border-0 print:shadow-none">
              <DialogHeader>
                <DialogTitle className="font-serif">{t.printQrTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">{t.printQrInstruction}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 print:space-y-3">
                {qrLoading ? (
                  <p className="font-sans text-sm text-muted-foreground-foreground">…</p>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR code for donor drop" className="mx-auto h-60 w-60 border border-rule" width={240} height={240} />
                ) : null}
                {qrCenter ? (
                  <>
                    <p className="break-all font-mono text-xs">{`${typeof window !== "undefined" ? window.location.origin : ""}/drop-centers/${qrCenter.id}?drop=1`}</p>
                    <p className="font-sans text-xs text-muted-foreground-foreground">{t.printQrInstruction}</p>
                  </>
                ) : null}
                <div className="flex justify-end print:hidden">
                  <Button variant="outline" className="min-h-11" onClick={() => window.print()}>
                    {t.printButton}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addCenterOpen} onOpenChange={setAddCenterOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.orgAddCenterTitle}</DialogTitle>
                <DialogDescription>{t.orgCentersTitle}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddCenter} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="cName">{t.centerNameLabel} *</Label>
                  <Input id="cName" value={cName} onChange={(e) => setCName(e.target.value)} className="min-h-11" required />
                  {cErrors.cName ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cName}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cDistrict">{t.centerDistrictLabel} *</Label>
                    <NativeSelect id="cDistrict" value={cDistrict} onChange={(e) => setCDistrict(e.target.value)} className="min-h-11" required>
                      <option value="">{t.centerSelectDistrict}</option>
                      {districtNames.map((d) => (
                        <NativeSelectOption key={d} value={d}>
                          {districtLabels[d][language]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {cErrors.cDistrict ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cDistrict}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cWard">{t.centerWardLabel}</Label>
                    <Input id="cWard" value={cWard} onChange={(e) => setCWard(e.target.value)} type="number" min="1" max="33" step="1" className="min-h-11" />
                    {cErrors.cWard ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cWard}</p> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cAddress">{t.centerAddressLabel} *</Label>
                  <Textarea id="cAddress" value={cAddress} onChange={(e) => setCAddress(e.target.value)} rows={2} required />
                  {cErrors.cAddress ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cAddress}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cLat">{t.centerLatLabel}</Label>
                    <Input id="cLat" value={cLat} onChange={(e) => setCLat(e.target.value)} type="number" step="0.0001" className="min-h-11" />
                    {cErrors.cLat ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cLat}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cLng">{t.centerLngLabel}</Label>
                    <Input id="cLng" value={cLng} onChange={(e) => setCLng(e.target.value)} type="number" step="0.0001" className="min-h-11" />
                    {cErrors.cLng ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cLng}</p> : null}
                  </div>
                </div>
                {cErrors.cLatLng ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cLatLng}</p> : null}
                <div className="space-y-2">
                  <Label htmlFor="cHours">{t.centerHoursLabel}</Label>
                  <Input id="cHours" value={cHours} onChange={(e) => setCHours(e.target.value)} className="min-h-11" maxLength={200} />
                  {cErrors.cHours ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cHours}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cContactPhone">{t.centerContactPhoneLabel} *</Label>
                  <Input id="cContactPhone" value={cContactPhone} onChange={(e) => setCContactPhone(e.target.value)} inputMode="tel" className="min-h-11" required />
                  {cErrors.cContactPhone ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cContactPhone}</p> : null}
                </div>
                <div className="space-y-2">
                  <fieldset>
                    <legend className="font-sans text-sm font-medium">{t.centerAcceptsLabel} *</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {GOODS_CATEGORIES.map((gc) => (
                        <label key={gc.id} className={`cursor-pointer border px-3 py-2 font-sans text-xs ${cAccepts.includes(gc.id) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}>
                          <input type="checkbox" className="sr-only" checked={cAccepts.includes(gc.id)} onChange={() => setCAccepts((prev) => (prev.includes(gc.id) ? prev.filter((x) => x !== gc.id) : [...prev, gc.id]))} />
                          {goodsLabel(gc.id, language)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {cErrors.cAccepts ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cAccepts}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cNotes">{t.centerNotesLabel}</Label>
                  <Textarea id="cNotes" value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} maxLength={500} />
                  {cErrors.cNotes ? <p className="font-sans text-sm text-destructive" role="alert">{cErrors.cNotes}</p> : null}
                </div>
                {cApiError ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {cApiError}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setAddCenterOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={cSubmitting} className="min-h-11">
                    {cSubmitting ? t.orgAddCenterSubmitting : t.orgAddCenterSubmit}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.orgEditTitle}</DialogTitle>
                <DialogDescription className="font-sans text-sm leading-6">{t.orgEditTitle}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="editName">{t.registerOrgNameLabel} *</Label>
                  <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} className="min-h-11" required />
                  {editErrors.name ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editOrgType">{t.registerOrgOrgTypeLabel} *</Label>
                  <NativeSelect id="editOrgType" value={editOrgType} onChange={(e) => setEditOrgType(e.target.value as OrgType)} className="min-h-11" required>
                    <option value="">{t.registerOrgSelectType}</option>
                    {ORG_TYPES.map((ot) => (
                      <NativeSelectOption key={ot} value={ot}>
                        {t[`orgType_${ot}` as keyof typeof t] ?? ot}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {editErrors.orgType ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.orgType}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRegistrationNumber">{t.registerOrgRegistrationNumberLabel}</Label>
                  <Input id="editRegistrationNumber" value={editRegistrationNumber} onChange={(e) => setEditRegistrationNumber(e.target.value)} className="min-h-11" />
                  {editErrors.registrationNumber ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.registrationNumber}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="editContactName">{t.registerOrgContactNameLabel} *</Label>
                    <Input id="editContactName" value={editContactName} onChange={(e) => setEditContactName(e.target.value)} className="min-h-11" required />
                    {editErrors.contactName ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.contactName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editContactPhone">{t.registerOrgContactPhoneLabel} *</Label>
                    <Input id="editContactPhone" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} inputMode="tel" className="min-h-11" required />
                    {editErrors.contactPhone ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.contactPhone}</p> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editContactEmail">{t.registerOrgContactEmailLabel}</Label>
                  <Input id="editContactEmail" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} type="email" className="min-h-11" />
                  {editErrors.contactEmail ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.contactEmail}</p> : null}
                </div>
                <div className="space-y-2">
                  <fieldset>
                    <legend className="font-sans text-sm font-medium">{t.registerOrgDistrictsLabel} *</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {districtNames.map((d) => (
                        <label key={d} className={`cursor-pointer border px-2 py-1.5 font-sans text-xs ${editDistricts.includes(d) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}>
                          <input type="checkbox" className="sr-only" checked={editDistricts.includes(d)} onChange={() => setEditDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} />
                          {districtLabels[d][language]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {editErrors.districts ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.districts}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDescription">{t.registerOrgDescriptionLabel} *</Label>
                  <Textarea id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} maxLength={2000} required />
                  <p className="font-sans text-xs text-muted-foreground-foreground">{t.registerOrgDescriptionHint}</p>
                  {editErrors.description ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.description}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editWebsite">{t.registerOrgWebsiteLabel}</Label>
                  <Input id="editWebsite" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://" className="min-h-11" maxLength={200} />
                  <p className="font-sans text-xs text-muted-foreground-foreground">{t.registerOrgWebsiteHint}</p>
                  {editErrors.website ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.website}</p> : null}
                </div>
                {editApiError ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {editApiError}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSubmitting} className="min-h-11">
                    {editSubmitting ? t.orgEditSaving : t.orgEditSubmit}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Rule />
        </>
      ) : null}
    </div>
  );
}
