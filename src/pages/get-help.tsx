import { useEffect, useState } from "react";
import { CATEGORIES, type Category, createNeed, getStatus, renewNeed } from "../api";
import { apiErrorMessage } from "../api-error";
import { TurnstileWidget } from "../components/turnstile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { districtLabels, districtNames } from "../geo";
import { labels } from "../i18n";
import { formStrings } from "../i18n-forms";
import type { Language } from "../types";
import { Separator } from "@/components/ui/separator";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const DRAFT_KEY = "vn:need-draft";

type FieldKey = "beneficiaryName" | "district" | "ward" | "description" | "registrantName" | "registrantPhone" | "consent" | "registrantEmail" | "beneficiaryEmail" | "beneficiaryPhone";

function categoryLabel(cat: Category, lang: Language): string {
  const t = labels[lang];
  const map: Record<Category, string> = {
    goods: t.categoryGoods,
    shelter: t.categoryShelter,
    transport: t.categoryTransport,
    medical: t.categoryMedical,
    "skilled-labor": t.categorySkilledLabor,
    "funds-guidance": t.categoryFundsGuidance,
  };
  return map[cat] ?? cat;
}

function isValidPhone(phone: string): boolean {
  const stripped = phone.replace(/[\s-]/g, "");
  return /^[0-9]{7,15}$/.test(stripped);
}

function isValidEmail(email: string): boolean {
  return email.includes("@");
}

