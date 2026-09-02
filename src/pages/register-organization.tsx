import { useEffect, useState } from "react";
import { createOrg, listMyOrgs, ORG_TYPES, type OrgType } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { districtLabels, districtNames } from "@/lib/geo";
import { orgStrings } from "@/i18n/orgs";
import type { Language, Page } from "@/lib/types";
import { Rule, SectionLabel, SquareButton } from "@/components/legacy";

const DRAFT_KEY = "vn:org-draft";

type FieldKey = "name" | "orgType" | "registrationNumber" | "contactName" | "contactPhone" | "contactEmail" | "districts" | "description" | "website";

function isValidPhone(phone: string): boolean {
  const stripped = phone.replace(/[\s-]/g, "");
  return /^[0-9]{7,15}$/.test(stripped);
}

function isValidEmail(email: string): boolean {
  return email.includes("@");
}

export function RegisterOrganization({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = orgStrings[language];
  const auth = useGoogleAuth();

  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrgType | "">("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [hasOrgs, setHasOrgs] = useState(false);

  useEffect(() => {
    if (!auth.idToken) return;
    // ponytail: banner only — a fetch failure just hides it, registration still works
    listMyOrgs(auth.idToken)
      .then((res) => setHasOrgs(res.items.length > 0))
      .catch(() => {});
  }, [auth.idToken]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.orgType === "string" && (ORG_TYPES as string[]).includes(d.orgType)) setOrgType(d.orgType as OrgType);
        if (typeof d.registrationNumber === "string") setRegistrationNumber(d.registrationNumber);
        if (typeof d.contactName === "string") setContactName(d.contactName);
        if (typeof d.contactPhone === "string") setContactPhone(d.contactPhone);
        if (typeof d.contactEmail === "string") setContactEmail(d.contactEmail);
        if (Array.isArray(d.districts)) setDistricts((d.districts as unknown[]).filter((x): x is string => typeof x === "string" && districtNames.includes(x as never)));
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.website === "string") setWebsite(d.website);
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
    } catch {}
  }, [language]);

  useEffect(() => {
    if (auth.profile?.email && !contactEmail) {
      setContactEmail(auth.profile.email);
    }
  }, [auth.profile?.email, contactEmail]);

  useEffect(() => {
    if (!auth.idToken) return;
    const hasData = Boolean(name || orgType || registrationNumber || contactName || contactPhone || contactEmail || districts.length || description || website);
    if (!hasData) return;
    try {
      const payload = { name, orgType, registrationNumber, contactName, contactPhone, contactEmail, districts, description, website, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {}
  }, [name, orgType, registrationNumber, contactName, contactPhone, contactEmail, districts, description, website, auth.idToken]);

  const clearFieldError = (key: FieldKey) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleDistrict = (d: string) => {
    setDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
    clearFieldError("districts");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 150) nextErrors.name = t.validationName;
    if (!orgType || !(ORG_TYPES as string[]).includes(orgType)) nextErrors.orgType = t.validationOrgType;
    if (registrationNumber.trim().length > 100) nextErrors.registrationNumber = t.validationRegistrationNumber;
    const trimmedContactName = contactName.trim();
    if (trimmedContactName.length < 1 || trimmedContactName.length > 100) nextErrors.contactName = t.validationContactName;
    const trimmedPhone = contactPhone.trim();
    if (!trimmedPhone || !isValidPhone(trimmedPhone)) nextErrors.contactPhone = t.validationContactPhone;
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) nextErrors.contactEmail = t.validationContactEmail;
    if (districts.length === 0 || districts.length > 10) nextErrors.districts = t.validationDistricts;
    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) nextErrors.description = t.validationDescription;
    if (website.trim().length > 200) nextErrors.website = t.validationWebsite;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const order: FieldKey[] = ["name", "orgType", "registrationNumber", "contactName", "contactPhone", "contactEmail", "districts", "description", "website"];
      for (const k of order) {
        if (nextErrors[k]) {
          const el = document.getElementById(k === "districts" ? "districts-group" : k);
          if (el) {
            el.focus();
            break;
          }
        }
      }
      return;
    }
    setErrors({});
    if (!auth.idToken) {
      setApiError(apiErrorMessage(new Error("no token"), language));
      return;
    }
    setSubmitting(true);
    try {
      await createOrg(auth.idToken, {
        name: trimmedName,
        orgType: orgType as OrgType,
        registrationNumber: registrationNumber.trim() || undefined,
        contactName: trimmedContactName,
        contactPhone: trimmedPhone,
        contactEmail: trimmedEmail || undefined,
        districts,
        description: trimmedDesc,
        website: website.trim() || undefined,
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setDraftTime(null);
      navigate("org");
    } catch (err) {
      setApiError(apiErrorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  };

  const whatNextBox = (
    <div className="border border-rule bg-card p-4">
      <h3 className="font-display text-base font-semibold">{t.registerOrgWhatNextTitle}</h3>
      <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground-foreground">{t.registerOrgWhatNextBody}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-sm text-muted-foreground-foreground">
        <li>{t.registerOrgWhatNextProvisional}</li>
        <li>{t.registerOrgWhatNextKnown}</li>
        <li>{t.registerOrgWhatNextVouched}</li>
        <li>{t.registerOrgWhatNextSelfDeclared}</li>
      </ul>
    </div>
  );

  if (!auth.idToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <SectionLabel>{t.registerOrgTitle}</SectionLabel>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.registerOrgTitle}</h1>
          <p className="mt-3 font-serif leading-7 text-muted-foreground-foreground">{t.registerOrgLead}</p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-base">{t.registerOrgGateTitle}</CardTitle>
            <CardDescription className="font-sans text-sm leading-6">{t.registerOrgGateBody}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {auth.clientId ? (
              <SquareButton onClick={auth.signIn} tone="primary" className="min-h-11 w-full max-w-[280px]">
                {t.registerOrgGateSignIn}
              </SquareButton>
            ) : (
              <p className="font-sans text-sm text-muted-foreground-foreground">{t.registerOrgGateBody}</p>
            )}
            {auth.error ? (
              <p className="font-sans text-sm text-destructive" role="alert">
                {apiErrorMessage(new Error(auth.error), language)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {whatNextBox}
        <Rule />
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const summaryText = errorCount === 1 ? t.validationSummaryOne : t.validationSummary.replace("{n}", String(errorCount));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <SectionLabel>{t.registerOrgTitle}</SectionLabel>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">{t.registerOrgTitle}</h1>
        <p className="mt-3 font-serif leading-7 text-muted-foreground-foreground">{t.registerOrgLead}</p>
      </header>

      {hasOrgs ? (
        <div className="flex flex-wrap items-center gap-3 border border-rule bg-card px-3 py-2 font-sans text-sm" role="status">
          <span>{t.registerOrgExistingNotice}</span>
          <SquareButton onClick={() => navigate("org")}>{t.navMyOrg}</SquareButton>
        </div>
      ) : null}

      {draftTime ? (
        <div className="flex flex-wrap items-center gap-2 border border-rule bg-card px-3 py-2 font-sans text-sm">
          <span>{t.draftRestored.replace("{time}", draftTime)}</span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => {
              try {
                localStorage.removeItem(DRAFT_KEY);
              } catch {}
              setDraftTime(null);
            }}
          >
            {t.discardDraft}
          </Button>
        </div>
      ) : null}

      {errorCount > 0 ? (
        <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
          {summaryText}
        </p>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">{t.registerOrgNameLabel} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError("name");
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
                className="min-h-11"
                required
              />
              {errors.name ? (
                <p id="name-error" className="font-sans text-sm text-destructive" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">{t.registerOrgOrgTypeLabel} *</Label>
              <NativeSelect
                id="orgType"
                value={orgType}
                onChange={(e) => {
                  setOrgType(e.target.value as OrgType);
                  clearFieldError("orgType");
                }}
                aria-invalid={Boolean(errors.orgType)}
                className="min-h-11"
                required
              >
                <option value="">{t.registerOrgSelectType}</option>
                {ORG_TYPES.map((ot) => (
                  <NativeSelectOption key={ot} value={ot}>
                    {t[`orgType_${ot}` as keyof typeof t] ?? ot}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.orgType ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {errors.orgType}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationNumber">{t.registerOrgRegistrationNumberLabel}</Label>
              <Input
                id="registrationNumber"
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value);
                  clearFieldError("registrationNumber");
                }}
                aria-invalid={Boolean(errors.registrationNumber)}
                className="min-h-11"
                maxLength={100}
              />
              {errors.registrationNumber ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {errors.registrationNumber}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactName">{t.registerOrgContactNameLabel} *</Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    clearFieldError("contactName");
                  }}
                  aria-invalid={Boolean(errors.contactName)}
                  className="min-h-11"
                  required
                />
                {errors.contactName ? (
                  <p className="font-sans text-sm text-destructive" role="alert">
                    {errors.contactName}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">{t.registerOrgContactPhoneLabel} *</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    clearFieldError("contactPhone");
                  }}
                  inputMode="tel"
                  aria-invalid={Boolean(errors.contactPhone)}
                  className="min-h-11"
                  required
                />
                {errors.contactPhone ? (
                  <p className="font-sans text-sm text-destructive" role="alert">
                    {errors.contactPhone}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t.registerOrgContactEmailLabel}</Label>
              <Input
                id="contactEmail"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearFieldError("contactEmail");
                }}
                type="email"
                aria-invalid={Boolean(errors.contactEmail)}
                className="min-h-11"
              />
              {errors.contactEmail ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {errors.contactEmail}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <fieldset>
                <legend className="font-sans text-sm font-medium">{t.registerOrgDistrictsLabel} *</legend>
                <div id="districts-group" tabIndex={-1} className="mt-2 flex flex-wrap gap-2">
                  {districtNames.map((d) => (
                    <label
                      key={d}
                      className={`cursor-pointer border px-3 py-2 font-sans text-xs ${districts.includes(d) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}
                    >
                      <input type="checkbox" className="sr-only" checked={districts.includes(d)} onChange={() => toggleDistrict(d)} />
                      {districtLabels[d][language]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {errors.districts ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {errors.districts}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.registerOrgDescriptionLabel} *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldError("description");
                }}
                rows={4}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "description-error" : undefined}
                placeholder={t.registerOrgDescriptionHint}
                required
              />
              <p className="font-sans text-xs text-muted-foreground-foreground">{t.registerOrgDescriptionHint}</p>
              {errors.description ? (
                <p id="description-error" className="font-sans text-sm text-destructive" role="alert">
                  {errors.description}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">{t.registerOrgWebsiteLabel}</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  clearFieldError("website");
                }}
                placeholder={t.registerOrgWebsiteHint}
                aria-invalid={Boolean(errors.website)}
                className="min-h-11"
                maxLength={200}
              />
              {errors.website ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {errors.website}
                </p>
              ) : null}
            </div>

            {apiError ? (
              <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                {apiError}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full min-h-11">
              {submitting ? t.registerOrgSubmitting : t.registerOrgSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>

      {whatNextBox}
    </div>
  );
}
