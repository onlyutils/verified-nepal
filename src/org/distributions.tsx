import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, X } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { MunicipalitySelect } from "@/components/municipality-select";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { distributionStrings } from "@/i18n/distributions";
import {
  cancelDistribution,
  completeDistribution,
  createDistribution,
  listKits,
  listOrgDistributions,
  type CreateDistributionBody,
  type Distribution,
  type DistributionItem,
  type KitCatalogueItem,
} from "@/lib/api";
import { goodsLabel, GOODS_CATEGORIES } from "@/lib/goods";
import { municipalityById } from "@/lib/admin-units";
import { useIncidents } from "@/lib/incidents";
import { formatDateTime } from "@/lib/format-date";
import type { Language } from "@/lib/types";
import type { OrgController } from "./org-types";

type ItemDraft = {
  mode: "kit" | "category";
  kitId: string;
  households: string;
  category: string;
  qty: string;
  unit: string;
};

type FormState = {
  incidentId: string;
  district: string;
  municipalityId: number | "";
  wards: number[];
  plannedDate: string;
  items: ItemDraft[];
  transport: CreateDistributionBody["transport"];
  staffCount: string;
  contactPhone: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): ItemDraft => ({ mode: "kit", kitId: "", households: "1", category: "rice", qty: "1", unit: "kg" });
const emptyForm = (district = "", incidentId = ""): FormState => ({
  incidentId,
  district,
  municipalityId: "",
  wards: [],
  plannedDate: today(),
  items: [emptyItem()],
  transport: "vehicle",
  staffCount: "0",
  contactPhone: "",
  notes: "",
});

function statusLabel(t: Record<string, string>, status: Distribution["status"]) {
  return t[status] ?? status;
}

function transportLabel(t: Record<string, string>, transport: Distribution["transport"]) {
  const labels: Record<Distribution["transport"], string> = {
    vehicle: t.transportVehicle,
    drone: t.transportDrone,
    porter: t.transportPorter,
    helicopter: t.transportHelicopter,
    other: t.transportOther,
  };
  return labels[transport];
}

function ackRoleLabel(t: Record<string, string>, role?: string) {
  return role === "admin" ? t.roleAdmin : role === "moderator" ? t.roleModerator : (role ?? t.acknowledgement);
}

function distributionItems(items: DistributionItem[], kits: KitCatalogueItem[], language: Language) {
  const kitNames = new Map(kits.map((kit) => [kit.id, language === "ne" ? kit.nameNe : kit.name]));
  const seenKits = new Set<string>();
  return items
    .filter((item) => {
      if (!item.kitId) return true;
      const key = `${item.kitId}:${item.households ?? 1}`;
      if (seenKits.has(key)) return false;
      seenKits.add(key);
      return true;
    })
    .map((item) =>
      item.kitId
        ? `${kitNames.get(item.kitId) ?? item.kitId} × ${item.households ?? 1}`
        : `${goodsLabel(item.category, language)} ${item.qty} ${item.unit}`,
    )
    .join("; ");
}

