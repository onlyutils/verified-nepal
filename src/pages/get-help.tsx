import { useEffect, useState } from "react";
import { ApiError, CATEGORIES, type Category, createNeed, getStatus, renewNeed } from "../api";
import { TurnstileWidget } from "../components/turnstile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { districtLabels, districtNames } from "../geo";
import { labels } from "../i18n";
import type { Language } from "../types";
import { Separator } from "@/components/ui/separator";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

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

export function GetHelp({ language }: { language: Language }) {
  const t = labels[language];

  const [onBehalf, setOnBehalf] = useState<boolean>(false);
  const [consent, setConsent] = useState(false);
  const [registrantName, setRegistrantName] = useState("");
  const [registrantPhone, setRegistrantPhone] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryPhone, setBeneficiaryPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [category, setCategory] = useState<Category>("goods");
  const [description, setDescription] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; refCode: string } | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  const [statusCode, setStatusCode] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<{ status: string; category: string; district: string; createdAt: string; expiresAt: string; claimCode?: string } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewDone, setRenewDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const need = params.get("need");
    if (need) {
      // Share link arrived via give-help; could prefill? Not needed but hint copy
    }
  }, []);

  if (success) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-1">
        <Card className="border-ink">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">{t.getHelpSuccessTitle}</CardTitle>
            <CardDescription>{t.getHelpRefCodeHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpRefCodeLabel}</p>
              <p className="mt-3 break-all font-mono text-3xl font-bold tracking-widest text-ink sm:text-4xl" aria-live="polite">
                {success.refCode}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
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
              <Button variant="outline" onClick={() => setSuccess(null)}>
                {t.getHelpSubmit} — {t.commonAgain}
              </Button>
            </div>
          </CardContent>
        </Card>
        <StandaloneStatus language={language} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (onBehalf && !consent) {
      setError(t.getHelpValidationConsent);
      return;
    }
    if (!beneficiaryName.trim()) {
      setError(t.getHelpValidationRequired);
      return;
    }
    if (!district) {
      setError(t.getHelpValidationRequired);
      return;
    }
    const wardNum = Number(ward);
    if (!ward || Number.isNaN(wardNum) || wardNum < 1 || wardNum > 35) {
      setError(t.getHelpValidationRequired);
      return;
    }
    if (!description.trim()) {
      setError(t.getHelpValidationRequired);
      return;
    }
    if (onBehalf && (!registrantName.trim() || !registrantPhone.trim())) {
      setError(t.getHelpValidationRequired);
      return;
    }

    setSubmitting(true);
    try {
      const body: Parameters<typeof createNeed>[0] = {
        onBehalf,
        registrant: onBehalf ? { name: registrantName.trim(), phone: registrantPhone.trim() } : null,
        beneficiary: {
          name: beneficiaryName.trim(),
          phone: beneficiaryPhone.trim() || undefined,
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
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.getHelpErrorGeneric;
      setError(msg || t.getHelpErrorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.getHelpTitle}</h1>
        <p className="mt-3 max-w-2xl font-serif leading-7 text-muted-foreground">{t.getHelpLead}</p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset>
              <legend className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t.getHelpForWhom}</legend>
              <div className="mt-3 flex gap-3">
                <Button type="button" variant={onBehalf ? "outline" : "default"} onClick={() => setOnBehalf(false)} className="flex-1">
                  {t.getHelpForMyself}
                </Button>
                <Button type="button" variant={onBehalf ? "default" : "outline"} onClick={() => setOnBehalf(true)} className="flex-1">
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
                    <Input id="registrantName" value={registrantName} onChange={(e) => setRegistrantName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrantPhone">{t.getHelpRegistrantPhone} *</Label>
                    <Input id="registrantPhone" value={registrantPhone} onChange={(e) => setRegistrantPhone(e.target.value)} inputMode="tel" required />
                  </div>
                </div>
                <label className="flex items-start gap-2 font-sans text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-ink" />
                  <span>
                    {t.getHelpConsentLabel} *
                    <span className="block text-xs text-muted-foreground">{t.getHelpConsentHint}</span>
                  </span>
                </label>
              </div>
            ) : null}

            <div className="space-y-4">
              <h3 className="font-display text-base font-semibold">{t.getHelpBeneficiaryTitle}</h3>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryName">{t.getHelpBeneficiaryName} *</Label>
                <Input id="beneficiaryName" value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiaryPhone">{t.getHelpBeneficiaryPhone}</Label>
                <Input id="beneficiaryPhone" value={beneficiaryPhone} onChange={(e) => setBeneficiaryPhone(e.target.value)} inputMode="tel" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="district">{t.getHelpDistrict} *</Label>
                  <Select id="district" value={district} onChange={(e) => setDistrict(e.target.value)} required>
                    <option value="">{t.getHelpSelectDistrict}</option>
                    {districtNames.map((d) => (
                      <SelectItem key={d} value={d}>
                        {districtLabels[d][language]}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ward">{t.getHelpWard} *</Label>
                  <Input id="ward" value={ward} onChange={(e) => setWard(e.target.value)} inputMode="numeric" type="number" min={1} max={35} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="householdSize">{t.getHelpHouseholdSize}</Label>
                <Input id="householdSize" value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} inputMode="numeric" type="number" min={1} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t.getHelpCategory} *</Label>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c, language)}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t.getHelpDescription} *</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required placeholder={t.getHelpDescriptionHint} />
              <p className="font-sans text-xs text-muted-foreground">{t.getHelpDescriptionHint}</p>
            </div>

            {TURNSTILE_KEY ? (
              <div>
                <p className="font-sans text-xs text-muted-foreground">{t.getHelpTurnstileHint}</p>
                <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} />
              </div>
            ) : null}

            {error ? (
              <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full">
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
        <CardContent className="space-y-3 font-sans text-sm leading-6">
          <ul className="list-disc space-y-1 pl-5">
            <li>{t.getHelpHowPrioritisedItem1}</li>
            <li>{t.getHelpHowPrioritisedItem2}</li>
            <li>{t.getHelpHowPrioritisedItem3}</li>
          </ul>
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
      const apiErr = err as ApiError;
      if (apiErr.status === 404) setStatusError(t.getHelpStatusUnknown);
      else setStatusError(apiErr.message || t.getHelpErrorGeneric);
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
      const apiErr = err as ApiError;
      setStatusError(apiErr.message || t.getHelpErrorGeneric);
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
          className="font-mono"
        />
        <Button type="button" onClick={doCheck} disabled={statusLoading || !statusCode.trim()}>
          {statusLoading ? "…" : t.getHelpCheckStatusButton}
        </Button>
      </div>
      {statusError ? (
        <p className="mt-2 font-sans text-sm text-destructive" role="alert">
          {statusError}
        </p>
      ) : null}
      {statusResult ? (
        <div className="mt-3 space-y-3 font-sans text-sm">
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
          <Button type="button" variant="outline" size="sm" onClick={doRenew} disabled={renewing}>
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
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.getHelpCheckStatusPlaceholder} className="font-mono" />
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
                const apiErr = err as ApiError;
                if (apiErr.status === 404) setError(t.getHelpStatusUnknown);
                else setError(apiErr.message || t.getHelpErrorGeneric);
                setResult(null);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !code.trim()}
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
          <div className="space-y-3 font-sans text-sm">
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
                  const apiErr = e as ApiError;
                  setError(apiErr.message || t.getHelpErrorGeneric);
                } finally {
                  setRenewing(false);
                }
              }}
              disabled={renewing}
            >
              {renewDone ? t.getHelpStatusRenewed : renewing ? "…" : t.getHelpStatusRenew}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
