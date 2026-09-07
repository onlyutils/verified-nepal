import { useEffect, useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { MunicipalitySelect } from "@/components/municipality-select";
import { tryGeolocate } from "@/lib/geolocation";
import { apiErrorMessage } from "@/lib/api-error";
import { districtNames } from "@/lib/districts";
import { municipalityById } from "@/lib/admin-units";
import { goodsLabel } from "@/lib/goods";
import { useIncidents } from "@/lib/incidents";
import { uploadMedia } from "@/lib/media";
import {
  assignDroneRequest,
  createOrgDroneOperator,
  createOrgDroneSite,
  listOrgDroneOperators,
  listOrgDroneRequests,
  listOrgDroneSites,
  markDroneMissionFlown,
  planDroneMission,
  presignNeedMedia,
  updateOrgDroneOperator,
  type DroneLandingSiteBody,
  type DroneOperator,
  type DroneOperatorBody,
  type DronePayloadRequest,
  type DroneMission,
} from "@/lib/api";
import { droneStrings } from "@/i18n/drones";
import type { Language } from "@/lib/types";
import type { OrgController } from "./org-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge, toneForStatus } from "@/components/status-badge";

type OperatorForm = {
  aircraft: string;
  payloadKg: string;
  rangeKm: string;
  caanUin: string;
  permitStatus: DroneOperatorBody["permitStatus"];
  permitRef: string;
  baseDistrict: string;
  baseMunicipalityId: number | "";
  contactPhone: string;
  status: DroneOperatorBody["status"];
};

type SiteForm = {
  name: string;
  district: string;
  municipalityId: number | "";
  ward: string;
  lat: string;
  lng: string;
  clearanceM: string;
  surface: DroneLandingSiteBody["surface"];
  groundContactName: string;
  groundContactPhone: string;
};

const emptyOperator = (district = ""): OperatorForm => ({ aircraft: "", payloadKg: "", rangeKm: "", caanUin: "", permitStatus: "none", permitRef: "", baseDistrict: district, baseMunicipalityId: "", contactPhone: "", status: "active" });
const emptySite = (district = ""): SiteForm => ({ name: "", district, municipalityId: "", ward: "", lat: "", lng: "", clearanceM: "", surface: "field", groundContactName: "", groundContactPhone: "" });

function permitLabel(status: DroneOperator["permitStatus"], t: Record<string, string>) {
  return status === "none" ? t.permitNone : status === "applied" ? t.permitApplied : t.permitGranted;
}

function surfaceLabel(surface: SiteForm["surface"], t: Record<string, string>) {
  return t[`surface${surface[0].toUpperCase()}${surface.slice(1)}`] ?? surface;
}

function requestItems(request: DronePayloadRequest, language: Language) {
  return request.items.map((item) => `${goodsLabel(item.category, language)} ${item.qty} ${item.unit}`).join(", ");
}

function InputField({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function OperatorDialog({ open, onOpenChange, operator, district, language, token, orgId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; operator: DroneOperator | null; district: string; language: Language; token: string; orgId: string; onSaved: (item: DroneOperator) => void }) {
  const t = droneStrings[language];
  const [form, setForm] = useState<OperatorForm>(() => emptyOperator(district));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm(operator ? { aircraft: operator.aircraft, payloadKg: String(operator.payloadKg), rangeKm: String(operator.rangeKm), caanUin: operator.caanUin ?? "", permitStatus: operator.permitStatus, permitRef: operator.permitRef ?? "", baseDistrict: operator.baseDistrict, baseMunicipalityId: operator.baseMunicipalityId ?? "", contactPhone: operator.contactPhone ?? "", status: operator.status } : emptyOperator(district));
    setError(null);
  }, [district, open, operator]);
  const set = <K extends keyof OperatorForm>(key: K, value: OperatorForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.aircraft || !form.payloadKg || !form.rangeKm || !form.baseDistrict || !form.contactPhone) { setError(t.formError); return; }
    setSaving(true);
    try {
      const body: DroneOperatorBody = { aircraft: form.aircraft.trim(), payloadKg: Number(form.payloadKg), rangeKm: Number(form.rangeKm), caanUin: form.caanUin.trim() || undefined, permitStatus: form.permitStatus, permitRef: form.permitRef.trim() || undefined, baseDistrict: form.baseDistrict, baseMunicipalityId: form.baseMunicipalityId === "" ? undefined : Number(form.baseMunicipalityId), contactPhone: form.contactPhone.trim(), status: form.status };
      const item = operator ? await updateOrgDroneOperator(token, orgId, operator.id, body) : await createOrgDroneOperator(token, orgId, body);
      onSaved(item);
      onOpenChange(false);
    } catch (cause) { setError(apiErrorMessage(cause, language)); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{operator ? t.editOperator : t.addOperator}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    <InputField id="drone-aircraft" label={`${t.operatorAircraft} *`} value={form.aircraft} onChange={(value) => set("aircraft", value)} />
    <InputField id="drone-payload" label={`${t.operatorPayload} *`} type="number" value={form.payloadKg} onChange={(value) => set("payloadKg", value)} />
    <InputField id="drone-range" label={`${t.operatorRange} *`} type="number" value={form.rangeKm} onChange={(value) => set("rangeKm", value)} />
    <InputField id="drone-uin" label={t.caanUin} value={form.caanUin} onChange={(value) => set("caanUin", value)} />
    <div className="space-y-2"><Label htmlFor="drone-permit-status">{t.permitStatus}</Label><NativeSelect id="drone-permit-status" value={form.permitStatus} onChange={(event) => set("permitStatus", event.target.value as OperatorForm["permitStatus"])}><NativeSelectOption value="none">{t.permitNone}</NativeSelectOption><NativeSelectOption value="applied">{t.permitApplied}</NativeSelectOption><NativeSelectOption value="granted">{t.permitGranted}</NativeSelectOption></NativeSelect></div>
    <InputField id="drone-permit-ref" label={t.permitRef} value={form.permitRef} onChange={(value) => set("permitRef", value)} />
    <div className="space-y-2"><Label htmlFor="drone-base-district">{t.baseDistrict} *</Label><NativeSelect id="drone-base-district" value={form.baseDistrict} onChange={(event) => { set("baseDistrict", event.target.value); set("baseMunicipalityId", ""); }}><NativeSelectOption value="">{t.selectDistrict}</NativeSelectOption>{districtNames.map((districtName) => <NativeSelectOption key={districtName} value={districtName}>{districtName}</NativeSelectOption>)}</NativeSelect></div>
    <MunicipalitySelect id="drone-base-municipality" district={form.baseDistrict} value={form.baseMunicipalityId} onChange={(value) => set("baseMunicipalityId", value)} language={language} label={t.baseMunicipality} placeholder={t.selectMunicipality} districtFirst={t.districtFirst} typeLabels={{ unitTypeRural: t.unitTypeRural, unitTypeMunicipality: t.unitTypeMunicipality, unitTypeSubMetro: t.unitTypeSubMetro, unitTypeMetro: t.unitTypeMetro }} />
    <InputField id="drone-operator-phone" label={`${t.contactPhone} *`} value={form.contactPhone} onChange={(value) => set("contactPhone", value)} />
    <div className="space-y-2"><Label htmlFor="drone-operator-status">{t.status}</Label><NativeSelect id="drone-operator-status" value={form.status} onChange={(event) => set("status", event.target.value as OperatorForm["status"])}><NativeSelectOption value="active">{t.active}</NativeSelectOption><NativeSelectOption value="inactive">{t.inactive}</NativeSelectOption></NativeSelect></div>
  </div>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? t.saving : t.save}</Button></DialogFooter></DialogContent></Dialog>;
}

function SiteDialog({ open, onOpenChange, district, language, token, orgId, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; district: string; language: Language; token: string; orgId: string; onSaved: (item: DroneLandingSiteBody & { id: string }) => void }) {
  const t = droneStrings[language];
  const [form, setForm] = useState<SiteForm>(() => emptySite(district));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(emptySite(district)); setError(null); } }, [district, open]);
  const set = <K extends keyof SiteForm>(key: K, value: SiteForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.name || !form.district || form.municipalityId === "" || !form.ward || !form.lat || !form.lng || !form.clearanceM || !form.groundContactName || !form.groundContactPhone) { setError(t.formError); return; }
    setSaving(true);
    try {
      const item = await createOrgDroneSite(token, orgId, { name: form.name.trim(), district: form.district, municipalityId: Number(form.municipalityId), ward: Number(form.ward), lat: Number(form.lat), lng: Number(form.lng), clearanceM: Number(form.clearanceM), surface: form.surface, groundContactName: form.groundContactName.trim(), groundContactPhone: form.groundContactPhone.trim() });
      onSaved(item as DroneLandingSiteBody & { id: string }); onOpenChange(false);
    } catch (cause) { setError(apiErrorMessage(cause, language)); } finally { setSaving(false); }
  };
  const locate = async () => { const position = await tryGeolocate(); if (position) { set("lat", String(position.lat)); set("lng", String(position.lng)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{t.addSite}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    <InputField id="drone-site-name" label={`${t.siteName} *`} value={form.name} onChange={(value) => set("name", value)} />
    <div className="space-y-2"><Label htmlFor="drone-site-district">{t.district} *</Label><NativeSelect id="drone-site-district" value={form.district} onChange={(event) => { set("district", event.target.value); set("municipalityId", ""); set("ward", ""); }}><NativeSelectOption value="">{t.selectDistrict}</NativeSelectOption>{districtNames.map((districtName) => <NativeSelectOption key={districtName} value={districtName}>{districtName}</NativeSelectOption>)}</NativeSelect></div>
    <MunicipalitySelect id="drone-site-municipality" district={form.district} value={form.municipalityId} onChange={(value) => set("municipalityId", value)} language={language} label={t.requestMunicipality} placeholder={t.selectMunicipality} districtFirst={t.districtFirst} typeLabels={{ unitTypeRural: t.unitTypeRural, unitTypeMunicipality: t.unitTypeMunicipality, unitTypeSubMetro: t.unitTypeSubMetro, unitTypeMetro: t.unitTypeMetro }} />
    <InputField id="drone-site-ward" label={`${t.ward} *`} type="number" value={form.ward} onChange={(value) => set("ward", value)} />
    <div className="space-y-2"><Label htmlFor="drone-site-lat">{t.latitude} *</Label><div className="flex gap-2"><Input id="drone-site-lat" type="number" value={form.lat} onChange={(event) => set("lat", event.target.value)} /><Button type="button" variant="outline" onClick={() => void locate()}><MapPin />{t.useLocation}</Button></div></div>
    <InputField id="drone-site-lng" label={`${t.longitude} *`} type="number" value={form.lng} onChange={(value) => set("lng", value)} />
    <InputField id="drone-site-clearance" label={`${t.clearanceM} *`} type="number" value={form.clearanceM} onChange={(value) => set("clearanceM", value)} />
    <div className="space-y-2"><Label htmlFor="drone-site-surface">{t.surface}</Label><NativeSelect id="drone-site-surface" value={form.surface} onChange={(event) => set("surface", event.target.value as SiteForm["surface"])}><NativeSelectOption value="field">{t.surfaceField}</NativeSelectOption><NativeSelectOption value="road">{t.surfaceRoad}</NativeSelectOption><NativeSelectOption value="roof">{t.surfaceRoof}</NativeSelectOption><NativeSelectOption value="riverbank">{t.surfaceRiverbank}</NativeSelectOption><NativeSelectOption value="other">{t.surfaceOther}</NativeSelectOption></NativeSelect></div>
    <InputField id="drone-site-contact-name" label={`${t.groundContactName} *`} value={form.groundContactName} onChange={(value) => set("groundContactName", value)} />
    <InputField id="drone-site-contact-phone" label={`${t.groundContactPhone} *`} value={form.groundContactPhone} onChange={(value) => set("groundContactPhone", value)} />
  </div>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? t.saving : t.save}</Button></DialogFooter></DialogContent></Dialog>;
}

export function Drones({ controller }: { controller: OrgController }) {
  const t = droneStrings[controller.language];
  const { incidents } = useIncidents();
  const [operators, setOperators] = useState<DroneOperator[]>([]);
  const [sites, setSites] = useState<Array<DroneLandingSiteBody & { id: string; municipality?: string }>>([]);
  const [requests, setRequests] = useState<DronePayloadRequest[]>([]);
  const [missions, setMissions] = useState<Record<string, DroneMission>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [operatorTarget, setOperatorTarget] = useState<DroneOperator | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<DronePayloadRequest | null>(null);
  const [assignOperator, setAssignOperator] = useState("");
  const [missionTarget, setMissionTarget] = useState<DronePayloadRequest | null>(null);
  const [missionForm, setMissionForm] = useState({ etd: "", eta: "", permitRef: "", notamRef: "", note: "" });
  const [flownFiles, setFlownFiles] = useState<Record<string, File | undefined>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const org = controller.selectedOrg;
  const token = controller.auth.idToken;
  const load = async () => {
    if (!org || !token) return;
    setLoading(true); setError(null);
    try {
      const [operatorResponse, siteResponse, requestResponse] = await Promise.all([listOrgDroneOperators(token, org.id), listOrgDroneSites(token, org.id), listOrgDroneRequests(token, org.id)]);
      setOperators(operatorResponse.items); setSites(siteResponse.items as Array<DroneLandingSiteBody & { id: string; municipality?: string }>); setRequests(requestResponse.items);
    } catch (cause) { setError(apiErrorMessage(cause, controller.language)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [org?.id, token]);
  if (!org || !token) return null;
  const firstDistrict = org.districts[0] ?? "";
  const openRequests = requests.filter((request) => request.status === "open");
  const assignedRequests = requests.filter((request) => request.status === "assigned" && !request.missionId);
  const myMissions = requests.filter((request) => request.missionId);
  const saveAssignment = async () => { if (!assignTarget || !assignOperator) return; setActionLoading(assignTarget.id); try { const updated = await assignDroneRequest(token, org.id, assignTarget.id, assignOperator); setRequests((items) => items.map((item) => item.id === updated.id ? updated : item)); setAssignTarget(null); } catch (cause) { setError(apiErrorMessage(cause, controller.language)); } finally { setActionLoading(null); } };
  const saveMission = async () => { if (!missionTarget || !missionForm.etd || !missionForm.eta) return; setActionLoading(missionTarget.id); try { const mission = await planDroneMission(token, org.id, missionTarget.id, { etd: new Date(missionForm.etd).toISOString(), eta: new Date(missionForm.eta).toISOString(), permitRef: missionForm.permitRef.trim() || undefined, notamRef: missionForm.notamRef.trim() || undefined, note: missionForm.note.trim() || undefined }); setMissions((items) => ({ ...items, [missionTarget.id]: mission })); setRequests((items) => items.map((item) => item.id === missionTarget.id ? { ...item, missionId: mission.id } : item)); setMissionTarget(null); } catch (cause) { setError(apiErrorMessage(cause, controller.language)); } finally { setActionLoading(null); } };
  const markFlown = async (request: DronePayloadRequest) => { if (!request.missionId) return; setActionLoading(request.id); try { const file = flownFiles[request.id]; let dropPhoto; if (file) { const uploaded = await uploadMedia((body) => presignNeedMedia({ ...body, purpose: "receipt" }, token), file); dropPhoto = { fileId: uploaded.fileId, type: "photo" as const, originalUrl: uploaded.url }; } const mission = await markDroneMissionFlown(token, org.id, request.missionId, dropPhoto ? { dropPhoto } : {}); setMissions((items) => ({ ...items, [request.id]: mission })); setRequests((items) => items.map((item) => item.id === request.id ? { ...item, status: "flown" } : item)); } catch (cause) { setError(apiErrorMessage(cause, controller.language)); } finally { setActionLoading(null); } };
  return <div className="space-y-8">
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {loading ? <LoadingState label={t.loading} /> : null}
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{t.operators}</h2><p className="text-sm text-muted-foreground">{t.orgDescription}</p></div><Button onClick={() => { setOperatorTarget(null); setOperatorOpen(true); }}><Plus />{t.addOperator}</Button></div>{operators.length ? <div className="grid gap-4 md:grid-cols-2">{operators.map((operator) => <Card key={operator.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="text-base">{operator.aircraft}</CardTitle><CardDescription>{operator.payloadKg} {t.kg} · {operator.rangeKm} {t.km}</CardDescription></div><Button variant="ghost" size="icon" onClick={() => { setOperatorTarget(operator); setOperatorOpen(true); }}><Pencil /></Button></CardHeader><CardContent className="text-sm">{operator.baseDistrict} · {permitLabel(operator.permitStatus, t)} · {operator.status === "active" ? t.active : t.inactive}</CardContent></Card>)}</div> : <EmptyState title={t.operatorEmpty} />}</section>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{t.landingSites}</h2><Button onClick={() => setSiteOpen(true)}><Plus />{t.addSite}</Button></div>{sites.length ? <div className="grid gap-4 md:grid-cols-2">{sites.map((site) => <Card key={site.id}><CardHeader><CardTitle className="text-base">{site.name}</CardTitle><CardDescription>{site.municipality ?? site.municipalityId} · {t.ward} {site.ward}</CardDescription></CardHeader><CardContent className="text-sm">{surfaceLabel(site.surface, t)} · {site.clearanceM} {t.meters} · {site.lat}, {site.lng}</CardContent></Card>)}</div> : <EmptyState title={t.siteEmpty} />}</section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.requestList}</h2>{openRequests.length ? <div className="grid gap-4">{openRequests.map((request) => <Card key={request.id}><CardHeader><CardTitle className="text-base">{request.municipality ?? request.municipalityId} · {t.ward} {request.ward}</CardTitle><CardDescription>{requestItems(request, controller.language)} · {request.weightKg} {t.kg}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><StatusBadge tone={request.priority === "urgent" ? "danger" : "info"}>{request.priority === "urgent" ? t.priorityUrgent : t.priorityNormal}</StatusBadge><Button size="sm" onClick={() => { setAssignTarget(request); setAssignOperator(operators.find((item) => item.status === "active")?.id ?? ""); }}>{t.assign}</Button></CardContent></Card>)}</div> : <EmptyState title={t.noRequests} />}</section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">{t.missions}</h2>{assignedRequests.length ? <div className="grid gap-4">{assignedRequests.map((request) => <Card key={request.id}><CardHeader><CardTitle className="text-base">{request.municipality ?? request.municipalityId} · {t.ward} {request.ward}</CardTitle><CardDescription>{request.assignedOrgName ?? org.name}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => { setMissionTarget(request); setMissionForm({ etd: "", eta: "", permitRef: "", notamRef: "", note: "" }); }}>{t.planMission}</Button></CardContent></Card>)}</div> : null}{myMissions.length ? <div className="grid gap-4">{myMissions.map((request) => { const mission = missions[request.id]; return <Card key={request.id}><CardHeader><CardTitle className="text-base">{request.municipality ?? request.municipalityId} · {t.ward} {request.ward}</CardTitle><CardDescription>{t.missionId}: {request.missionId}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm">{mission?.etd ? `${t.etd}: ${mission.etd}` : t.planned}</p>{request.status === "assigned" || request.status === "flown" ? <><Input id={`drone-photo-${request.id}`} type="file" accept="image/*" onChange={(event) => setFlownFiles((items) => ({ ...items, [request.id]: event.target.files?.[0] }))} /><Button size="sm" onClick={() => void markFlown(request)} disabled={actionLoading === request.id}>{t.markFlown}</Button></> : <StatusBadge tone={toneForStatus(request.status)}>{t[request.status] ?? request.status}</StatusBadge>}</CardContent></Card>; })}</div> : <EmptyState title={t.noMissions} />}</section>
    <OperatorDialog open={operatorOpen} onOpenChange={setOperatorOpen} operator={operatorTarget} district={firstDistrict} language={controller.language} token={token} orgId={org.id} onSaved={(item) => { setOperators((items) => operatorTarget ? items.map((current) => current.id === item.id ? item : current) : [item, ...items]); }} />
    <SiteDialog open={siteOpen} onOpenChange={setSiteOpen} district={firstDistrict} language={controller.language} token={token} orgId={org.id} onSaved={(item) => setSites((items) => [item, ...items])} />
    <Dialog open={Boolean(assignTarget)} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{t.assign}</DialogTitle></DialogHeader><div className="space-y-2"><Label htmlFor="drone-assign-operator">{t.selectOperator}</Label><NativeSelect id="drone-assign-operator" value={assignOperator} onChange={(event) => setAssignOperator(event.target.value)}><NativeSelectOption value="">{t.selectOperator}</NativeSelectOption>{operators.filter((operator) => operator.status === "active").map((operator) => <NativeSelectOption key={operator.id} value={operator.id}>{operator.aircraft}</NativeSelectOption>)}</NativeSelect></div><DialogFooter><Button variant="outline" onClick={() => setAssignTarget(null)}>{t.cancel}</Button><Button onClick={() => void saveAssignment()} disabled={!assignOperator || actionLoading === assignTarget?.id}>{t.assign}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(missionTarget)} onOpenChange={(open) => { if (!open) setMissionTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{t.planMission}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><InputField id="drone-etd" label={t.etd} type="datetime-local" value={missionForm.etd} onChange={(value) => setMissionForm((form) => ({ ...form, etd: value }))} /><InputField id="drone-eta" label={t.eta} type="datetime-local" value={missionForm.eta} onChange={(value) => setMissionForm((form) => ({ ...form, eta: value }))} /><InputField id="drone-mission-permit" label={t.permitRef} value={missionForm.permitRef} onChange={(value) => setMissionForm((form) => ({ ...form, permitRef: value }))} /><InputField id="drone-mission-notam" label={t.notam} value={missionForm.notamRef} onChange={(value) => setMissionForm((form) => ({ ...form, notamRef: value }))} /><InputField id="drone-mission-note" label={t.missionNote} value={missionForm.note} onChange={(value) => setMissionForm((form) => ({ ...form, note: value }))} /></div><DialogFooter><Button variant="outline" onClick={() => setMissionTarget(null)}>{t.cancel}</Button><Button onClick={() => void saveMission()} disabled={actionLoading === missionTarget?.id}>{t.planMission}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