function FormDialog({
  open,
  onOpenChange,
  controller,
  language,
  incidents,
  kits,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller: OrgController;
  language: Language;
  incidents: ReturnType<typeof useIncidents>["incidents"];
  kits: KitCatalogueItem[];
  onSaved: (item: Distribution) => void;
}) {
  const t = distributionStrings[language];
  const firstDistrict = controller.selectedOrg?.districts[0] ?? "";
  const [form, setForm] = useState<FormState>(() => emptyForm(firstDistrict, incidents[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(firstDistrict, incidents[0]?.id ?? ""));
    setError(null);
  }, [firstDistrict, incidents, open]);

  const municipality = municipalityById(form.municipalityId === "" ? undefined : form.municipalityId);
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index: number, value: Partial<ItemDraft>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...value } : item)),
    }));

  const submit = async () => {
    if (!controller.auth.idToken || !controller.selectedOrg) return;
    const items: DistributionItem[] = form.items.map((item) =>
      item.mode === "kit"
        ? { kitId: item.kitId, households: Number(item.households), category: "other", qty: 1, unit: "kit" }
        : { category: item.category, qty: Number(item.qty), unit: item.unit.trim() },
    );
    if (
      !form.incidentId ||
      !form.district ||
      form.municipalityId === "" ||
      form.wards.length === 0 ||
      items.some((item, index) => !item.category || !item.unit || item.qty < 1 || (form.items[index].mode === "kit" && !item.kitId))
    ) {
      setError(t.formError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = await createDistribution(controller.auth.idToken, controller.selectedOrg.id, {
        incidentId: form.incidentId,
        district: form.district,
        municipalityId: Number(form.municipalityId),
        wards: form.wards,
        plannedDate: form.plannedDate,
        items,
        transport: form.transport,
        staffCount: Number(form.staffCount || 0),
        contactPhone: form.contactPhone.trim(),
        notes: form.notes.trim() || undefined,
      });
      onSaved(item);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.file}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="distribution-incident">{t.incident} *</Label>
            <NativeSelect
              id="distribution-incident"
              value={form.incidentId}
              onChange={(event) => setField("incidentId", event.target.value)}
            >
              <NativeSelectOption value="">{t.selectIncident}</NativeSelectOption>
              {incidents.map((incident) => (
                <NativeSelectOption key={incident.id} value={incident.id}>
                  {language === "ne" && incident.nameNe ? incident.nameNe : incident.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distribution-district">{t.district} *</Label>
            <NativeSelect
              id="distribution-district"
              value={form.district}
              onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, municipalityId: "", wards: [] }))}
            >
              <NativeSelectOption value="">{t.selectDistrict}</NativeSelectOption>
              {(controller.selectedOrg?.districts ?? []).map((district) => (
                <NativeSelectOption key={district} value={district}>
                  {district}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <MunicipalitySelect
            id="distribution-municipality"
            district={form.district}
            value={form.municipalityId}
            onChange={(value) => setForm((current) => ({ ...current, municipalityId: value, wards: [] }))}
            language={language}
            label={t.municipality}
            placeholder={t.selectMunicipality}
            districtFirst={t.districtFirst}
            typeLabels={{
              unitTypeRural: t.unitTypeRural,
              unitTypeMunicipality: t.unitTypeMunicipality,
              unitTypeSubMetro: t.unitTypeSubMetro,
              unitTypeMetro: t.unitTypeMetro,
            }}
          />
          <div className="space-y-2">
            <Label>{t.wards} *</Label>
            <div className="grid grid-cols-4 gap-2 rounded-md border p-3 sm:grid-cols-6">
              {municipality ? (
                Array.from({ length: municipality.wards }, (_, index) => index + 1).map((ward) => (
                  <label key={ward} className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.wards.includes(ward)}
                      onCheckedChange={(checked) =>
                        setField("wards", checked ? [...form.wards, ward] : form.wards.filter((value) => value !== ward))
                      }
                    />
                    {ward}
                  </label>
                ))
              ) : (
                <span className="col-span-full text-sm text-muted-foreground">{t.selectMunicipality}</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distribution-date">{t.plannedDateLabel} *</Label>
            <Input
              id="distribution-date"
              type="date"
              value={form.plannedDate}
              onChange={(event) => setField("plannedDate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="distribution-transport">{t.transport} *</Label>
            <NativeSelect
              id="distribution-transport"
              value={form.transport}
              onChange={(event) => setField("transport", event.target.value as FormState["transport"])}
            >
              <NativeSelectOption value="vehicle">{t.transportVehicle}</NativeSelectOption>
              <NativeSelectOption value="drone">{t.transportDrone}</NativeSelectOption>
              <NativeSelectOption value="porter">{t.transportPorter}</NativeSelectOption>
              <NativeSelectOption value="helicopter">{t.transportHelicopter}</NativeSelectOption>
              <NativeSelectOption value="other">{t.transportOther}</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="distribution-staff">{t.staffCount}</Label>
            <Input
              id="distribution-staff"
              type="number"
              min="0"
              max="500"
              value={form.staffCount}
              onChange={(event) => setField("staffCount", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="distribution-phone">{t.contactPhone} *</Label>
            <Input
              id="distribution-phone"
              type="tel"
              value={form.contactPhone}
              onChange={(event) => setField("contactPhone", event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t.items} *</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setField("items", [...form.items, emptyItem()])}>
              <Plus />
              {t.addItem}
            </Button>
          </div>
          {form.items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[8rem_1fr_6rem_6rem_auto]">
              <div className="space-y-2">
                <Label htmlFor={`distribution-item-mode-${index}`}>{t.itemMode}</Label>
                <NativeSelect
                  id={`distribution-item-mode-${index}`}
                  value={item.mode}
                  onChange={(event) => updateItem(index, { mode: event.target.value as ItemDraft["mode"] })}
                >
                  <NativeSelectOption value="kit">{t.kit}</NativeSelectOption>
                  <NativeSelectOption value="category">{t.category}</NativeSelectOption>
                </NativeSelect>
              </div>
              {item.mode === "kit" ? (
                <div className="space-y-2">
                  <Label htmlFor={`distribution-item-kit-${index}`}>{t.kit}</Label>
                  <NativeSelect
                    id={`distribution-item-kit-${index}`}
                    value={item.kitId}
                    onChange={(event) => updateItem(index, { kitId: event.target.value })}
                  >
                    <NativeSelectOption value="">{kits.length ? t.kit : t.noKits}</NativeSelectOption>
                    {kits.map((kit) => (
                      <NativeSelectOption key={kit.id} value={kit.id}>
                        {language === "ne" ? kit.nameNe : kit.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`distribution-item-category-${index}`}>{t.category}</Label>
                  <NativeSelect
                    id={`distribution-item-category-${index}`}
                    value={item.category}
                    onChange={(event) => updateItem(index, { category: event.target.value })}
                  >
                    {GOODS_CATEGORIES.map((category) => (
                      <NativeSelectOption key={category.id} value={category.id}>
                        {goodsLabel(category.id, language)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
              {item.mode === "kit" ? (
                <div className="space-y-2">
                  <Label htmlFor={`distribution-item-households-${index}`}>{t.households}</Label>
                  <Input
                    id={`distribution-item-households-${index}`}
                    type="number"
                    min="1"
                    value={item.households}
                    onChange={(event) => updateItem(index, { households: event.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`distribution-item-qty-${index}`}>{t.quantity}</Label>
                  <Input
                    id={`distribution-item-qty-${index}`}
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(event) => updateItem(index, { qty: event.target.value })}
                  />
                </div>
              )}
              {item.mode === "category" ? (
                <div className="space-y-2">
                  <Label htmlFor={`distribution-item-unit-${index}`}>{t.unit}</Label>
                  <Input
                    id={`distribution-item-unit-${index}`}
                    value={item.unit}
                    onChange={(event) => updateItem(index, { unit: event.target.value })}
                  />
                </div>
              ) : (
                <div />
              )}
              {form.items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label={t.removeItem}
                  onClick={() =>
                    setField(
                      "items",
                      form.items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X />
                </Button>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="distribution-notes">{t.notes}</Label>
          <Textarea
            id="distribution-notes"
            value={form.notes}
            placeholder={t.notesPlaceholder}
            onChange={(event) => setField("notes", event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? t.submitting : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Distributions({ controller }: { controller: OrgController }) {
  const { language, selectedOrg, auth } = controller;
  const t = distributionStrings[language];
  const { incidents } = useIncidents();
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const [items, setItems] = useState<Distribution[]>([]);
  const [kits, setKits] = useState<KitCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<Distribution | null>(null);
  const [households, setHouseholds] = useState("1");
  const [completionNote, setCompletionNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!auth.idToken || !selectedOrg) return;
    setLoading(true);
    setError(null);
    try {
      const [distributionResponse, kitResponse] = await Promise.all([listOrgDistributions(auth.idToken, selectedOrg.id), listKits()]);
      setItems(distributionResponse.items);
      setKits(kitResponse.kits);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [auth.idToken, selectedOrg?.id]);

  const ordered = useMemo(
    () => [...items].sort((a, b) => b.plannedDate.localeCompare(a.plannedDate) || b.createdAt.localeCompare(a.createdAt)),
    [items],
  );
  const updateItem = (updated: Distribution) => setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  const complete = async () => {
    if (!auth.idToken || !selectedOrg || !completionTarget) return;
    setActionLoading(completionTarget.id);
    try {
      const updated = await completeDistribution(auth.idToken, selectedOrg.id, completionTarget.id, {
        householdsReached: Number(households),
        note: completionNote.trim() || undefined,
      });
      updateItem(updated);
      setCompletionTarget(null);
      setMessage(t.actionSuccess);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setActionLoading(null);
    }
  };
  const cancel = async (distribution: Distribution) => {
    if (!auth.idToken || !selectedOrg) return;
    setActionLoading(distribution.id);
    try {
      updateItem(await cancelDistribution(auth.idToken, selectedOrg.id, distribution.id));
      setMessage(t.actionSuccess);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">{t.nav}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{t.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <ClipboardList />
          {t.file}
        </Button>
      </div>
      {message ? (
        <p className="text-sm text-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <LoadingState label={t.loading} />
      ) : !ordered.length ? (
        <EmptyState icon={ClipboardList} title={t.empty} />
      ) : (
        <div className="grid gap-4">
          {ordered.map((distribution) => (
            <Card key={distribution.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    {distribution.plannedDate} · {distribution.municipality ?? distribution.municipalityId}
                  </CardTitle>
                  <CardDescription>
                    {t.wards}: {distribution.wards.join(", ")} · {t.transport}: {transportLabel(t, distribution.transport)}
                  </CardDescription>
                </div>
                <StatusBadge tone={toneForStatus(distribution.status)}>{statusLabel(t, distribution.status)}</StatusBadge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm">
                  <span className="font-medium">{t.items}:</span> {distributionItems(distribution.items, kits, language)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {distribution.ackBy ? t.acknowledgedBy.replace("{role}", ackRoleLabel(t, distribution.ackBy.role)) : t.notAcknowledged}
                </p>
                {distribution.status === "planned" || distribution.status === "acknowledged" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setCompletionTarget(distribution);
                        setHouseholds("1");
                        setCompletionNote("");
                      }}
                    >
                      {t.complete}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void cancel(distribution)}
                      disabled={actionLoading === distribution.id}
                    >
                      {t.cancelDistribution}
                    </Button>
                  </div>
                ) : null}
                {distribution.completedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t.completedHouseholds}: {distribution.householdsReached ?? 0} · {formatDateTime(distribution.completedAt, language)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        controller={controller}
        language={language}
        incidents={activeIncidents}
        kits={kits}
        onSaved={(item) => {
          setItems((current) => [item, ...current]);
          setMessage(t.createSuccess);
        }}
      />
      <Dialog
        open={Boolean(completionTarget)}
        onOpenChange={(open) => {
          if (!open) setCompletionTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.complete}</DialogTitle>
            <DialogDescription>{t.completedHouseholds}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="distribution-households">{t.completedHouseholds}</Label>
              <Input
                id="distribution-households"
                type="number"
                min="1"
                value={households}
                onChange={(event) => setHouseholds(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distribution-completion-note">{t.completionNote}</Label>
              <Textarea
                id="distribution-completion-note"
                value={completionNote}
                onChange={(event) => setCompletionNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionTarget(null)}>
              {t.cancel}
            </Button>
            <Button onClick={() => void complete()} disabled={Boolean(actionLoading)}>
              {actionLoading ? t.completing : t.saveCompletion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
