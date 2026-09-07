import { useEffect, useState } from "react";
import { MapPin, Plane, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MunicipalitySelect } from "@/components/municipality-select";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/api-error";
import { districtNames } from "@/lib/districts";
import { getDroneBoard, listIncidents, listKits, createModeratorDroneRequest, createModeratorDroneSite, listModeratorDroneRequests, confirmDroneRequest, cancelDroneRequest, type DroneItem, type DroneLandingSite, type DroneLandingSiteBody, type DronePayloadRequest, type Incident, type KitCatalogueItem } from "@/lib/api";
import { GOODS_CATEGORIES, goodsLabel } from "@/lib/goods";
import { tryGeolocate } from "@/lib/geolocation";
import { useIncidents } from "@/lib/incidents";
import { droneStrings } from "@/i18n/drones";
import type { DeskModel } from "./use-desk";

type ItemDraft = { mode: "kit" | "category"; kitId: string; households: string; category: string; qty: string; unit: string };
type RequestForm = { incidentId: string; district: string; municipalityId: number | ""; ward: string; landingSiteId: string; items: ItemDraft[]; weightKg: string; coldChain: boolean; priority: "urgent" | "normal"; windowStart: string; windowEnd: string; contactPhone: string };
type SiteForm = { name: string; district: string; municipalityId: number | ""; ward: string; lat: string; lng: string; clearanceM: string; surface: DroneLandingSiteBody["surface"]; groundContactName: string; groundContactPhone: string };

