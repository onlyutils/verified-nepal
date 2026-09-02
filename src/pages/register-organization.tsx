import { useEffect, useState } from "react";
import { createOrg, listMyOrgs, ORG_TYPES, type OrgType } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { orgStrings } from "@/i18n/orgs";
import { communityStrings } from "@/i18n/community";
import { districtLabels, districtNames } from "@/lib/geo";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fillTemplate } from "@/lib/edition";

const DRAFT_KEY = "vn:org-draft";
type FieldKey =
  "name" | "orgType" | "registrationNumber" | "contactName" | "contactPhone" | "contactEmail" | "districts" | "description" | "website";
const phoneIsValid = (value: string) => /^[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ""));

export function RegisterOrganization({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = orgStrings[language];
  const c = communityStrings[language];
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
    if (auth.idToken)
      void listMyOrgs(auth.idToken)
        .then((response) => setHasOrgs(response.items.length > 0))
        .catch(() => {});
  }, [auth.idToken]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.name === "string") setName(draft.name);
      if (typeof draft.orgType === "string" && ORG_TYPES.includes(draft.orgType as OrgType)) setOrgType(draft.orgType as OrgType);
      if (typeof draft.registrationNumber === "string") setRegistrationNumber(draft.registrationNumber);
      if (typeof draft.contactName === "string") setContactName(draft.contactName);
      if (typeof draft.contactPhone === "string") setContactPhone(draft.contactPhone);
      if (typeof draft.contactEmail === "string") setContactEmail(draft.contactEmail);
      if (Array.isArray(draft.districts))
        setDistricts(
          draft.districts.filter(
            (value): value is string => typeof value === "string" && (districtNames as readonly string[]).includes(value),
          ),
        );
      if (typeof draft.description === "string") setDescription(draft.description);
      if (typeof draft.website === "string") setWebsite(draft.website);
      setDraftTime(
        typeof draft.savedAt === "string"
          ? new Date(draft.savedAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")
          : new Date().toLocaleString(language === "ne" ? "ne-NP" : "en-US"),
      );
    } catch {
      /* ignore malformed drafts */
    }
  }, [language]);
  useEffect(() => {
    if (auth.profile?.email && !contactEmail) setContactEmail(auth.profile.email);
  }, [auth.profile?.email, contactEmail]);
  useEffect(() => {
    if (
      !auth.idToken ||
      ![name, orgType, registrationNumber, contactName, contactPhone, contactEmail, districts.length, description, website].some(Boolean)
    )
      return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          name,
          orgType,
          registrationNumber,
          contactName,
          contactPhone,
          contactEmail,
          districts,
          description,
          website,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* storage may be unavailable */
    }
  }, [auth.idToken, name, orgType, registrationNumber, contactName, contactPhone, contactEmail, districts, description, website]);
  const clearError = (key: FieldKey) =>
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setApiError(null);
    const next: Partial<Record<FieldKey, string>> = {};
    const values = {
      name: name.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim(),
      description: description.trim(),
      website: website.trim(),
      registrationNumber: registrationNumber.trim(),
    };
    if (values.name.length < 2 || values.name.length > 150) next.name = t.validationName;
    if (!orgType) next.orgType = t.validationOrgType;
    if (values.registrationNumber.length > 100) next.registrationNumber = t.validationRegistrationNumber;
    if (!values.contactName || values.contactName.length > 100) next.contactName = t.validationContactName;
    if (!phoneIsValid(values.contactPhone)) next.contactPhone = t.validationContactPhone;
    if (values.contactEmail && !values.contactEmail.includes("@")) next.contactEmail = t.validationContactEmail;
    if (!districts.length || districts.length > 10) next.districts = t.validationDistricts;
    if (values.description.length < 10 || values.description.length > 2000) next.description = t.validationDescription;
    if (values.website.length > 200) next.website = t.validationWebsite;
    if (Object.keys(next).length) {
      setErrors(next);
      const first = (
        [
          "name",
          "orgType",
          "registrationNumber",
          "contactName",
          "contactPhone",
          "contactEmail",
          "districts",
          "description",
          "website",
        ] as FieldKey[]
      ).find((key) => next[key]);
      document.getElementById(first === "districts" ? "org-districts" : first || "name")?.focus();
      return;
    }
    setErrors({});
    if (!auth.idToken) {
      setApiError(t.registerOrgGateBody);
      return;
    }
    setSubmitting(true);
    try {
      await createOrg(auth.idToken, {
        name: values.name,
        orgType: orgType as OrgType,
        registrationNumber: values.registrationNumber || undefined,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
        contactEmail: values.contactEmail || undefined,
        districts,
        description: values.description,
        website: values.website || undefined,
      });
      localStorage.removeItem(DRAFT_KEY);
      navigate("org");
    } catch (cause) {
      setApiError(apiErrorMessage(cause, language));
    } finally {
      setSubmitting(false);
    }
  };
  const whatNext = (
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle className="text-lg">{t.registerOrgWhatNextTitle}</CardTitle>
        <CardDescription>{t.registerOrgWhatNextBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t.registerOrgWhatNextProvisional}</li>
          <li>{t.registerOrgWhatNextKnown}</li>
          <li>{t.registerOrgWhatNextVouched}</li>
          <li>{t.registerOrgWhatNextSelfDeclared}</li>
        </ul>
      </CardContent>
    </Card>
  );
  if (!auth.idToken)
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader eyebrow={c.organizationsEyebrow} title={t.registerOrgTitle} description={t.registerOrgLead} />
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">{t.registerOrgGateTitle}</CardTitle>
            <CardDescription>{t.registerOrgGateBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.clientId ? (
              <Button size="lg" onClick={() => void auth.signIn()} className="w-full">
                {t.registerOrgGateSignIn}
              </Button>
            ) : null}
            {auth.error ? (
              <Alert variant="destructive">
                <AlertDescription>{apiErrorMessage(new Error(auth.error), language)}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
        {whatNext}
      </div>
    );
  const errorCount = Object.keys(errors).length;
  const textField = (key: FieldKey, id: string, label: string, control: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {errors[key] ? (
        <p className="text-sm text-destructive" role="alert">
          {errors[key]}
        </p>
      ) : null}
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={c.organizationsEyebrow} title={t.registerOrgTitle} description={t.registerOrgLead} />
      {hasOrgs ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t.registerOrgExistingNotice}</span>
            <Button variant="link" className="h-auto p-0" onClick={() => navigate("org")}>
              {t.navMyOrg}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {draftTime ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{fillTemplate(t.draftRestored, { time: draftTime })}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                setDraftTime(null);
              }}
            >
              {t.discardDraft}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {errorCount ? (
        <Alert variant="destructive">
          <AlertDescription>
            {fillTemplate(errorCount === 1 ? t.validationSummaryOne : t.validationSummary, { n: String(errorCount) })}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5" noValidate>
            {textField(
              "name",
              "org-name",
              `${t.registerOrgNameLabel} *`,
              <Input
                id="org-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                maxLength={150}
                required
              />,
            )}
            {textField(
              "orgType",
              "org-type",
              `${t.registerOrgOrgTypeLabel} *`,
              <NativeSelect
                id="org-type"
                value={orgType}
                onChange={(e) => {
                  setOrgType(e.target.value as OrgType);
                  clearError("orgType");
                }}
                required
              >
                <NativeSelectOption value="">{t.registerOrgSelectType}</NativeSelectOption>
                {ORG_TYPES.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {t[`orgType_${value}` as keyof typeof t]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>,
            )}
            {textField(
              "registrationNumber",
              "org-registration",
              t.registerOrgRegistrationNumberLabel,
              <Input
                id="org-registration"
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value);
                  clearError("registrationNumber");
                }}
                maxLength={100}
              />,
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {textField(
                "contactName",
                "org-contact",
                `${t.registerOrgContactNameLabel} *`,
                <Input
                  id="org-contact"
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    clearError("contactName");
                  }}
                  required
                />,
              )}
              {textField(
                "contactPhone",
                "org-phone",
                `${t.registerOrgContactPhoneLabel} *`,
                <Input
                  id="org-phone"
                  value={contactPhone}
                  onChange={(e) => {
                    setContactPhone(e.target.value);
                    clearError("contactPhone");
                  }}
                  inputMode="tel"
                  required
                />,
              )}
            </div>
            {textField(
              "contactEmail",
              "org-email",
              t.registerOrgContactEmailLabel,
              <Input
                id="org-email"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearError("contactEmail");
                }}
              />,
            )}
            <fieldset id="org-districts" tabIndex={-1} className="space-y-3">
              <legend className="text-sm font-medium">{t.registerOrgDistrictsLabel} *</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {districtNames.map((district) => (
                  <Label key={district} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3">
                    <Checkbox
                      checked={districts.includes(district)}
                      onCheckedChange={(checked) => {
                        setDistricts((current) => (checked ? [...current, district] : current.filter((value) => value !== district)));
                        clearError("districts");
                      }}
                    />
                    {districtLabels[district][language]}
                  </Label>
                ))}
              </div>
              {errors.districts ? (
                <p className="text-sm text-destructive" role="alert">
                  {errors.districts}
                </p>
              ) : null}
            </fieldset>
            {textField(
              "description",
              "org-description",
              `${t.registerOrgDescriptionLabel} *`,
              <>
                <Textarea
                  id="org-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    clearError("description");
                  }}
                  maxLength={2000}
                  rows={6}
                  required
                />
                <p className="text-sm text-muted-foreground">{t.registerOrgDescriptionHint}</p>
              </>,
            )}
            {textField(
              "website",
              "org-website",
              t.registerOrgWebsiteLabel,
              <Input
                id="org-website"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  clearError("website");
                }}
                maxLength={200}
                placeholder={t.registerOrgWebsiteHint}
              />,
            )}
            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? t.registerOrgSubmitting : t.registerOrgSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>
      {whatNext}
    </div>
  );
}