export function GetHelp({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];

  const [onBehalf, setOnBehalf] = useState<boolean>(false);
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
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [success, setSuccess] = useState<{ id: string; refCode: string } | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  const [statusCode, setStatusCode] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<{ status: string; category: string; district: string; createdAt: string; expiresAt: string; claimCode?: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewDone, setRenewDone] = useState(false);

  const [draftTime, setDraftTime] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.onBehalf === "boolean") setOnBehalf(d.onBehalf as boolean);
        if (typeof d.consent === "boolean") setConsent(d.consent as boolean);
        if (typeof d.registrantName === "string") setRegistrantName(d.registrantName);
        if (typeof d.registrantPhone === "string") setRegistrantPhone(d.registrantPhone);
        if (typeof d.registrantEmail === "string") setRegistrantEmail(d.registrantEmail);
        if (typeof d.beneficiaryName === "string") setBeneficiaryName(d.beneficiaryName);
        if (typeof d.beneficiaryPhone === "string") setBeneficiaryPhone(d.beneficiaryPhone);
        if (typeof d.beneficiaryEmail === "string") setBeneficiaryEmail(d.beneficiaryEmail);
        if (typeof d.district === "string") setDistrict(d.district);
        if (typeof d.ward === "string") setWard(d.ward);
        if (typeof d.householdSize === "string") setHouseholdSize(d.householdSize);
        if (typeof d.category === "string" && (CATEGORIES as string[]).includes(d.category)) setCategory(d.category as Category);
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.savedAt === "string") {
          try {
            setDraftTime(new Date(d.savedAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US"));
          } catch {
            setDraftTime(d.savedAt);
          }
        } else {
          setDraftTime(new Date().toLocaleString(language === "ne" ? "ne-NP" : "en-US"));
        }
      }
    } catch {
      // ignore
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
      savedAt: new Date().toISOString(),
    };
    const hasData = Boolean(
      registrantName || registrantPhone || registrantEmail || beneficiaryName || beneficiaryPhone || beneficiaryEmail || district || ward || householdSize || description
    );
    if (!hasData) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [onBehalf, consent, registrantName, registrantPhone, registrantEmail, beneficiaryName, beneficiaryPhone, beneficiaryEmail, district, ward, householdSize, category, description, success]);

  const clearFieldError = (key: FieldKey) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRegisterAnother = () => {
    setBeneficiaryName("");
    setBeneficiaryPhone("");
    setBeneficiaryEmail("");
    setDescription("");
    setHouseholdSize("");
    setError(null);
    setErrors({});
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextErrors: Partial<Record<FieldKey, string>> = {};

    if (!beneficiaryName.trim()) nextErrors.beneficiaryName = ts.validationBeneficiaryName;

    if (!district) nextErrors.district = ts.validationDistrict;

    const wardNum = Number(ward);
    if (!ward.trim() || Number.isNaN(wardNum) || wardNum < 1 || wardNum > 35) {
      nextErrors.ward = ts.validationWardRange;
    }

    if (!description.trim()) nextErrors.description = ts.validationDescription;

    if (onBehalf) {
      if (!registrantName.trim()) nextErrors.registrantName = ts.validationRegistrantName;
      if (!registrantPhone.trim()) nextErrors.registrantPhone = ts.validationRegistrantPhoneRequired;
      else if (!isValidPhone(registrantPhone.trim())) nextErrors.registrantPhone = ts.validationPhoneInvalid;
      if (!consent) nextErrors.consent = ts.validationConsent;
    }

    if (registrantEmail.trim() && !isValidEmail(registrantEmail.trim())) {
      nextErrors.registrantEmail = ts.validationEmailInvalid;
    }
    if (beneficiaryEmail.trim() && !isValidEmail(beneficiaryEmail.trim())) {
      nextErrors.beneficiaryEmail = ts.validationEmailInvalid;
    }
    if (beneficiaryPhone.trim() && !isValidPhone(beneficiaryPhone.trim())) {
      nextErrors.beneficiaryPhone = ts.validationPhoneInvalid;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const order: FieldKey[] = ["beneficiaryName", "district", "ward", "description", "registrantName", "registrantPhone", "consent", "registrantEmail", "beneficiaryEmail", "beneficiaryPhone"];
      const fieldIdMap: Record<FieldKey, string> = {
        beneficiaryName: "beneficiaryName",
        district: "district",
        ward: "ward",
        description: "description",
        registrantName: "registrantName",
        registrantPhone: "registrantPhone",
        consent: "consent",
        registrantEmail: "registrantEmail",
        beneficiaryEmail: "beneficiaryEmail",
        beneficiaryPhone: "beneficiaryPhone",
      };
      for (const k of order) {
        if (nextErrors[k]) {
          const el = document.getElementById(fieldIdMap[k]);
          if (el) {
            el.focus();
            break;
          }
        }
      }
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const body: Parameters<typeof createNeed>[0] = {
        onBehalf,
        registrant: onBehalf
          ? { name: registrantName.trim(), phone: registrantPhone.trim(), email: registrantEmail.trim() || undefined }
          : null,
        beneficiary: {
          name: beneficiaryName.trim(),
          phone: beneficiaryPhone.trim() || undefined,
          email: beneficiaryEmail.trim() || undefined,
          district,
          ward: wardNum,
          householdSize: householdSize ? Number(householdSize) : undefined,
        },
        category,
        description: description.trim(),
        language,
        turnstileToken: turnstileToken || undefined,
      };
      const res = await createNeed(body);
      setSuccess(res);
      setStatusCode(res.refCode);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      setDraftTime(null);
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-1">
        <Card className="border-ink">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">{t.getHelpSuccessTitle}</CardTitle>
            <CardDescription>{t.getHelpRefCodeHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center" role="status">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpRefCodeLabel}</p>
              <p className="mt-3 break-all font-mono text-3xl font-bold tracking-widest text-ink sm:text-4xl" aria-live="polite">
                {success.refCode}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 min-h-11"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(success.refCode);
                    setRefCopied(true);
                    setTimeout(() => setRefCopied(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
              >
                {refCopied ? t.getHelpRefCodeCopied : t.getHelpRefCodeCopy}
              </Button>
            </div>
            <Separator />
            <div>
              <h3 className="font-display text-lg font-semibold">{t.getHelpWhatNextTitle}</h3>
              <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">{t.getHelpWhatNextBody}</p>
            </div>
            <Separator />
            <StatusBox
              language={language}
              statusCode={statusCode}
              setStatusCode={setStatusCode}
              statusLoading={statusLoading}
              setStatusLoading={setStatusLoading}
              statusResult={statusResult}
              setStatusResult={setStatusResult}
              statusError={statusError}
              setStatusError={setStatusError}
              renewing={renewing}
              setRenewing={setRenewing}
              renewDone={renewDone}
              setRenewDone={setRenewDone}
              initialCode={success.refCode}
            />
            <div className="flex justify-center">
              <Button variant="outline" className="min-h-11" onClick={handleRegisterAnother}>
                {ts.registerAnother}
              </Button>
            </div>
          </CardContent>
        </Card>
        <StandaloneStatus language={language} />
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const summaryText = errorCount === 1 ? ts.validationSummaryOne : ts.validationSummary.replace("{n}", String(errorCount));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.getHelpTitle}</h1>
        <p className="mt-3 max-w-2xl font-serif leading-7 text-muted-foreground">{t.getHelpLead}</p>
      </header>

      {draftTime ? (
        <div className="flex flex-wrap items-center gap-2 border border-rule bg-card px-3 py-2 font-sans text-sm">
          <span>{ts.draftRestored.replace("{time}", draftTime)}</span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => {
              try {
                localStorage.removeItem(DRAFT_KEY);
              } catch {
                // ignore
              }
              setDraftTime(null);
            }}
          >
            {ts.discardDraft}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset>
              <legend className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpForWhom}</legend>
              <div className="mt-3 flex gap-3">
                <Button type="button" variant={onBehalf ? "outline" : "default"} onClick={() => setOnBehalf(false)} className="flex-1 min-h-11">
                  {t.getHelpForMyself}
                </Button>
                <Button type="button" variant={onBehalf ? "default" : "outline"} onClick={() => setOnBehalf(true)} className="flex-1 min-h-11">
                  {t.getHelpForSomeoneElse}
                </Button>
              </div>
            </fieldset>

            {onBehalf ? (
              <div className="space-y-4 border border-rule bg-card p-4">
                <h3 className="font-display text-base font-semibold">{t.getHelpRegistrantTitle}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="registrantName">{t.getHelpRegistrantName} *</Label>
                    <Input
                      id="registrantName"
                      value={registrantName}
                      onChange={(e) => {
                        setRegistrantName(e.target.value);
                        clearFieldError("registrantName");
                      }}
                      aria-invalid={Boolean(errors.registrantName)}
                      aria-describedby={errors.registrantName ? "registrantName-error" : undefined}
                      className="min-h-11"
                    />
                    {errors.registrantName ? <p id="registrantName-error" className="font-sans text-sm text-red">{errors.registrantName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrantPhone">{t.getHelpRegistrantPhone} *</Label>
                    <Input
                      id="registrantPhone"
                      value={registrantPhone}
                      onChange={(e) => {
                        setRegistrantPhone(e.target.value);
                        clearFieldError("registrantPhone");
                      }}
                      inputMode="tel"
                      aria-invalid={Boolean(errors.registrantPhone)}
                      aria-describedby={errors.registrantPhone ? "registrantPhone-error" : undefined}
                      className="min-h-11"
                    />
                    {errors.registrantPhone ? <p id="registrantPhone-error" className="font-sans text-sm text-red">{errors.registrantPhone}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrantEmail">{t.getHelpRegistrantEmail}</Label>
                    <Input
                      id="registrantEmail"
                      value={registrantEmail}
                      onChange={(e) => {
                        setRegistrantEmail(e.target.value);
                        clearFieldError("registrantEmail");
                      }}
                      type="email"
                      aria-invalid={Boolean(errors.registrantEmail)}
                      aria-describedby={errors.registrantEmail ? "registrantEmail-error" : undefined}
                      className="min-h-11"
                    />
                    {errors.registrantEmail ? <p id="registrantEmail-error" className="font-sans text-sm text-red">{errors.registrantEmail}</p> : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 font-sans text-sm">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        clearFieldError("consent");
                      }}
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={errors.consent ? "consent-error" : undefined}
                      className="mt-1 accent-ink"
                    />
                    <span>
                      {t.getHelpConsentLabel} *
                      <span className="block text-xs text-muted-foreground">{t.getHelpConsentHint}</span>
                    </span>
                  </label>
                  {errors.consent ? <p id="consent-error" className="font-sans text-sm text-red">{errors.consent}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              <h3 className="font-display text-base font-semibold">{t.getHelpBeneficiaryTitle}</h3>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">{t.getHelpBeneficiaryName} *</Label>
                <Input
                  id="beneficiaryName"
                  value={beneficiaryName}
                  onChange={(e) => {
                    setBeneficiaryName(e.target.value);
                    clearFieldError("beneficiaryName");
                  }}
                  aria-invalid={Boolean(errors.beneficiaryName)}
                  aria-describedby={errors.beneficiaryName ? "beneficiaryName-error" : undefined}
                  className="min-h-11"
                />
                {errors.beneficiaryName ? <p id="beneficiaryName-error" className="font-sans text-sm text-red">{errors.beneficiaryName}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryPhone">{t.getHelpBeneficiaryPhone}</Label>
                <Input
                  id="beneficiaryPhone"
                  value={beneficiaryPhone}
                  onChange={(e) => {
                    setBeneficiaryPhone(e.target.value);
                    clearFieldError("beneficiaryPhone");
                  }}
                  inputMode="tel"
                  aria-invalid={Boolean(errors.beneficiaryPhone)}
                  aria-describedby={errors.beneficiaryPhone ? "beneficiaryPhone-error" : undefined}
                  className="min-h-11"
                />
                {errors.beneficiaryPhone ? <p id="beneficiaryPhone-error" className="font-sans text-sm text-red">{errors.beneficiaryPhone}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryEmail">{t.getHelpBeneficiaryEmail}</Label>
                <Input
                  id="beneficiaryEmail"
                  value={beneficiaryEmail}
                  onChange={(e) => {
                    setBeneficiaryEmail(e.target.value);
                    clearFieldError("beneficiaryEmail");
                  }}
                  type="email"
                  aria-invalid={Boolean(errors.beneficiaryEmail)}
                  aria-describedby={errors.beneficiaryEmail ? "beneficiaryEmail-error" : undefined}
                  className="min-h-11"
                />
                {errors.beneficiaryEmail ? <p id="beneficiaryEmail-error" className="font-sans text-sm text-red">{errors.beneficiaryEmail}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="district">{t.getHelpDistrict} *</Label>
                  <Select
                    id="district"
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      clearFieldError("district");
                    }}
                    aria-invalid={Boolean(errors.district)}
                    aria-describedby={errors.district ? "district-error" : undefined}
                    className="min-h-11"
                  >
                    <option value="">{t.getHelpSelectDistrict}</option>
                    {districtNames.map((d) => (
                      <SelectItem key={d} value={d}>
                        {districtLabels[d][language]}
                      </SelectItem>
                    ))}
                  </Select>
                  {errors.district ? <p id="district-error" className="font-sans text-sm text-red">{errors.district}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ward">{t.getHelpWard} *</Label>
                  <Input
                    id="ward"
                    value={ward}
                    onChange={(e) => {
                      setWard(e.target.value);
                      clearFieldError("ward");
                    }}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={35}
                    aria-invalid={Boolean(errors.ward)}
                    aria-describedby={errors.ward ? "ward-error" : undefined}
                    className="min-h-11"
                  />
                  {errors.ward ? <p id="ward-error" className="font-sans text-sm text-red">{errors.ward}</p> : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="householdSize">{t.getHelpHouseholdSize}</Label>
                <Input id="householdSize" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} inputMode="numeric" type="number" min={1} className="min-h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t.getHelpCategory} *</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="min-h-11">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c, language)}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.getHelpDescription} *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldError("description");
                }}
                rows={4}
                placeholder={t.getHelpDescriptionHint}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "description-error" : undefined}
                className="min-h-11"
              />
              {errors.description ? <p id="description-error" className="font-sans text-sm text-red">{errors.description}</p> : <p className="font-sans text-xs text-muted-foreground">{t.getHelpDescriptionHint}</p>}
            </div>

            {TURNSTILE_KEY ? (
              <div>
                <p className="font-sans text-xs text-muted-foreground">{t.getHelpTurnstileHint}</p>
                <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} />
              </div>
            ) : null}

            {errorCount > 0 ? (
              <p className="border border-red bg-paper px-3 py-2 font-sans text-sm text-red" role="alert">
                {summaryText}
              </p>
            ) : null}

            {error ? (
              <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full min-h-11">
              {submitting ? t.getHelpSubmitting : t.getHelpSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.getHelpHowPrioritisedTitle}</CardTitle>
          <CardDescription>{t.getHelpHowPrioritisedLead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-sans text-sm">
          <p>• {t.getHelpHowPrioritisedItem1}</p>
          <p>• {t.getHelpHowPrioritisedItem2}</p>
          <p>• {t.getHelpHowPrioritisedItem3}</p>
          <p className="text-xs text-muted-foreground">{t.getHelpHowPrioritisedFootnote}</p>
        </CardContent>
      </Card>

      <StandaloneStatus language={language} />
    </div>
  );
}

function StatusBox({
  language,
  statusCode,
  setStatusCode,
  statusLoading,
  setStatusLoading,
  statusResult,
  setStatusResult,
  statusError,
  setStatusError,
  renewing,
  setRenewing,
  renewDone,
  setRenewDone,
  initialCode,
}: {
  language: Language;
  statusCode: string;
  setStatusCode: (v: string) => void;
  statusLoading: boolean;
  setStatusLoading: (v: boolean) => void;
  statusResult: { status: string; category: string; district: string; createdAt: string; expiresAt: string; claimCode?: string } | null;
  setStatusResult: React.Dispatch<React.SetStateAction<{ status: string; category: string; district: string; createdAt: string; expiresAt: string; claimCode?: string } | null>>;
  statusError: string | null;
  setStatusError: (v: string | null) => void;
  renewing: boolean;
  setRenewing: (v: boolean) => void;
  renewDone: boolean;
  setRenewDone: (v: boolean) => void;
  initialCode?: string;
}) {
  const t = labels[language];
  useEffect(() => {
    if (initialCode && !statusCode) setStatusCode(initialCode);
  }, [initialCode, statusCode, setStatusCode]);

  const doCheck = async () => {
    if (!statusCode.trim()) return;
    setStatusLoading(true);
    setStatusError(null);
    setRenewDone(false);
    try {
      const res = await getStatus(statusCode.trim());
      setStatusResult(res);
    } catch (err) {
      const apiErr = err as unknown as { status?: number };
      if ((apiErr as { status?: number }).status === 404) setStatusError(t.getHelpStatusUnknown);
      else setStatusError(apiErrorMessage(err, language));
      setStatusResult(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const doRenew = async () => {
    if (!statusCode.trim()) return;
    setRenewing(true);
    try {
      const res = await renewNeed(statusCode.trim());
      setStatusResult((prev: { status: string; category: string; district: string; createdAt: string; expiresAt: string } | null) => (prev ? { ...prev, expiresAt: res.expiresAt } : prev));
      setRenewDone(true);
    } catch (err) {
      setStatusError(apiErrorMessage(err, language));
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div className="border border-rule bg-card p-4">
      <h3 className="font-display text-base font-semibold">{t.getHelpCheckStatusTitle}</h3>
      <p className="mt-1 font-sans text-xs text-muted-foreground">{t.getHelpCheckStatusHint}</p>
      <div className="mt-3 flex gap-2">
        <Input
          value={statusCode}
          onChange={(e) => setStatusCode(e.target.value)}
          placeholder={t.getHelpCheckStatusPlaceholder}
          className="font-mono min-h-11"
        />
        <Button type="button" onClick={doCheck} disabled={statusLoading || !statusCode.trim()} className="min-h-11">
          {statusLoading ? "…" : t.getHelpCheckStatusButton}
        </Button>
      </div>
      {statusError ? (
        <p className="mt-2 font-sans text-sm text-destructive" role="alert">
          {statusError}
        </p>
      ) : null}
      {statusResult ? (
        <div className="mt-3 space-y-3 font-sans text-sm" role="status">
          <p>
            <span className="font-semibold">{statusResult.status}</span> · {statusResult.category} · {statusResult.district}
          </p>
          {statusResult.claimCode && (statusResult.status === "published" || statusResult.status === "matched") ? (
            <div className="border border-ink bg-paper p-3 text-center">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpClaimCodeLabel}</p>
              <p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest text-ink" aria-live="polite">{statusResult.claimCode}</p>
              <p className="mt-1 font-sans text-xs text-muted-foreground">{t.getHelpClaimCodeHint}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {new Date(statusResult.createdAt).toLocaleString()} → {new Date(statusResult.expiresAt).toLocaleString()}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={doRenew} disabled={renewing} className="min-h-11">
            {renewDone ? t.getHelpStatusRenewed : renewing ? "…" : t.getHelpStatusRenew}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StandaloneStatus({ language }: { language: Language }) {
  const t = labels[language];
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; category: string; district: string; createdAt: string; expiresAt: string; claimCode?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewDone, setRenewDone] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.getHelpCheckStatusTitle}</CardTitle>
        <CardDescription>{t.getHelpCheckStatusHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.getHelpCheckStatusPlaceholder} className="font-mono min-h-11" />
          <Button
            type="button"
            onClick={async () => {
              if (!code.trim()) return;
              setLoading(true);
              setError(null);
              setRenewDone(false);
              try {
                const res = await getStatus(code.trim());
                setResult(res);
              } catch (err) {
                const apiErr = err as unknown as { status?: number };
                if ((apiErr as { status?: number }).status === 404) setError(t.getHelpStatusUnknown);
                else setError(apiErrorMessage(err, language));
                setResult(null);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !code.trim()}
            className="min-h-11"
          >
            {loading ? "…" : t.getHelpCheckStatusButton}
          </Button>
        </div>
        {error ? (
          <p className="font-sans text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="space-y-3 font-sans text-sm" role="status">
            <p>
              <span className="font-semibold">{result.status}</span> · {result.category} · {result.district}
            </p>
            {result.claimCode && (result.status === "published" || result.status === "matched") ? (
              <div className="border border-ink bg-paper p-3 text-center">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpClaimCodeLabel}</p>
                <p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest text-ink" aria-live="polite">{result.claimCode}</p>
                <p className="mt-1 font-sans text-xs text-muted-foreground">{t.getHelpClaimCodeHint}</p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {new Date(result.createdAt).toLocaleString()} → {new Date(result.expiresAt).toLocaleString()}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                setRenewing(true);
                try {
                  const res = await renewNeed(code.trim());
                  setResult((prev) => (prev ? { ...(prev as NonNullable<typeof result>), expiresAt: res.expiresAt } : prev));
                  setRenewDone(true);
                } catch (e) {
                  setError(apiErrorMessage(e, language));
                } finally {
                  setRenewing(false);
                }
              }}
              disabled={renewing}
              className="min-h-11"
            >
              {renewDone ? t.getHelpStatusRenewed : renewing ? "…" : t.getHelpStatusRenew}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