const emptyItem = (): ItemDraft => ({ mode: "kit", kitId: "", households: "1", category: "rice", qty: "1", unit: "kg" });
const emptyRequest = (incidentId = "", district = ""): RequestForm => ({ incidentId, district, municipalityId: "", ward: "", landingSiteId: "", items: [emptyItem()], weightKg: "1", coldChain: false, priority: "normal", windowStart: "", windowEnd: "", contactPhone: "" });
const emptySite = (district = ""): SiteForm => ({ name: "", district, municipalityId: "", ward: "", lat: "", lng: "", clearanceM: "", surface: "field", groundContactName: "", groundContactPhone: "" });

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function RequestDialog({ open, onOpenChange, language, token, incidents, sites, districts, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; language: "en" | "ne"; token: string; incidents: Incident[]; sites: DroneLandingSite[]; districts: string[]; onSaved: (item: DronePayloadRequest) => void }) {
  const t = droneStrings[language];
  const [form, setForm] = useState<RequestForm>(() => emptyRequest(incidents[0]?.id, districts[0]));
  const [kits, setKits] = useState<KitCatalogueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(emptyRequest(incidents[0]?.id, districts[0])); setError(null); void listKits().then((response) => setKits(response.kits)).catch(() => setKits([])); } }, [districts, incidents, open]);
  const set = <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index: number, value: Partial<ItemDraft>) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) }));
  const submit = async () => {
    if (!form.incidentId || !form.district || form.municipalityId === "" || !form.ward || !form.windowStart || !form.windowEnd || !form.contactPhone || form.items.some((item) => item.mode === "kit" ? !item.kitId : !item.category || !item.qty || !item.unit)) { setError(t.formError); return; }
    setSaving(true);
    try {
      const items: DroneItem[] = form.items.map((item) => item.mode === "kit" ? { kitId: item.kitId, households: Number(item.households), category: "other", qty: 1, unit: "kit" } : { category: item.category, qty: Number(item.qty), unit: item.unit.trim() });
      const item = await createModeratorDroneRequest(token, { incidentId: form.incidentId, district: form.district, municipalityId: Number(form.municipalityId), ward: Number(form.ward), landingSiteId: form.landingSiteId || undefined, items, weightKg: Number(form.weightKg), coldChain: form.coldChain, priority: form.priority, windowStart: new Date(form.windowStart).toISOString(), windowEnd: new Date(form.windowEnd).toISOString(), contactPhone: form.contactPhone.trim() });
      onSaved(item); onOpenChange(false);
    } catch (cause) { setError(apiErrorMessage(cause, language)); } finally { setSaving(false); }
  };
  const districtSites = sites.filter((site) => site.district === form.district && (form.municipalityId === "" || site.municipalityId === form.municipalityId) && (!form.ward || site.ward === Number(form.ward)));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{t.postRequest}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2"><Label htmlFor="desk-drone-incident">{t.requestIncident}</Label><NativeSelect id="desk-drone-incident" value={form.incidentId} onChange={(event) => set("incidentId", event.target.value)}>{incidents.map((incident) => <NativeSelectOption key={incident.id} value={incident.id}>{language === "ne" && incident.nameNe ? incident.nameNe : incident.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="space-y-2"><Label htmlFor="desk-drone-district">{t.requestDistrict}</Label><NativeSelect id="desk-drone-district" value={form.district} onChange={(event) => { set("district", event.target.value); set("municipalityId", ""); set("ward", ""); set("landingSiteId", ""); }}>{districts.map((district) => <NativeSelectOption key={district} value={district}>{district}</NativeSelectOption>)}</NativeSelect></div>
    <MunicipalitySelect id="desk-drone-municipality" district={form.district} value={form.municipalityId} onChange={(value) => { set("municipalityId", value); set("ward", ""); }} language={language} label={t.requestMunicipality} placeholder={t.selectMunicipality} districtFirst={t.districtFirst} typeLabels={{ unitTypeRural: t.unitTypeRural, unitTypeMunicipality: t.unitTypeMunicipality, unitTypeSubMetro: t.unitTypeSubMetro, unitTypeMetro: t.unitTypeMetro }} />
    <Field id="desk-drone-ward" label={t.requestWard} type="number" value={form.ward} onChange={(value) => set("ward", value)} />
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="desk-drone-site">{t.landingSite}</Label><NativeSelect id="desk-drone-site" value={form.landingSiteId} onChange={(event) => set("landingSiteId", event.target.value)}><NativeSelectOption value="">{t.noLandingSite}</NativeSelectOption>{districtSites.map((site) => <NativeSelectOption key={site.id} value={site.id}>{site.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="space-y-3 sm:col-span-2"><Label>{t.items}</Label>{form.items.map((item, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-5"><NativeSelect aria-label={t.itemType} value={item.mode} onChange={(event) => updateItem(index, { mode: event.target.value as ItemDraft["mode"] })}><NativeSelectOption value="kit">{t.kit}</NativeSelectOption><NativeSelectOption value="category">{t.category}</NativeSelectOption></NativeSelect>{item.mode === "kit" ? <><NativeSelect aria-label={t.kit} value={item.kitId} onChange={(event) => updateItem(index, { kitId: event.target.value })}><NativeSelectOption value="">{t.kit}</NativeSelectOption>{kits.map((kit) => <NativeSelectOption key={kit.id} value={kit.id}>{language === "ne" ? kit.nameNe : kit.name}</NativeSelectOption>)}</NativeSelect><Input aria-label={t.households} type="number" min="1" value={item.households} onChange={(event) => updateItem(index, { households: event.target.value })} /></> : <><NativeSelect aria-label={t.category} value={item.category} onChange={(event) => updateItem(index, { category: event.target.value })}>{GOODS_CATEGORIES.map((category) => <NativeSelectOption key={category.id} value={category.id}>{category[language]}</NativeSelectOption>)}</NativeSelect><Input aria-label={t.quantity} type="number" min="1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} /><Input aria-label={t.unit} value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} /></>}<Button type="button" variant="ghost" onClick={() => set("items", form.items.filter((_, itemIndex) => itemIndex !== index))} disabled={form.items.length === 1}>{t.removeItem}</Button></div>)}<Button type="button" variant="outline" onClick={() => set("items", [...form.items, emptyItem()])}><Plus />{t.addItem}</Button></div>
    <Field id="desk-drone-weight" label={t.weightKg} type="number" value={form.weightKg} onChange={(value) => set("weightKg", value)} /><div className="space-y-2"><Label htmlFor="desk-drone-priority">{t.priority}</Label><NativeSelect id="desk-drone-priority" value={form.priority} onChange={(event) => set("priority", event.target.value as RequestForm["priority"])}><NativeSelectOption value="normal">{t.priorityNormal}</NativeSelectOption><NativeSelectOption value="urgent">{t.priorityUrgent}</NativeSelectOption></NativeSelect></div>
    <Field id="desk-drone-start" label={t.windowStart} type="datetime-local" value={form.windowStart} onChange={(value) => set("windowStart", value)} /><Field id="desk-drone-end" label={t.windowEnd} type="datetime-local" value={form.windowEnd} onChange={(value) => set("windowEnd", value)} /><Field id="desk-drone-phone" label={t.contactPhone} value={form.contactPhone} onChange={(value) => set("contactPhone", value)} />
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.coldChain} onChange={(event) => set("coldChain", event.target.checked)} />{t.coldChain}</label>
  </div>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancelRequest}</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? t.saving : t.submitRequest}</Button></DialogFooter></DialogContent></Dialog>;
}

