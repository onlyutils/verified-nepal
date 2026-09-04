import { useEffect, useState } from "react";
import { ApiError, createProject, PROJECT_TYPES, type ProjectType } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { disasterStrings } from "@/i18n/disasters";
import { districtLabels, districtNames } from "@/lib/geo";
import { useIncidents } from "@/lib/incidents";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { CodeDisplay } from "@/components/code-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TurnstileWidget } from "@/components/turnstile";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

function typeLabel(type: ProjectType, language: Language) {
  const t = communityStrings[language];
  return (
    {
      tuin: t.projectTypeTuin,
      bridge: t.projectTypeBridge,
      trail: t.projectTypeTrail,
      water: t.projectTypeWater,
      school: t.projectTypeSchool,
      other: t.projectTypeOther,
    }[type] ?? t.projectTypeOther
  );
}

export function ProjectRegister({ language }: { language: Language }) {
  const t = communityStrings[language];
  const disaster = disasterStrings[language];
  const { incidents, currentIncidentId, setCurrentIncidentId } = useIncidents();
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const [titleEn, setTitleEn] = useState("");
  const [titleNe, setTitleNe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descNe, setDescNe] = useState("");
  const [type, setType] = useState<ProjectType>("tuin");
  const [district, setDistrict] = useState<string>(districtNames[0] ?? "Rasuwa");
  const [incidentId, setIncidentId] = useState("");
  const [ward, setWard] = useState("1");
  const [locationText, setLocationText] = useState("");
  const [cost, setCost] = useState("");
  const [committeeName, setCommitteeName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [committeeEmail, setCommitteeEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [esewaId, setEsewaId] = useState("");
  const [khaltiId, setKhaltiId] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; updateCode: string } | null>(null);

  useEffect(() => {
    if (incidentId && activeIncidents.some((incident) => incident.id === incidentId)) return;
    const next = activeIncidents.find((incident) => incident.id === currentIncidentId)?.id ?? activeIncidents[0]?.id ?? "";
    setIncidentId(next);
  }, [activeIncidents, currentIncidentId, incidentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (
      !titleEn.trim() ||
      !descEn.trim() ||
      !committeeName.trim() ||
      !contactName.trim() ||
      !phone.trim() ||
      !locationText.trim() ||
      !bankName.trim() ||
      !accountName.trim() ||
      !accountNumber.trim() ||
      !incidentId
    ) {
      setError(t.validationRequired);
      return;
    }
    const wardNumber = Number(ward);
    const costNumber = Number(cost);
    if (
      !Number.isInteger(wardNumber) ||
      wardNumber < 1 ||
      wardNumber > 33 ||
      !cost.trim() ||
      !Number.isFinite(costNumber) ||
      costNumber < 0
    ) {
      setError(t.validationRequired);
      return;
    }
    setSubmitting(true);
    try {
      const response = await createProject({
        title: { en: titleEn.trim(), ne: titleNe.trim() || undefined },
        description: { en: descEn.trim(), ne: descNe.trim() || undefined },
        type,
        district,
        ward: wardNumber,
        locationText: locationText.trim(),
        costEstimateNpr: costNumber,
        committee: {
          name: committeeName.trim(),
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: committeeEmail.trim() || undefined,
          bank: { bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim() },
          esewaId: esewaId.trim() || undefined,
          khaltiId: khaltiId.trim() || undefined,
        },
        turnstileToken: turnstileToken || undefined,
        incidentId,
      });
      setResult(response);
    } catch (cause) {
      setError((cause as ApiError).status === 0 ? t.offline : apiErrorMessage(cause, language));
    } finally {
      setSubmitting(false);
    }
  };

  if (result)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow={t.communityEyebrow} title={t.projectReceived} description={t.projectReceivedBody} />
        <Card>
          <CardContent className="space-y-6 pt-6">
            <CodeDisplay
              code={result.updateCode}
              kind="update"
              label={t.updateCode}
              hint={t.updateCodeHint}
              copyLabel={t.projectCopy}
              copiedLabel={t.projectsCopied}
            />
            <Card className="bg-secondary">
              <CardHeader>
                <CardTitle className="text-base">{t.whatNext}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6">{t.projectReceivedBody}</p>
              </CardContent>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`/projects/${encodeURIComponent(result.id)}`}>{t.viewProject}</a>
              </Button>
              <Button asChild variant="secondary">
                <a href="/projects">{t.backToProjects}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );

  const field = (id: string, label: string, control: React.ReactNode, errorText?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {errorText ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.communityEyebrow} title={t.projectRegisterTitle} description={t.projectRegisterLead} />
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.projectDetailsCard}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {field(
              "project-title-en",
              `${t.projectTitleEn} *`,
              <Input id="project-title-en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={120} required />,
            )}
            {field(
              "project-title-ne",
              t.projectTitleNe,
              <Input id="project-title-ne" value={titleNe} onChange={(e) => setTitleNe(e.target.value)} maxLength={120} />,
            )}
            {field(
              "project-description-en",
              `${t.projectDescriptionEn} *`,
              <Textarea
                id="project-description-en"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                maxLength={2000}
                rows={5}
                required
              />,
            )}
            {field(
              "project-description-ne",
              t.projectDescriptionNe,
              <Textarea id="project-description-ne" value={descNe} onChange={(e) => setDescNe(e.target.value)} maxLength={2000} rows={5} />,
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              {field(
                "project-type",
                `${t.projectTypeLabel} *`,
                <NativeSelect id="project-type" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
                  {PROJECT_TYPES.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {typeLabel(value, language)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>,
              )}
              {field(
                "project-district",
                `${t.projectDistrict} *`,
                <NativeSelect id="project-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {districtNames.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {districtLabels[value][language]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>,
              )}
              {field(
                "project-incident",
                `${disaster.incidentPickerLabel} *`,
                <NativeSelect
                  id="project-incident"
                  value={incidentId}
                  onChange={(event) => {
                    setIncidentId(event.target.value);
                    if (event.target.value) setCurrentIncidentId(event.target.value);
                  }}
                >
                  <NativeSelectOption value="">{disaster.incidentSelect}</NativeSelectOption>
                  {activeIncidents.map((incident) => (
                    <NativeSelectOption key={incident.id} value={incident.id}>
                      {language === "ne" && incident.nameNe ? incident.nameNe : incident.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>,
              )}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {field(
                "project-ward",
                `${t.projectWard} *`,
                <Input
                  id="project-ward"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={33}
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  required
                />,
              )}
              {field(
                "project-cost",
                `${t.projectCost} *`,
                <Input
                  id="project-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                />,
              )}
            </div>
            {field(
              "project-location",
              `${t.projectLocation} *`,
              <>
                <Input
                  id="project-location"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder={t.projectLocationHint}
                  required
                />
                <p className="text-sm text-muted-foreground">{t.projectLocationHint}</p>
              </>,
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.projectResponsibleCard}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {field(
              "committee-name",
              `${t.committeeName} *`,
              <Input id="committee-name" value={committeeName} onChange={(e) => setCommitteeName(e.target.value)} required />,
            )}
            {field(
              "committee-contact",
              `${t.committeeContact} *`,
              <Input id="committee-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} required />,
            )}
            {field(
              "committee-phone",
              `${t.committeePhone} *`,
              <Input
                id="committee-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder={t.phonePlaceholder}
                required
              />,
            )}
            {field(
              "committee-email",
              t.committeeEmail,
              <Input id="committee-email" type="email" value={committeeEmail} onChange={(e) => setCommitteeEmail(e.target.value)} />,
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.projectBankCard}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {field(
              "bank-name",
              `${t.bankName} *`,
              <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />,
            )}
            {field(
              "account-name",
              `${t.accountName} *`,
              <Input id="account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />,
            )}
            {field(
              "account-number",
              `${t.accountNumber} *`,
              <Input id="account-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />,
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("esewa-id", t.esewaId, <Input id="esewa-id" value={esewaId} onChange={(e) => setEsewaId(e.target.value)} />)}
              {field("khalti-id", t.khaltiId, <Input id="khalti-id" value={khaltiId} onChange={(e) => setKhaltiId(e.target.value)} />)}
            </div>
          </CardContent>
        </Card>
        {TURNSTILE_KEY ? (
          <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.turnstileHint}</p>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? t.submittingProject : t.submitProject}
        </Button>
      </form>
    </div>
  );
}
