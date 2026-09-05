import { useEffect, useState } from "react";
import { Check, Home, Search } from "lucide-react";
import {
  CATEGORIES,
  claimNeed,
  createNeed,
  getStatus,
  presignNeedMedia,
  renewNeed,
  type Category,
  type NeedMediaItem,
  type StatusResponse,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { districtLabels, districtNames } from "@/lib/geo";
import { useIncidents } from "@/lib/incidents";
import { saveSelectedIncidentId } from "@/lib/incidents";
import { labels } from "@/i18n";
import { disasterStrings } from "@/i18n/disasters";
import { formStrings } from "@/i18n/forms";
import { meStrings } from "@/i18n/me";
import type { Language } from "@/lib/types";
import type { DistrictName } from "@/lib/districts";
import { TurnstileWidget } from "@/components/turnstile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CodeDisplay } from "@/components/code-display";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { SignInNudge } from "@/components/sign-in-nudge";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const DRAFT_KEY = "vn:need-draft";
const MAX_NEED_MEDIA_ITEMS = 4; // Keep in sync with server MAX_NEED_MEDIA_ITEMS.
const MAX_NEED_PHOTO_SIZE = 8 * 1024 * 1024; // Keep in sync with server MAX_PHOTO_SIZE.
const MAX_NEED_VIDEO_SIZE = 50 * 1024 * 1024; // Keep in sync with server MAX_VIDEO_SIZE.
const NEED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const NEED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const NEW_INCIDENT_VALUE = "__new_incident__";
type FieldKey =
  | "beneficiaryName"
  | "district"
  | "ward"
  | "description"
  | "registrantName"
  | "registrantPhone"
  | "consent"
  | "registrantEmail"
  | "beneficiaryEmail"
  | "beneficiaryPhone"
  | "incident"
  | "newIncidentName"
  | "newIncidentKind"
  | "newIncidentDistrict"
  | "newIncidentDescription"
  | "media";

function categoryLabel(category: Category, language: Language) {
  const t = labels[language];
  return (
    (
      {
        goods: t.categoryGoods,
        shelter: t.categoryShelter,
        transport: t.categoryTransport,
        medical: t.categoryMedical,
        "skilled-labor": t.categorySkilledLabor,
        "funds-guidance": t.categoryFundsGuidance,
      } as Record<Category, string>
    )[category] ?? t.unavailable
  );
}
function isValidPhone(value: string) {
  return /^[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ""));
}
function isValidEmail(value: string) {
  return value.includes("@");
}
function statusLabel(status: string, language: Language) {
  const t = labels[language];
  return (
    (
      {
        published: t.deskNeedsStatusPublished,
        matched: t.deskNeedsStatusMatched,
        fulfilled: t.deskNeedsStatusFulfilled,
        archived: t.deskNeedsStatusArchived,
        pending: t.deskNeedsStatusPending,
        rejected: t.deskNeedsStatusRejected,
      } as Record<string, string>
    )[status] ?? t.unavailable
  );
}