function SiteDialog({ open, onOpenChange, language, token, districts, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; language: "en" | "ne"; token: string; districts: string[]; onSaved: (item: DroneLandingSite) => void }) {
  const t = droneStrings[language];
  const [form, setForm] = useState<SiteForm>(() => emptySite(districts[0]));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(emptySite(districts[0])); setError(null); } }, [districts, open]);
  const set = <K extends keyof SiteForm>(key: K, value: SiteForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const locate = async () => { const position = await tryGeolocate(); if (position) { set("lat", String(position.lat)); set("lng", String(position.lng)); } };
  const save = async () => {
    if (!form.name || !form.district || form.municipalityId === "" || !form.ward || !form.lat || !form.lng || !form.clearanceM || !form.groundContactName || !form.groundContactPhone) { setError(t.formError); return; }
    setSaving(true);
    try { const item = await createModeratorDroneSite(token, { name: form.name.trim(), district: form.district, municipalityId: Number(form.municipalityId), ward: Number(form.ward), lat: Number(form.lat), lng: Number(form.lng), clearanceM: Number(form.clearanceM), surface: form.surface, groundContactName: form.groundContactName.trim(), groundContactPhone: form.groundContactPhone.trim() }); onSaved(item); onOpenChange(false); } catch (cause) { setError(apiErrorMessage(cause, language)); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{t.registerSite}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field id="desk-site-name" label={t.siteName} value={form.name} onChange={(value) => set("name", value)} /><div className="space-y-2"><Label htmlFor="desk-site-district">{t.district}</Label><NativeSelect id="desk-site-district" value={form.district} onChange={(event) => { set("district", event.target.value); set("municipalityId", ""); }}>{districts.map((district) => <NativeSelectOption key={district} value={district}>{district}</NativeSelectOption>)}</NativeSelect></div><MunicipalitySelect id="desk-site-municipality" district={form.district} value={form.municipalityId} onChange={(value) => set("municipalityId", value)} language={language} label={t.requestMunicipality} placeholder={t.selectMunicipality} districtFirst={t.districtFirst} typeLabels={{ unitTypeRural: t.unitTypeRural, unitTypeMunicipality: t.unitTypeMunicipality, unitTypeSubMetro: t.unitTypeSubMetro, unitTypeMetro: t.unitTypeMetro }} /><Field id="desk-site-ward" label={t.ward} type="number" value={form.ward} onChange={(value) => set("ward", value)} /><div className="space-y-2"><Label htmlFor="desk-site-lat">{t.latitude}</Label><div className="flex gap-2"><Input id="desk-site-lat" type="number" value={form.lat} onChange={(event) => set("lat", event.target.value)} /><Button type="button" variant="outline" onClick={() => void locate()}><MapPin /></Button></div></div><Field id="desk-site-lng" label={t.longitude} type="number" value={form.lng} onChange={(value) => set("lng", value)} /><Field id="desk-site-clearance" label={t.clearanceM} type="number" value={form.clearanceM} onChange={(value) => set("clearanceM", value)} /><NativeSelect aria-label={t.surface} value={form.surface} onChange={(event) => set("surface", event.target.value as SiteForm["surface"])}><NativeSelectOption value="field">{t.surfaceField}</NativeSelectOption><NativeSelectOption value="road">{t.surfaceRoad}</NativeSelectOption><NativeSelectOption value="roof">{t.surfaceRoof}</NativeSelectOption><NativeSelectOption value="riverbank">{t.surfaceRiverbank}</NativeSelectOption><NativeSelectOption value="other">{t.surfaceOther}</NativeSelectOption></NativeSelect><Field id="desk-site-contact" label={t.groundContactName} value={form.groundContactName} onChange={(value) => set("groundContactName", value)} /><Field id="desk-site-phone" label={t.groundContactPhone} value={form.groundContactPhone} onChange={(value) => set("groundContactPhone", value)} /></div>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancelRequest}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? t.saving : t.save}</Button></DialogFooter></DialogContent></Dialog>;
}

