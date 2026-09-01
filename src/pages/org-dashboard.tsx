import { useCallback, useEffect, useState } from "react";
import {
  createCenter,
  createEntry,
  getCenterStock,
  listCenterEntries,
  listMyOrgs,
  listOrgCenters,
  updateCenter,
  updateOrg,
  type CenterPrivate,
  type MyOrg,
  type OrgType,
  ORG_TYPES,
  type CenterStatus,
  CENTER_STATUSES,
  type StockItem,
  type GoodsEntry,
} from "../api";
import { apiErrorMessage } from "../api-error";
import { useGoogleAuth } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { districtLabels, districtNames } from "../geo";
import { GOODS_CATEGORIES, goodsLabel, unitLabel } from "../goods";
import { orgStrings } from "../i18n-orgs";
import type { Language, Page } from "../types";
import { Rule, SectionLabel, SquareButton, StatusMark } from "../ui";

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

export function OrgDashboard({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = orgStrings[language];
  const auth = useGoogleAuth();

  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
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
  const [logFormById, setLogFormById] = useState<Record<string, { entryType: "intake" | "distribution"; category: string; qty: string; note: string; error: string | null; fieldErrors: Record<string, string>; submitting: boolean }>>({});

  const selectedOrg = orgs?.find((o) => o.id === selectedId) ?? null;
  const isOwner = selectedOrg?.role === "owner";

  const fetchOrgs = useCallback(async () => {
    if (!auth.idToken) return;
    setLoadingOrgs(true);
    setOrgsError(null);
    try {
      const res = await listMyOrgs(auth.idToken);
      setOrgs(res.items);
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

  const toggleExpanded = (centerId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(centerId)) next.delete(centerId);
      else {
        next.add(centerId);
        if (!stockById[centerId] && !stockLoadingById[centerId]) fetchStock(centerId);
        if (!entriesById[centerId] && !entriesLoadingById[centerId]) fetchEntries(centerId);
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
      setOrgs((prev) => {
        if (!prev) return prev;
        return prev.map((o) => (o.id === selectedOrg.id ? { ...o, name: trimmedName, orgType: editOrgType as OrgType, registrationNumber: editRegistrationNumber.trim() || undefined, contactName: trimmedContactName, contactPhone: trimmedPhone, contactEmail: trimmedEmail || undefined, districts: [...editDistricts], description: trimmedDesc, website: editWebsite.trim() || undefined } : o));
      });
      setEditOpen(false);
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
    if (form.entryType !== "intake" && form.entryType !== "distribution") fieldErrors.entryType = t.validationEntryType;
    if (!form.category) fieldErrors.category = t.validationEntryCategory;
    const qtyNum = Number(form.qty);
    const qtyValid = !Number.isNaN(qtyNum) && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum <= 1000000 && /^\d+(\.\d{1,2})?$/.test(form.qty.trim());
    if (!qtyValid) fieldErrors.qty = t.validationEntryQty;
    if (form.note.trim().length > 500) fieldErrors.note = t.validationEntryNote;
    if (Object.keys(fieldErrors).length > 0) {
      setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, fieldErrors, error: null } }));
      return;
    }
    setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, submitting: true, error: null, fieldErrors: {} } }));
    try {
      await createEntry(auth.idToken, centerId, {
        entryType: form.entryType,
        category: form.category,
        qty: qtyNum,
        note: form.note.trim() || undefined,
      });
      setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, qty: "", note: "", submitting: false, error: null, fieldErrors: {} } }));
      fetchStock(centerId);
      fetchEntries(centerId);
    } catch (err) {
      setLogFormById((prev) => ({ ...prev, [centerId]: { ...form, submitting: false, error: apiErrorMessage(err, language), fieldErrors: {} } }));
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
        <p className="font-sans text-sm text-muted-foreground">{t.orgDashboardLoading}</p>
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

  if (orgs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <SectionLabel>{t.orgDashboardTitle}</SectionLabel>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.orgDashboardTitle}</h1>
        </header>
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

      {orgs.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="orgSelector">{t.orgDashboardSelectorLabel}</Label>
          <Select id="orgSelector" value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="min-h-11 max-w-sm">
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </Select>
        </div>
      ) : null}

      {selectedOrg ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="font-serif text-xl">{selectedOrg.name}</CardTitle>
                <StatusMark tone={orgStatusTone(selectedOrg.status)}>{orgStatusText(selectedOrg, t as unknown as Record<string, string>)}</StatusMark>
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
              <p className="font-serif leading-6 text-muted-foreground">{selectedOrg.description}</p>
              {selectedOrg.website ? (
                <p>
                  <span className="font-semibold">{t.orgWebsiteLabel}:</span>{" "}
                  <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="underline">
                    {selectedOrg.website}
                  </a>
                </p>
              ) : null}
              {selectedOrg.rejectionReason ? (
                <p className="text-destructive">
                  {t.orgStatusReasonPrefix} {selectedOrg.rejectionReason}
                </p>
              ) : null}
              {selectedOrg.suspensionReason ? (
                <p className="text-destructive">
                  {t.orgStatusReasonPrefix} {selectedOrg.suspensionReason}
                </p>
              ) : null}
              {isOwner ? (
                <Button variant="outline" className="min-h-11" onClick={openEdit}>
                  {t.orgEditButton}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.orgEditTitle}</DialogTitle>
                <DialogDescription>{t.orgDistrictsLabel}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="editName">{t.registerOrgNameLabel} *</Label>
                  <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} className="min-h-11" required />
                  {editErrors.name ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editOrgType">{t.registerOrgOrgTypeLabel} *</Label>
                  <Select id="editOrgType" value={editOrgType} onChange={(e) => setEditOrgType(e.target.value as OrgType)} className="min-h-11">
                    <option value="">{t.registerOrgSelectType}</option>
                    {ORG_TYPES.map((ot) => (
                      <SelectItem key={ot} value={ot}>
                        {t[`orgType_${ot}` as keyof typeof t] ?? ot}
                      </SelectItem>
                    ))}
                  </Select>
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
                        <label key={d} className={`cursor-pointer border px-3 py-2 font-sans text-xs ${editDistricts.includes(d) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}>
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
                  <Textarea id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} required />
                  {editErrors.description ? <p className="font-sans text-sm text-destructive" role="alert">{editErrors.description}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editWebsite">{t.registerOrgWebsiteLabel}</Label>
                  <Input id="editWebsite" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="min-h-11" />
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

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold">{t.orgCentersTitle}</h2>
              {isOwner ? (
                <Button onClick={() => setAddCenterOpen(true)} className="min-h-11">
                  {t.orgAddCenter}
                </Button>
              ) : null}
            </div>

            {loadingCenters ? (
              <p className="font-sans text-sm text-muted-foreground">{t.orgDashboardLoading}</p>
            ) : centersError ? (
              <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                {centersError}
              </p>
            ) : centers.length === 0 ? (
              <p className="border border-rule bg-card px-4 py-6 text-center font-sans text-sm text-muted-foreground">{t.orgCentersEmpty}</p>
            ) : (
              <div className="space-y-4">
                {centers.map((center) => {
                  const isExpanded = expanded.has(center.id);
                  const stock = stockById[center.id] ?? [];
                  const entries = entriesById[center.id] ?? [];
                  const logForm = logFormById[center.id] ?? { entryType: "intake" as const, category: "", qty: "", note: "", error: null, fieldErrors: {}, submitting: false };
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
                              {center.hours ? <p className="font-sans text-xs text-muted-foreground">{center.hours}</p> : null}
                              <div className="flex flex-wrap gap-1">
                                {center.accepts.map((a) => (
                                  <Badge key={a} variant="secondary" className="text-xs">
                                    {goodsLabel(a, language)}
                                  </Badge>
                                ))}
                              </div>
                              {isOwner ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Select
                                    value={center.status}
                                    onChange={(e) => handleCenterStatusChange(center, e.target.value as CenterStatus)}
                                    className="min-h-11 max-w-[160px]"
                                    disabled={Boolean(centerStatusUpdating[center.id])}
                                    aria-label={t.centerStatusLabel}
                                  >
                                    {CENTER_STATUSES.map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s === "open" ? t.centerStatusOpen : s === "paused" ? t.centerStatusPaused : t.centerStatusClosed}
                                      </SelectItem>
                                    ))}
                                  </Select>
                                  {centerStatusUpdating[center.id] ? <span className="font-sans text-xs text-muted-foreground">…</span> : null}
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
                                <p className="font-sans text-sm text-muted-foreground">{t.orgDashboardLoading}</p>
                              ) : stockErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {stockErrorById[center.id]}
                                </p>
                              ) : stock.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground">{t.stockEmpty}</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse font-sans text-sm">
                                    <thead>
                                      <tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                              <fieldset className="flex gap-4">
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
                              </fieldset>
                              {logForm.fieldErrors.entryType ? <p className="font-sans text-sm text-destructive" role="alert">{logForm.fieldErrors.entryType}</p> : null}
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`cat-${center.id}`}>{t.logEntryCategoryLabel} *</Label>
                                  <Select
                                    id={`cat-${center.id}`}
                                    value={logForm.category}
                                    onChange={(e) => setLogFormById((prev) => ({ ...prev, [center.id]: { ...logForm, category: e.target.value } }))}
                                    className="min-h-11"
                                  >
                                    <option value="">{t.logEntryCategorySelect}</option>
                                    {GOODS_CATEGORIES.map((gc) => (
                                      <SelectItem key={gc.id} value={gc.id}>
                                        {goodsLabel(gc.id, language)} ({unitLabel(gc.unit, language)})
                                      </SelectItem>
                                    ))}
                                  </Select>
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
                                  <p className="font-sans text-xs text-muted-foreground">{t.logEntryQtyHint}</p>
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
                              <h3 className="font-sans text-xs font-semibold uppercase tracking-wide">{t.recentEntriesTitle}</h3>
                              {entriesLoadingById[center.id] && entries.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground">{t.orgDashboardLoading}</p>
                              ) : entriesErrorById[center.id] ? (
                                <p className="font-sans text-sm text-destructive" role="alert">
                                  {entriesErrorById[center.id]}
                                </p>
                              ) : entries.length === 0 ? (
                                <p className="font-sans text-sm text-muted-foreground">{t.recentEntriesEmpty}</p>
                              ) : (
                                <>
                                  <ul className="divide-y divide-rule border border-rule">
                                    {entries.map((en) => {
                                      const corrected = Boolean(en.correctedByEntryId);
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
                                            {corrected ? <Badge variant="destructive" className="text-xs">{t.correctedMark}</Badge> : null}
                                          </div>
                                          {en.note ? <p className="text-xs text-muted-foreground">{en.note}</p> : null}
                                          <p className="text-xs text-muted-foreground">
                                            {new Date(en.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}
                                            {en.createdByName ? ` · ${en.createdByName}` : ""}
                                          </p>
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
                    <Select id="cDistrict" value={cDistrict} onChange={(e) => setCDistrict(e.target.value)} className="min-h-11" required>
                      <option value="">{t.centerSelectDistrict}</option>
                      {districtNames.map((d) => (
                        <SelectItem key={d} value={d}>
                          {districtLabels[d][language]}
                        </SelectItem>
                      ))}
                    </Select>
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

          <Rule />
        </>
      ) : null}
    </div>
  );
}