export function GetHelp({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];
  const disaster = disasterStrings[language];
  const auth = useGoogleAuth();
  const { incidents, currentIncidentId, setCurrentIncidentId } = useIncidents();
  const [onBehalf, setOnBehalf] = useState(false);
  const [consent, setConsent] = useState(false);
  const [registrantName, setRegistrantName] = useState("");
  const [registrantPhone, setRegistrantPhone] = useState("");
  const [registrantEmail, setRegistrantEmail] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [beneficiaryEmail, setBeneficiaryEmail] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [category, setCategory] = useState<Category>("goods");
  const [description, setDescription] = useState("");
  const [newIncidentMode, setNewIncidentMode] = useState(false);
  const [newIncidentName, setNewIncidentName] = useState("");
  const [newIncidentKind, setNewIncidentKind] = useState("");
  const [newIncidentDistrict, setNewIncidentDistrict] = useState("");
  const [newIncidentDescription, setNewIncidentDescription] = useState("");
  const [mediaItems, setMediaItems] = useState<NeedMediaItem[]>([]);
  const [mediaNames, setMediaNames] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, string>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [success, setSuccess] = useState<{ id: string; refCode: string } | null>(null);
  const [draftTime, setDraftTime] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.idToken) return;
    let pending: string | null = null;
    try {
      pending = localStorage.getItem("vn:need-last");
    } catch {}
    if (!pending) return;
    claimNeed(auth.idToken, pending)
      .catch(() => {})
      .finally(() => {
        try {
          localStorage.removeItem("vn:need-last");
        } catch {}
      });
  }, [auth.idToken]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.onBehalf === "boolean") setOnBehalf(draft.onBehalf);
      if (typeof draft.consent === "boolean") setConsent(draft.consent);
      if (typeof draft.registrantName === "string") setRegistrantName(draft.registrantName);
      if (typeof draft.registrantPhone === "string") setRegistrantPhone(draft.registrantPhone);
      if (typeof draft.registrantEmail === "string") setRegistrantEmail(draft.registrantEmail);
      if (typeof draft.beneficiaryName === "string") setBeneficiaryName(draft.beneficiaryName);
      if (typeof draft.beneficiaryPhone === "string") setBeneficiaryPhone(draft.beneficiaryPhone);
      if (typeof draft.beneficiaryEmail === "string") setBeneficiaryEmail(draft.beneficiaryEmail);
      if (typeof draft.district === "string") setDistrict(draft.district);
      if (typeof draft.ward === "string") setWard(draft.ward);
      if (typeof draft.householdSize === "string") setHouseholdSize(draft.householdSize);
      if (typeof draft.category === "string" && CATEGORIES.includes(draft.category as Category)) setCategory(draft.category as Category);
      if (typeof draft.description === "string") setDescription(draft.description);
      if (typeof draft.newIncidentMode === "boolean") setNewIncidentMode(draft.newIncidentMode);
      if (typeof draft.incidentId === "string") saveSelectedIncidentId(draft.incidentId);
      if (typeof draft.newIncidentName === "string") setNewIncidentName(draft.newIncidentName);
      if (typeof draft.newIncidentKind === "string") setNewIncidentKind(draft.newIncidentKind);
      if (typeof draft.newIncidentDistrict === "string") setNewIncidentDistrict(draft.newIncidentDistrict);
      if (typeof draft.newIncidentDescription === "string") setNewIncidentDescription(draft.newIncidentDescription);
      if (typeof draft.savedAt === "string") setDraftTime(new Date(draft.savedAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US"));
    } catch {
      /* an unreadable draft should not block the form */
    }
  }, []);

  useEffect(() => {
    if (success) return;
    const payload = {
      onBehalf,
      consent,
      registrantName,
      registrantPhone,
      registrantEmail,
      beneficiaryName,
      beneficiaryPhone,
      beneficiaryEmail,
      district,
      ward,
      householdSize,
      category,
      description,
      incidentId: newIncidentMode ? undefined : currentIncidentId,
      newIncidentMode,
      newIncidentName,
      newIncidentKind,
      newIncidentDistrict,
      newIncidentDescription,
      savedAt: new Date().toISOString(),
    };
    if (
      !registrantName &&
      !registrantPhone &&
      !registrantEmail &&
      !beneficiaryName &&
      !beneficiaryPhone &&
      !beneficiaryEmail &&
      !district &&
      !ward &&
      !householdSize &&
      !description &&
      !currentIncidentId &&
      !newIncidentMode &&
      !newIncidentName &&
      !newIncidentKind &&
      !newIncidentDistrict &&
      !newIncidentDescription
    )
      return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* storage can be unavailable */
    }
  }, [
    beneficiaryEmail,
    beneficiaryName,
    beneficiaryPhone,
    category,
    consent,
    description,
    district,
    householdSize,
    onBehalf,
    registrantEmail,
    registrantName,
    registrantPhone,
    success,
    ward,
    currentIncidentId,
    newIncidentDescription,
    newIncidentDistrict,
    newIncidentKind,
    newIncidentMode,
    newIncidentName,
  ]);

  const clearError = (key: FieldKey) =>
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  const update =
    (key: FieldKey, setter: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(event.target.value);
      clearError(key);
    };
  const resetForAnother = () => {
    setBeneficiaryName("");
    setBeneficiaryPhone("");
    setBeneficiaryEmail("");
    setDescription("");
    setNewIncidentMode(false);
    setNewIncidentName("");
    setNewIncidentKind("");
    setNewIncidentDistrict("");
    setNewIncidentDescription("");
    setHouseholdSize("");
    setMediaItems([]);
    setMediaNames({});
    setUploadingFiles({});
    setMediaError(null);
    setError(null);
    setErrors({});
    setSuccess(null);
  };

  const handleMediaChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setMediaError(null);

    const available = Math.max(0, MAX_NEED_MEDIA_ITEMS - mediaItems.length - Object.keys(uploadingFiles).length);
    const validationErrors: string[] = [];
    const validFiles = files.filter((file) => {
      if (![...NEED_PHOTO_TYPES, ...NEED_VIDEO_TYPES].includes(file.type)) {
        if (!validationErrors.includes(ts.getHelpMediaInvalidType)) validationErrors.push(ts.getHelpMediaInvalidType);
        return false;
      }
      const maxSize = NEED_PHOTO_TYPES.includes(file.type) ? MAX_NEED_PHOTO_SIZE : MAX_NEED_VIDEO_SIZE;
      if (file.size <= 0 || file.size > maxSize) {
        if (!validationErrors.includes(ts.getHelpMediaTooLarge)) validationErrors.push(ts.getHelpMediaTooLarge);
        return false;
      }
      return true;
    });
    if (validFiles.length > available || (files.length > available && available === 0)) {
      validationErrors.push(ts.getHelpMediaTooMany);
    }
    const filesToUpload = validFiles.slice(0, available);
    if (validationErrors.length) setMediaError(validationErrors.join(" "));

    await Promise.all(
      filesToUpload.map(async (file, index) => {
        const uploadId = `${Date.now()}-${index}-${file.name}`;
        setUploadingFiles((current) => ({ ...current, [uploadId]: file.name }));
        try {
          const presign = await presignNeedMedia({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            turnstileToken: turnstileToken || undefined,
          });
          const headers = {
            ...(presign.headers || {}),
            ...(presign.headers?.["Content-Type"] || presign.headers?.["content-type"] ? {} : { "Content-Type": file.type }),
          };
          const upload = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers });
          if (!upload.ok) throw new Error("upload");
          const item: NeedMediaItem = { fileId: presign.fileId, type: presign.mediaType, originalUrl: presign.publicUrl };
          setMediaItems((current) => [...current, item]);
          setMediaNames((current) => ({ ...current, [item.fileId]: file.name }));
        } catch {
          setMediaError(ts.getHelpMediaUploadError);
        } finally {
          setUploadingFiles((current) => {
            const next = { ...current };
            delete next[uploadId];
            return next;
          });
        }
      }),
    );
  };

  const removeMedia = (fileId: string) => {
    setMediaItems((current) => current.filter((item) => item.fileId !== fileId));
    setMediaNames((current) => {
      const next = { ...current };
      delete next[fileId];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const next: Partial<Record<FieldKey, string>> = {};
    if (!newIncidentMode && !currentIncidentId) next.incident = disaster.incidentValidation;
    if (newIncidentMode) {
      if (!newIncidentName.trim()) next.newIncidentName = disaster.reportIncidentRequired;
      if (!newIncidentKind.trim()) next.newIncidentKind = disaster.reportIncidentRequired;
      if (!newIncidentDistrict) next.newIncidentDistrict = disaster.reportIncidentRequired;
      if (!newIncidentDescription.trim()) next.newIncidentDescription = disaster.reportIncidentRequired;
      if (!mediaItems.some((item) => item.type === "photo")) next.media = disaster.incidentPhotoRequired;
      if (!auth.idToken) next.incident = disaster.reportIncidentSignIn;
    }
    if (!beneficiaryName.trim()) next.beneficiaryName = ts.validationBeneficiaryName;
    if (!district) next.district = ts.validationDistrict;
    const wardNumber = Number(ward);
    if (!ward.trim() || Number.isNaN(wardNumber) || wardNumber < 1 || wardNumber > 35) next.ward = ts.validationWardRange;
    if (!description.trim()) next.description = ts.validationDescription;
    if (onBehalf) {
      if (!registrantName.trim()) next.registrantName = ts.validationRegistrantName;
      if (!registrantPhone.trim()) next.registrantPhone = ts.validationRegistrantPhoneRequired;
      else if (!isValidPhone(registrantPhone.trim())) next.registrantPhone = ts.validationPhoneInvalid;
      if (!consent) next.consent = ts.validationConsent;
    }
    if (registrantEmail.trim() && !isValidEmail(registrantEmail.trim())) next.registrantEmail = ts.validationEmailInvalid;
    if (beneficiaryEmail.trim() && !isValidEmail(beneficiaryEmail.trim())) next.beneficiaryEmail = ts.validationEmailInvalid;
    if (beneficiaryPhone.trim() && !isValidPhone(beneficiaryPhone.trim())) next.beneficiaryPhone = ts.validationPhoneInvalid;
    if (Object.keys(next).length) {
      setErrors(next);
      const order: FieldKey[] = [
        "beneficiaryName",
        "district",
        "ward",
        "description",
        "registrantName",
        "registrantPhone",
        "consent",
        "registrantEmail",
        "beneficiaryEmail",
        "beneficiaryPhone",
        "incident",
        "newIncidentName",
        "newIncidentKind",
        "newIncidentDistrict",
        "newIncidentDescription",
        "media",
      ];
      const first = order.find((key) => next[key]);
      document.getElementById(first ?? "beneficiaryName")?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const response = await createNeed(
        {
          onBehalf,
          registrant: onBehalf
            ? { name: registrantName.trim(), phone: registrantPhone.trim(), email: registrantEmail.trim() || undefined }
            : null,
          beneficiary: {
            name: beneficiaryName.trim(),
            phone: beneficiaryPhone.trim() || undefined,
            email: beneficiaryEmail.trim() || undefined,
            district,
            ward: wardNumber,
            householdSize: householdSize ? Number(householdSize) : undefined,
          },
          category,
          description: description.trim(),
          language,
          turnstileToken: turnstileToken || undefined,
          media: mediaItems.length ? mediaItems : undefined,
          ...(newIncidentMode
            ? {
                newIncident: {
                  name: newIncidentName.trim(),
                  kind: newIncidentKind.trim(),
                  district: newIncidentDistrict as DistrictName,
                  description: newIncidentDescription.trim(),
                },
              }
            : { incidentId: currentIncidentId }),
        },
        auth.idToken || undefined,
      );
      setSuccess(response);
      setDraftTime(null);
      try {
        localStorage.removeItem(DRAFT_KEY);
        if (!auth.idToken) localStorage.setItem("vn:need-last", response.refCode);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <SuccessScreen language={language} success={success} resetForAnother={resetForAnother} />;
  const errorCount = Object.keys(errors).length;
  const summary = errorCount === 1 ? ts.validationSummaryOne : ts.validationSummary.replace("{n}", String(errorCount));
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={ts.mutualAidEyebrow} title={t.getHelpTitle} description={t.getHelpLead} />
      {draftTime ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{ts.draftRestored.replace("{time}", draftTime)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  localStorage.removeItem(DRAFT_KEY);
                } catch {}
                setDraftTime(null);
              }}
            >
              {ts.discardDraft}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{ts.getHelpAboutPerson}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t.getHelpForWhom}</legend>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant={onBehalf ? "outline" : "default"} onClick={() => setOnBehalf(false)} className="flex-1">
                  {t.getHelpForMyself}
                </Button>
                <Button type="button" variant={onBehalf ? "default" : "outline"} onClick={() => setOnBehalf(true)} className="flex-1">
                  {t.getHelpForSomeoneElse}
                </Button>
              </div>
            </fieldset>
            <Field
              id="beneficiaryName"
              label={`${t.getHelpBeneficiaryName} *`}
              value={beneficiaryName}
              onChange={update("beneficiaryName", setBeneficiaryName)}
              error={errors.beneficiaryName}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="beneficiaryPhone"
                label={t.getHelpBeneficiaryPhone}
                value={beneficiaryPhone}
                onChange={update("beneficiaryPhone", setBeneficiaryPhone)}
                error={errors.beneficiaryPhone}
                inputMode="tel"
              />
              <Field
                id="beneficiaryEmail"
                label={t.getHelpBeneficiaryEmail}
                value={beneficiaryEmail}
                onChange={update("beneficiaryEmail", setBeneficiaryEmail)}
                error={errors.beneficiaryEmail}
                type="email"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts.getHelpWhere}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="district">{t.getHelpDistrict} *</Label>
              <NativeSelect
                id="district"
                value={district}
                onChange={update("district", setDistrict)}
                aria-invalid={Boolean(errors.district)}
                aria-describedby={errors.district ? "district-error" : undefined}
              >
                <NativeSelectOption value="">{t.getHelpSelectDistrict}</NativeSelectOption>
                {districtNames.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {districtLabels[item][language]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError id="district-error" error={errors.district} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident">{disaster.incidentPickerLabel} *</Label>
              <NativeSelect
                id="incident"
                value={newIncidentMode ? NEW_INCIDENT_VALUE : (currentIncidentId ?? "")}
                onChange={(event) => {
                  const value = event.target.value;
                  clearError("incident");
                  if (value === NEW_INCIDENT_VALUE) {
                    setNewIncidentMode(true);
                    if (!newIncidentDistrict) setNewIncidentDistrict(district);
                  } else {
                    setNewIncidentMode(false);
                    if (value) setCurrentIncidentId(value);
                  }
                }}
                aria-invalid={Boolean(errors.incident)}
                aria-describedby={errors.incident ? "incident-error" : undefined}
              >
                <NativeSelectOption value="">{incidents.length ? disaster.incidentSelect : disaster.incidentNotListed}</NativeSelectOption>
                {incidents
                  .filter((incident) => incident.status === "active" || incident.status === "pending")
                  .map((incident) => (
                    <NativeSelectOption key={incident.id} value={incident.id}>
                      {language === "ne" && incident.nameNe ? incident.nameNe : incident.name}
                      {incident.status === "pending" ? ` (${disaster.incidentUnderReview})` : ""}
                    </NativeSelectOption>
                  ))}
                <NativeSelectOption value={NEW_INCIDENT_VALUE}>{disaster.incidentNotListed}</NativeSelectOption>
              </NativeSelect>
              <FieldError id="incident-error" error={errors.incident} />
            </div>
            {newIncidentMode ? (
              <div className="space-y-5 sm:col-span-2 rounded-lg border border-dashed p-4">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="new-incident-name"
                    label={`${disaster.newIncidentName} *`}
                    value={newIncidentName}
                    onChange={update("newIncidentName", setNewIncidentName)}
                    error={errors.newIncidentName}
                  />
                  <Field
                    id="new-incident-kind"
                    label={`${disaster.newIncidentKind} *`}
                    value={newIncidentKind}
                    onChange={update("newIncidentKind", setNewIncidentKind)}
                    error={errors.newIncidentKind}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="new-incident-district">{disaster.newIncidentDistrict} *</Label>
                    <NativeSelect
                      id="new-incident-district"
                      value={newIncidentDistrict}
                      onChange={(event) => {
                        setNewIncidentDistrict(event.target.value);
                        clearError("newIncidentDistrict");
                      }}
                      aria-invalid={Boolean(errors.newIncidentDistrict)}
                    >
                      <NativeSelectOption value="">{t.getHelpSelectDistrict}</NativeSelectOption>
                      {districtNames.map((item) => (
                        <NativeSelectOption key={item} value={item}>
                          {districtLabels[item][language]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldError id="new-incident-district-error" error={errors.newIncidentDistrict} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-incident-description">{disaster.newIncidentDescription} *</Label>
                  <Textarea
                    id="new-incident-description"
                    value={newIncidentDescription}
                    onChange={(event) => {
                      setNewIncidentDescription(event.target.value);
                      clearError("newIncidentDescription");
                    }}
                    rows={4}
                    placeholder={disaster.newIncidentDescriptionHint}
                    aria-invalid={Boolean(errors.newIncidentDescription)}
                  />
                  <FieldError id="new-incident-description-error" error={errors.newIncidentDescription} />
                </div>
              </div>
            ) : null}
            <Field
              id="ward"
              label={`${t.getHelpWard} *`}
              value={ward}
              onChange={update("ward", setWard)}
              error={errors.ward}
              type="number"
              inputMode="numeric"
              min={1}
              max={35}
            />
            <Field
              id="householdSize"
              label={t.getHelpHouseholdSize}
              value={householdSize}
              onChange={(event) => setHouseholdSize(event.target.value)}
              type="number"
              inputMode="numeric"
              min={1}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts.getHelpNeeded}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="category">{t.getHelpCategory} *</Label>
              <NativeSelect id="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                {CATEGORIES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {categoryLabel(item, language)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t.getHelpDescription} *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={update("description", setDescription)}
                rows={5}
                placeholder={t.getHelpDescriptionHint}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              <FieldError id="description-error" error={errors.description} />
              <p className="text-sm text-muted-foreground">{errors.description ? "" : t.getHelpDescriptionHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="need-media">
                {ts.getHelpMediaLabel} {newIncidentMode ? "*" : ""}
              </Label>
              <FileInput
                id="need-media"
                language={language}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                multiple
                onChange={handleMediaChange}
                disabled={submitting}
                aria-describedby={mediaError ? "need-media-hint need-media-error" : "need-media-hint"}
              />
              <p id="need-media-hint" className="text-sm text-muted-foreground">
                {ts.getHelpMediaHint}
              </p>
              {mediaError ? (
                <p id="need-media-error" className="text-sm text-destructive" role="alert">
                  {mediaError}
                </p>
              ) : null}
              <FieldError id="need-media-required-error" error={errors.media} />
              {Object.entries(uploadingFiles).map(([uploadId, fileName]) => (
                <p key={uploadId} className="text-sm text-muted-foreground" aria-live="polite">
                  {fileName} — {ts.getHelpMediaUploading}
                </p>
              ))}
              {mediaItems.length ? (
                <ul className="space-y-2" aria-label={ts.getHelpMediaLabel}>
                  {mediaItems.map((item) => (
                    <li key={item.fileId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{mediaNames[item.fileId] || item.fileId}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeMedia(item.fileId)}>
                        {ts.getHelpMediaRemove}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts.getHelpContactConsent}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {onBehalf ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="registrantName"
                    label={`${t.getHelpRegistrantName} *`}
                    value={registrantName}
                    onChange={update("registrantName", setRegistrantName)}
                    error={errors.registrantName}
                  />
                  <Field
                    id="registrantPhone"
                    label={`${t.getHelpRegistrantPhone} *`}
                    value={registrantPhone}
                    onChange={update("registrantPhone", setRegistrantPhone)}
                    error={errors.registrantPhone}
                    inputMode="tel"
                  />
                  <Field
                    id="registrantEmail"
                    label={t.getHelpRegistrantEmail}
                    value={registrantEmail}
                    onChange={update("registrantEmail", setRegistrantEmail)}
                    error={errors.registrantEmail}
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={consent}
                      onCheckedChange={(checked) => {
                        setConsent(checked === true);
                        clearError("consent");
                      }}
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? "consent-error" : undefined}
                    />
                    <Label htmlFor="consent" className="font-normal leading-relaxed">
                      {t.getHelpConsentLabel} *<span className="block text-sm text-muted-foreground">{t.getHelpConsentHint}</span>
                    </Label>
                  </div>
                  <FieldError id="consent-error" error={errors.consent} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.getHelpConsentHint}</p>
            )}
            {TURNSTILE_KEY ? (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">{t.getHelpTurnstileHint}</p>
                <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} />
              </div>
            ) : null}
            {errorCount ? (
              <Alert variant="destructive">
                <AlertDescription>{summary}</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" size="lg" disabled={submitting || Object.keys(uploadingFiles).length > 0} className="w-full">
              {submitting ? t.getHelpSubmitting : t.getHelpSubmit}
            </Button>
          </CardContent>
        </Card>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>{t.getHelpHowPrioritisedTitle}</CardTitle>
          <CardDescription>{t.getHelpHowPrioritisedLead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• {t.getHelpHowPrioritisedItem1}</p>
          <p>• {t.getHelpHowPrioritisedItem2}</p>
          <p>• {t.getHelpHowPrioritisedItem3}</p>
          <p className="text-muted-foreground">{t.getHelpHowPrioritisedFootnote}</p>
        </CardContent>
      </Card>
      <StatusLookup language={language} />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  inputMode,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11"
      />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}
function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

function SuccessScreen({
  language,
  success,
  resetForAnother,
}: {
  language: Language;
  success: { id: string; refCode: string };
  resetForAnother: () => void;
}) {
  const t = labels[language];
  const ts = formStrings[language];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={ts.mutualAidEyebrow} title={t.getHelpSuccessTitle} description={t.getHelpRefCodeHint} />
      <Card>
        <CardHeader className="text-center">
          <CardTitle>{t.getHelpSuccessTitle}</CardTitle>
          <CardDescription>{t.getHelpRefCodeHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 print:border-0 print:p-0">
          <CodeDisplay
            code={success.refCode}
            kind="ref"
            label={t.getHelpRefCodeLabel}
            hint={t.getHelpRefCodeHint}
            copyLabel={t.getHelpRefCodeCopy}
            copiedLabel={t.getHelpRefCodeCopied}
          />
          <SignInNudge
            language={language}
            id="get-help"
            title={meStrings[language].nudgeGetHelpTitle}
            body={meStrings[language].nudgeGetHelpBody}
          />
          <section>
            <h2 className="text-2xl font-bold tracking-tight">{t.getHelpWhatNextTitle}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed">
              {ts.getHelpWhatNextItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row print:hidden">
            <Button asChild variant="outline" className="flex-1">
              <a href="#status">
                <Search aria-hidden="true" />
                {t.getHelpCheckStatusTitle}
              </a>
            </Button>
            <Button type="button" variant="secondary" onClick={resetForAnother} className="flex-1">
              <Check aria-hidden="true" />
              {ts.registerAnother}
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href="/">
                <Home aria-hidden="true" />
                {ts.getHelpHome}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div id="status" className="print:hidden">
        <StatusLookup language={language} initialCode={success.refCode} />
      </div>
    </div>
  );
}

function StatusLookup({ language, initialCode = "" }: { language: Language; initialCode?: string }) {
  const t = labels[language];
  const ts = formStrings[language];
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewDone, setRenewDone] = useState(false);
  useEffect(() => {
    if (initialCode) setCode(initialCode);
  }, [initialCode]);
  const check = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setRenewDone(false);
    try {
      setResult(await getStatus(code.trim()));
    } catch (err) {
      setResult(null);
      setError((err as { status?: number }).status === 404 ? t.getHelpStatusUnknown : apiErrorMessage(err, language));
    } finally {
      setLoading(false);
    }
  };
  const renew = async () => {
    if (!code.trim()) return;
    setRenewing(true);
    setError(null);
    try {
      const response = await renewNeed(code.trim());
      setResult((current) => (current ? { ...current, expiresAt: response.expiresAt } : current));
      setRenewDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setRenewing(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.getHelpCheckStatusTitle}</CardTitle>
        <CardDescription>{t.getHelpCheckStatusHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`status-code-${initialCode || "standalone"}`}>{t.getHelpCheckStatusTitle}</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id={`status-code-${initialCode || "standalone"}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t.getHelpCheckStatusPlaceholder}
              className="min-h-11 font-mono"
            />
            <Button type="button" onClick={check} disabled={loading || !code.trim()}>
              {loading ? ts.checking : t.getHelpCheckStatusButton}
            </Button>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="space-y-3 text-sm" role="status">
            <p>
              <StatusBadge tone={toneForStatus(result.status)}>{statusLabel(result.status, language)}</StatusBadge> ·{" "}
              {categoryLabel(result.category, language)} ·{" "}
              {districtLabels[result.district as keyof typeof districtLabels]?.[language] ?? result.district}
            </p>
            {result.handledBy ? (
              <p>{(result.status === "fulfilled" ? formStrings[language].orgFulfilledBy : formStrings[language].orgHandledBy).replace("{org}", result.handledBy)}</p>
            ) : null}
            {result.claimCode && (result.status === "published" || result.status === "matched") ? (
              <CodeDisplay
                code={result.claimCode}
                kind="claim"
                label={t.getHelpClaimCodeLabel}
                hint={t.getHelpClaimCodeHint}
                copyLabel={t.getHelpRefCodeCopy}
                copiedLabel={t.getHelpRefCodeCopied}
              />
            ) : null}
            <p className="text-sm text-muted-foreground">
              {new Date(result.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")} →{" "}
              {new Date(result.expiresAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={renew} disabled={renewing}>
              {renewDone ? t.getHelpStatusRenewed : renewing ? ts.renewing : t.getHelpStatusRenew}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
