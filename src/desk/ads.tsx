import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { MunicipalitySelect } from "@/components/municipality-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { adsStrings } from "@/i18n/ads";
import { createAd, deleteAd, getAdminAds, presignArticleMedia, updateAd, type AdBody, type AdSlotName, type AdTarget, type AdminAd } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { municipalityById, municipalityLabel } from "@/lib/admin-units";
import { districtLabels, districtNames, type DistrictName } from "@/lib/districts";
import { formatDateTime } from "@/lib/format";
import { uploadMedia } from "@/lib/media";
import { MEDIA_LIMITS } from "@/articles/types";
import type { Language } from "@/lib/types";

type Draft = {
  id?: string;
  slot: AdSlotName;
  kind: AdTarget["kind"];
  district: string;
  municipalityId: number | "";
  image: AdBody["image"] | null;
  href: string;
  labelEn: string;
  labelNe: string;
  startAt: string;
  endAt: string;
  note: string;
};
const blankDraft = (): Draft => ({
  slot: "articleEnd", kind: "all", district: "", municipalityId: "", image: null,
  href: "", labelEn: "", labelNe: "", startAt: "", endAt: "", note: "",
});

function localDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 19);
}

export function Ads({ language, token }: { language: Language; token: string }) {
  const t = adsStrings[language];
  const [items, setItems] = useState<AdminAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [datesInvalid, setDatesInvalid] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "save"; body: AdBody } | { kind: "delete"; item: AdminAd } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setListError(null);
    try {
      const response = await getAdminAds(token);
      if (version === requestVersion.current) setItems(response.items);
    } catch (cause) {
      if (version === requestVersion.current) setListError(apiErrorMessage(cause, language));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [token, language]);
  useEffect(() => {
    void load();
    return () => { requestVersion.current++; };
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const edit = (item: AdminAd) => {
    const municipality = item.target.kind === "municipality" ? municipalityById(Number(item.target.value)) : undefined;
    setDraft({
      id: item.id, slot: item.slot, kind: item.target.kind,
      district: item.target.kind === "district" ? item.target.value : municipality?.district || "",
      municipalityId: municipality?.id ?? "", image: item.image, href: item.href,
      labelEn: item.label.en, labelNe: item.label.ne,
      startAt: localDate(item.startAt), endAt: localDate(item.endAt), note: item.note || "",
    });
    setError(null);
    setDatesInvalid(false);
    formRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    formRef.current?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  };
  const upload = async (file: File) => {
    setError(null);
    if (!(MEDIA_LIMITS.image.types as readonly string[]).includes(file.type) || file.size > MEDIA_LIMITS.image.maxBytes) {
      setError(t.invalidImage);
      return;
    }
    setUploading(true);
    try {
      change("image", await uploadMedia((body) => presignArticleMedia(token, body), file));
    } catch { setError(t.uploadFailed); }
    finally { setUploading(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const start = new Date(draft.startAt).getTime();
    const end = new Date(draft.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setDatesInvalid(true);
      setError(t.invalidDates);
      return;
    }
    setDatesInvalid(false);
    let validUrl = false;
    try { validUrl = ["http:", "https:"].includes(new URL(draft.href.trim()).protocol); } catch {}
    if (!draft.image || !draft.labelEn.trim() || !draft.labelNe.trim() || !validUrl ||
      (draft.kind !== "all" && !districtNames.includes(draft.district as DistrictName)) ||
      (draft.kind === "municipality" && municipalityById(Number(draft.municipalityId))?.district !== draft.district)) {
      setError(t.required);
      return;
    }
    const target: AdTarget = draft.kind === "all" ? { kind: "all" } : {
      kind: draft.kind, value: draft.kind === "district" ? draft.district : String(draft.municipalityId),
    };
    setConfirm({ kind: "save", body: {
      slot: draft.slot, target, image: draft.image, href: draft.href.trim(),
      label: { en: draft.labelEn.trim(), ne: draft.labelNe.trim() },
      startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), note: draft.note.trim(),
    } });
  };
  const apply = async () => {
    if (!confirm || busy || (confirm.kind === "delete" && !deleteReason.trim())) return;
    setBusy(true);
    setError(null);
    try {
      if (confirm.kind === "save") {
        const saved = draft.id ? await updateAd(token, draft.id, confirm.body) : await createAd(token, confirm.body);
        setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setDraft(blankDraft());
        setMessage(t.saved);
      } else {
        await deleteAd(token, confirm.item.id);
        setItems((current) => current.filter((item) => item.id !== confirm.item.id));
        if (draft.id === confirm.item.id) setDraft(blankDraft());
        setMessage(t.deleted);
      }
      setConfirm(null);
    } catch (cause) { setError(apiErrorMessage(cause, language)); }
    finally { setBusy(false); }
  };
  const targetLabel = (target: AdTarget) => {
    if (target.kind === "all") return t.all;
    if (target.kind === "district") return `${t.district}: ${districtLabels[target.value as DistrictName]?.[language] || target.value}`;
    const municipality = municipalityById(Number(target.value));
    return `${t.municipality}: ${municipality ? municipalityLabel(municipality, language) : target.value}`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Alert><AlertDescription>{t.registrationNotice}</AlertDescription></Alert>
      <PageHeader as="h2" title={t.title} description={t.description} />
      {error && !confirm ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {message ? <Alert role="status"><AlertDescription>{message}</AlertDescription></Alert> : null}
      <Card>
        <CardHeader><CardTitle><h3>{draft.id ? t.editTitle : t.create}</h3></CardTitle></CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={submit}>
            <fieldset disabled={busy || uploading || Boolean(confirm)} className="flex min-w-0 flex-col gap-4">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="ad-slot">{t.slot}</Label>
                  <NativeSelect id="ad-slot" value={draft.slot} onChange={(event) => change("slot", event.target.value as AdSlotName)}>
                    <NativeSelectOption value="articleEnd">{t.articleEnd}</NativeSelectOption>
                    {/* ponytail: Keep the frozen slot selectable; add its public placement when the local page gate opens. */}
                    <NativeSelectOption value="localTop">{t.localTop}</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="ad-target">{t.target}</Label>
                  <NativeSelect id="ad-target" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Draft["kind"], district: "", municipalityId: "" }))}>
                    <NativeSelectOption value="all">{t.all}</NativeSelectOption>
                    <NativeSelectOption value="district">{t.district}</NativeSelectOption>
                    <NativeSelectOption value="municipality">{t.municipality}</NativeSelectOption>
                  </NativeSelect>
                </div>
                {draft.kind !== "all" ? (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="ad-district">{t.district} *</Label>
                    <NativeSelect id="ad-district" required value={draft.district} onChange={(event) => setDraft((current) => ({ ...current, district: event.target.value, municipalityId: "" }))}>
                      <NativeSelectOption value="">{t.chooseDistrict}</NativeSelectOption>
                      {districtNames.map((district) => <NativeSelectOption key={district} value={district}>{districtLabels[district][language]}</NativeSelectOption>)}
                    </NativeSelect>
                  </div>
                ) : null}
                {draft.kind === "municipality" ? (
                  <MunicipalitySelect id="ad-municipality" district={draft.district} value={draft.municipalityId}
                    onChange={(value) => change("municipalityId", value)} language={language} label={t.municipality}
                    placeholder={t.chooseMunicipality} districtFirst={t.districtFirst} typeLabels={t} />
                ) : null}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="ad-image">{t.image} *</Label>
                <Input id="ad-image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="ad-image-help"
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
                <p id="ad-image-help" className="text-sm text-muted-foreground">{t.imageHelp}</p>
                {uploading ? <p role="status" className="text-sm">{t.uploading}</p> : null}
                {draft.image ? <img src={draft.image.url} alt={(language === "ne" ? draft.labelNe : draft.labelEn) || t.preview} className="aspect-video w-full max-w-md rounded-md border object-contain" /> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-href">{t.href} *</Label>
                <Input id="ad-href" type="url" required value={draft.href} onChange={(event) => change("href", event.target.value)} />
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="ad-label-en">{t.labelEn} *</Label>
                  <Input id="ad-label-en" lang="en" required value={draft.labelEn} onChange={(event) => change("labelEn", event.target.value)} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="ad-label-ne">{t.labelNe} *</Label>
                  <Input id="ad-label-ne" lang="ne" required value={draft.labelNe} onChange={(event) => change("labelNe", event.target.value)} />
                </div>
                {(["startAt", "endAt"] as const).map((key) => (
                  <div key={key} className="min-w-0 space-y-2">
                    <Label htmlFor={`ad-${key}`}>{t[key]} *</Label>
                    <Input id={`ad-${key}`} type="datetime-local" step="1" required value={draft[key]} className="min-w-0 max-w-full"
                      aria-invalid={datesInvalid} aria-describedby={datesInvalid ? "ad-dates-error ad-dates-help" : "ad-dates-help"}
                      onChange={(event) => { change(key, event.target.value); setDatesInvalid(false); }} />
                  </div>
                ))}
              </div>
              <p id="ad-dates-help" className="text-sm text-muted-foreground">{t.dateHelp}</p>
              {datesInvalid ? <p id="ad-dates-error" className="text-sm text-destructive" role="alert">{t.invalidDates}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="ad-note">{t.note}</Label>
                <Textarea id="ad-note" value={draft.note} onChange={(event) => change("note", event.target.value)} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" size="lg">{t.save}</Button>
                {draft.id ? <Button type="button" variant="secondary" onClick={() => { setDraft(blankDraft()); setError(null); setDatesInvalid(false); }}>{t.cancel}</Button> : null}
              </div>
            </fieldset>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><h3>{t.listTitle}</h3></CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState label={t.loading} /> : listError ? (
            <Alert variant="destructive"><AlertDescription>{listError}<Button variant="secondary" className="mt-2 block" onClick={() => void load()}>{t.retry}</Button></AlertDescription></Alert>
          ) : items.length === 0 ? <EmptyState title={t.empty} /> : (
            <ul className="divide-y">
              {items.map((item) => {
                const status = item.active ? "active" : new Date(item.endAt).getTime() <= Date.now() ? "ended" : new Date(item.startAt).getTime() > Date.now() ? "scheduled" : "inactive";
                return (
                  <li key={item.id} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-2 break-words text-sm">
                      <p className="font-semibold">{item.label[language]}</p>
                      <StatusBadge tone={status === "active" ? "success" : status === "scheduled" ? "warning" : "neutral"}>{t[status]}</StatusBadge>
                      <p>{t.slot}: {t[item.slot]}</p>
                      <p>{targetLabel(item.target)}</p>
                      <p>{t.startAt}: <time dateTime={item.startAt}>{formatDateTime(item.startAt, language)}</time></p>
                      <p>{t.endAt}: <time dateTime={item.endAt}>{formatDateTime(item.endAt, language)}</time></p>
                      {item.note ? <p className="whitespace-pre-wrap">{t.note}: {item.note}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-start gap-2">
                      <Button variant="secondary" disabled={busy || uploading} onClick={() => edit(item)} aria-label={`${t.edit}: ${item.label[language]}`}>{t.edit}</Button>
                      <Button variant="destructive" disabled={busy || uploading} onClick={() => { setConfirm({ kind: "delete", item }); setDeleteReason(""); setError(null); }} aria-label={`${t.delete}: ${item.label[language]}`}>{t.delete}</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open && !busy) { setConfirm(null); setError(null); } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto [&>button:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>{confirm?.kind === "delete" ? t.deleteTitle : t.saveTitle}</DialogTitle>
            <DialogDescription>{confirm?.kind === "delete" ? t.deleteBody : t.saveBody}</DialogDescription>
          </DialogHeader>
          {confirm?.kind === "delete" ? (
            <div className="space-y-2">
              <p className="break-words text-sm">{confirm.item.label[language]}</p>
              {/* ponytail: Deletion reason confirms intent locally; send it to the audit log when DELETE accepts a reason. */}
              <Label htmlFor="ad-delete-reason">{t.deleteReason} *</Label>
              <Textarea id="ad-delete-reason" required disabled={busy} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} />
            </div>
          ) : null}
          {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <DialogFooter>
            <Button variant="secondary" disabled={busy} onClick={() => { setConfirm(null); setError(null); }}>{t.cancel}</Button>
            <Button variant={confirm?.kind === "delete" ? "destructive" : "default"} disabled={busy || (confirm?.kind === "delete" && !deleteReason.trim())} onClick={() => void apply()}>
              {confirm?.kind === "delete" ? busy ? t.deleting : t.delete : busy ? t.saving : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