export function Drones({ model }: { model: DeskModel }) {
  const t = droneStrings[model.language];
  const { incidents } = useIncidents();
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const districts = model.auth.profile?.districts?.length ? model.auth.profile.districts : districtNames;
  const token = model.auth.idToken;
  const [requests, setRequests] = useState<DronePayloadRequest[]>([]);
  const [sites, setSites] = useState<DroneLandingSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const load = async () => { if (!token) return; setLoading(true); setError(null); try { const statuses: DronePayloadRequest["status"][] = ["open", "assigned", "flown"]; const [requestResponses, board] = await Promise.all([Promise.all(statuses.map((status) => listModeratorDroneRequests(token, status))), getDroneBoard()]); setRequests(requestResponses.flatMap((response) => response.items)); setSites(board.sites); } catch (cause) { setError(apiErrorMessage(cause, model.language)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [token]);
  if (!token) return null;
  const saveRequest = (item: DronePayloadRequest) => setRequests((items) => [item, ...items.filter((current) => current.id !== item.id)]);
  const action = async (request: DronePayloadRequest, kind: "confirm" | "cancel") => { setError(null); try { const updated = kind === "confirm" ? await confirmDroneRequest(token, request.id) : await cancelDroneRequest(token, request.id); setRequests((items) => items.map((item) => item.id === updated.id ? updated : item)); } catch (cause) { setError(apiErrorMessage(cause, model.language)); } };
  return <div className="space-y-8">{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}{loading ? <LoadingState label={t.loading} /> : null}<div className="flex flex-wrap gap-3"><Button onClick={() => setRequestOpen(true)}><Plane />{t.postRequest}</Button><Button variant="outline" onClick={() => setSiteOpen(true)}><Plus />{t.registerSite}</Button></div><section className="space-y-4"><h2 className="text-2xl font-semibold">{t.requestList}</h2>{requests.length ? <div className="grid gap-4">{requests.map((request) => <Card key={request.id}><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">{request.municipality ?? request.municipalityId} · {t.ward} {request.ward}</CardTitle><CardDescription>{request.district} · {request.weightKg} {t.kg}</CardDescription></div><StatusBadge tone={toneForStatus(request.status)}>{t[request.status] ?? request.status}</StatusBadge></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><p className="w-full text-sm">{request.items.map((item) => `${goodsLabel(item.category, model.language)} ${item.qty} ${item.unit}`).join(", ")}</p>{request.status === "flown" ? <Button size="sm" onClick={() => void action(request, "confirm")}>{t.confirm}</Button> : null}{!["delivered", "cancelled"].includes(request.status) ? <Button size="sm" variant="outline" onClick={() => void action(request, "cancel")}>{t.cancelRequest}</Button> : null}</CardContent></Card>)}</div> : <EmptyState title={t.noDeskRequests} />}</section><RequestDialog open={requestOpen} onOpenChange={setRequestOpen} language={model.language} token={token} incidents={activeIncidents} sites={sites} districts={districts} onSaved={saveRequest} /><SiteDialog open={siteOpen} onOpenChange={setSiteOpen} language={model.language} token={token} districts={districts} onSaved={(item) => setSites((items) => [item, ...items])} /></div>;
}
