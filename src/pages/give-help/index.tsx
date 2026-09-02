import { useEffect, useState } from "react";
import { Flag, Share2 } from "lucide-react";
import { CATEGORIES, createOffer, flagNeed, listNeeds, listOffers, type Category, type NeedPublic, type OfferPublic } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { districtLabels, districtNames } from "@/lib/geo";
import { labels } from "@/i18n";
import { formStrings } from "@/i18n/forms";
import type { Language } from "@/lib/types";
import { TurnstileWidget } from "@/components/turnstile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CodeDisplay } from "@/components/code-display";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
function categoryLabel(category: string, language: Language) {
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
      } as Record<string, string>
    )[category] ?? t.unavailable
  );
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

function FlagDialog({
  language,
  needId,
  open,
  onClose,
}: {
  language: Language;
  needId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = labels[language];
  const [reason, setReason] = useState<"already_received" | "not_real" | "other">("already_received");
  const [details, setDetails] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("already_received");
      setDetails("");
      setToken("");
      setError(null);
      setDone(false);
    }
  }, [needId, open]);
  const submit = async () => {
    if (!needId) return;
    if (details.length > 500) {
      setError(t.flagDetailsHint);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await flagNeed(needId, { reason, details: details.trim() || undefined, turnstileToken: token || undefined });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{done ? t.flagSuccessTitle : formStrings[language].giveHelpFlagDialogTitle}</DialogTitle>
          <DialogDescription>{done ? t.flagSuccessBody : t.flagDetailsHint}</DialogDescription>
        </DialogHeader>
        {done ? (
          <DialogFooter>
            <Button onClick={onClose}>{formStrings[language].giveHelpClose}</Button>
          </DialogFooter>
        ) : (
          <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t.flagReasonLabel}</legend>
              {(
                [
                  ["already_received", t.flagReasonAlready],
                  ["not_real", t.flagReasonNotReal],
                  ["other", t.flagReasonOther],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="radio" name="flagReason" checked={reason === value} onChange={() => setReason(value)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="flagDetails">{t.flagDetailsLabel}</Label>
              <Textarea
                id="flagDetails"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder={t.flagDetailsPlaceholder}
              />
              <p className="text-sm text-muted-foreground">{details.length}/500</p>
            </div>
            {TURNSTILE_KEY ? (
              <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setToken} />
            ) : (
              <p className="text-sm text-muted-foreground">{t.flagTurnstileHint}</p>
            )}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t.deskCancel}
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? t.flagSubmitting : t.flagSubmit}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfferDialog({
  language,
  open,
  onOpenChange,
  onSuccess,
}: {
  language: Language;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (id: string) => void;
}) {
  const t = labels[language];
  const ts = formStrings[language];
  const auth = useGoogleAuth();
  const [orgOnBehalf, setOrgOnBehalf] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgContact, setOrgContact] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = <T extends string>(value: T, values: T[], setValues: (next: T[]) => void) =>
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.idToken) {
      setError(t.giveHelpSignInRequired);
      return;
    }
    if (
      !categories.length ||
      !districts.length ||
      !description.trim() ||
      !phone.trim() ||
      (orgOnBehalf && (!orgName.trim() || !orgContact.trim()))
    ) {
      setError(t.getHelpValidationRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await createOffer(auth.idToken, {
        org: orgOnBehalf ? { name: orgName.trim(), contact: orgContact.trim() } : undefined,
        categories,
        districts,
        description: description.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
      onSuccess(response.id);
      setDescription("");
      setPhone("");
      setEmail("");
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ts.giveHelpOfferDialogTitle}</DialogTitle>
          <DialogDescription>{t.giveHelpOfferLead}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="flex items-center gap-3">
            <Checkbox id="orgCheck" checked={orgOnBehalf} onCheckedChange={(checked) => setOrgOnBehalf(checked === true)} />
            <Label htmlFor="orgCheck">{t.giveHelpOrgCheckbox}</Label>
          </div>
          {orgOnBehalf ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orgName">{t.giveHelpOrgName} *</Label>
                <Input id="orgName" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgContact">{t.giveHelpOrgContact} *</Label>
                <Input id="orgContact" value={orgContact} onChange={(event) => setOrgContact(event.target.value)} />
              </div>
            </div>
          ) : null}
          <ChoiceGroup
            id="offerCategories"
            label={`${t.giveHelpCategories} *`}
            values={CATEGORIES}
            selected={categories}
            onToggle={(value) => toggle(value as Category, categories, setCategories)}
            getLabel={(value) => categoryLabel(value, language)}
          />
          <ChoiceGroup
            id="offerDistricts"
            label={`${t.giveHelpDistricts} *`}
            values={districtNames}
            selected={districts}
            onToggle={(value) => toggle(value, districts, setDistricts)}
            getLabel={(value) => districtLabels[value as keyof typeof districtLabels][language]}
          />
          <div className="space-y-2">
            <Label htmlFor="offerDesc">{t.giveHelpDescriptionLabel} *</Label>
            <Textarea
              id="offerDesc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder={t.giveHelpDescriptionHint}
            />
            <p className="text-sm text-muted-foreground">{t.giveHelpDescriptionHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offerPhone">{t.giveHelpPhone} *</Label>
            <Input id="offerPhone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
            <p className="text-sm text-muted-foreground">{t.giveHelpPhoneHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offerEmail">{t.giveHelpEmail}</Label>
            <Input id="offerEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.deskCancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t.flagSubmitting : t.giveHelpSubmitOffer}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup({
  id,
  label,
  values,
  selected,
  onToggle,
  getLabel,
}: {
  id: string;
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  getLabel: (value: string) => string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div id={id} className="flex flex-wrap gap-2">
        {values.map((value) => (
          <div
            key={value}
            className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <Checkbox id={id + "-" + value} checked={selected.includes(value)} onCheckedChange={() => onToggle(value)} />
            <Label htmlFor={id + "-" + value}>{getLabel(value)}</Label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function GiveHelp({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];
  const auth = useGoogleAuth();
  const [needsDistrict, setNeedsDistrict] = useState("");
  const [needsCategory, setNeedsCategory] = useState("");
  const [needs, setNeeds] = useState<NeedPublic[]>([]);
  const [needsLoading, setNeedsLoading] = useState(false);
  const [needsError, setNeedsError] = useState<string | null>(null);
  const [offersDistrict, setOffersDistrict] = useState("");
  const [offersCategory, setOffersCategory] = useState("");
  const [offers, setOffers] = useState<OfferPublic[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setNeedsLoading(true);
    setNeedsError(null);
    listNeeds({ district: needsDistrict || undefined, category: needsCategory || undefined })
      .then((response) => {
        if (!cancelled) setNeeds(response.items);
      })
      .catch((err) => {
        if (!cancelled) {
          setNeedsError(apiErrorMessage(err, language));
          setNeeds([]);
        }
      })
      .finally(() => {
        if (!cancelled) setNeedsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language, needsCategory, needsDistrict]);
  useEffect(() => {
    let cancelled = false;
    setOffersLoading(true);
    listOffers({ district: offersDistrict || undefined, category: offersCategory || undefined })
      .then((response) => {
        if (!cancelled) setOffers(response.items);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      })
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language, offersCategory, offersDistrict]);
  const filters = (prefix: "needs" | "offers") => {
    const district = prefix === "needs" ? needsDistrict : offersDistrict;
    const category = prefix === "needs" ? needsCategory : offersCategory;
    const setDistrict = prefix === "needs" ? setNeedsDistrict : setOffersDistrict;
    const setCategory = prefix === "needs" ? setNeedsCategory : setOffersCategory;
    return (
      <div className="grid gap-4 rounded-xl border bg-secondary p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-district`}>{t.giveHelpFilterDistrict}</Label>
          <NativeSelect id={`${prefix}-district`} value={district} onChange={(event) => setDistrict(event.target.value)}>
            <NativeSelectOption value="">{t.giveHelpAllDistricts}</NativeSelectOption>
            {districtNames.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {districtLabels[item][language]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-category`}>{t.giveHelpFilterCategory}</Label>
          <NativeSelect id={`${prefix}-category`} value={category} onChange={(event) => setCategory(event.target.value)}>
            <NativeSelectOption value="">{t.giveHelpAllCategories}</NativeSelectOption>
            {CATEGORIES.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {categoryLabel(item, language)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    );
  };
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={ts.mutualAidEyebrow} title={t.giveHelpTitle} description={t.giveHelpLead} />
      <Tabs defaultValue="needs">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="needs">{ts.giveHelpNeedsTab}</TabsTrigger>
          <TabsTrigger value="offers">{ts.giveHelpOffersTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="needs" className="space-y-5">
          {filters("needs")}
          {needsLoading ? (
            <LoadingState label={t.giveHelpLoading} />
          ) : needsError ? (
            <Alert variant="destructive">
              <AlertDescription>{needsError}</AlertDescription>
            </Alert>
          ) : needs.length === 0 ? (
            <EmptyState title={t.giveHelpEmpty} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {needs.map((need) => (
                <NeedCard key={need.id} language={language} need={need} onFlag={() => setFlagId(need.id)} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="offers" className="space-y-5">
          {filters("offers")}
          {offersLoading ? (
            <LoadingState label={t.giveHelpLoading} />
          ) : offers.length === 0 ? (
            <EmptyState title={t.giveHelpOffersEmpty} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <OfferCard key={offer.id} language={language} offer={offer} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <FlagDialog language={language} needId={flagId} open={Boolean(flagId)} onClose={() => setFlagId(null)} />
      <section className="space-y-4">
        <Card className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t.giveHelpOfferTitle}</CardTitle>
            <CardDescription>{t.giveHelpOfferLead}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {!auth.idToken ? (
              <div className="space-y-4">
                {auth.clientId ? (
                  <Button onClick={auth.signIn} className="w-full" aria-label={t.deskContinueWithGoogle}>
                    {t.deskContinueWithGoogle}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.deskNotConfigured}</p>
                )}
                {auth.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {t.deskSignInFailed}
                  </p>
                ) : null}
              </div>
            ) : offerSuccess ? (
              <div className="space-y-4 text-left">
                <CodeDisplay
                  code={offerSuccess}
                  kind="ref"
                  label={ts.offerReferenceLabel}
                  copyLabel={t.getHelpRefCodeCopy}
                  copiedLabel={t.getHelpRefCodeCopied}
                />
                <p className="text-base leading-relaxed text-muted-foreground">{ts.offerWhatNextBody}</p>
              </div>
            ) : (
              <Button type="button" size="lg" className="w-full" onClick={() => setOfferOpen(true)}>
                {t.giveHelpOfferTitle}
              </Button>
            )}
          </CardContent>
        </Card>
        <OfferDialog language={language} open={offerOpen} onOpenChange={setOfferOpen} onSuccess={setOfferSuccess} />
      </section>
    </div>
  );
}

function NeedCard({ language, need, onFlag }: { language: Language; need: NeedPublic; onFlag: () => void }) {
  const t = labels[language];
  const ts = formStrings[language];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{categoryLabel(need.category, language)}</Badge>
          <StatusBadge tone={toneForStatus(need.status)}>{statusLabel(need.status, language)}</StatusBadge>
        </div>
        <CardTitle className="text-lg">{need.maskedName}</CardTitle>
        <CardDescription>
          {districtLabels[need.district as keyof typeof districtLabels]?.[language] ?? need.district} · W{need.ward} ·{" "}
          {new Date(need.createdAt).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base leading-relaxed">{need.description}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/get-help?need=${encodeURIComponent(need.id)}`;
              navigator.clipboard
                .writeText(url)
                .then(() => undefined)
                .catch(() => window.prompt(t.giveHelpShare, url));
            }}
          >
            {ts.giveHelpRespond}
            <Share2 aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onFlag}>
            <Flag aria-hidden="true" />
            {ts.giveHelpFlag}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
function OfferCard({ language, offer }: { language: Language; offer: OfferPublic }) {
  const t = labels[language];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          {offer.categories.map((category) => (
            <Badge variant="secondary" key={category}>
              {categoryLabel(category, language)}
            </Badge>
          ))}
          <StatusBadge tone={toneForStatus(offer.status)}>{statusLabel(offer.status, language)}</StatusBadge>
        </div>
        <CardTitle className="text-lg">{offer.helperLabel}</CardTitle>
        <CardDescription>
          {offer.districts.map((district) => districtLabels[district as keyof typeof districtLabels]?.[language] ?? district).join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-base leading-relaxed">{offer.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {new Date(offer.createdAt).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US")}
        </p>
      </CardContent>
    </Card>
  );
}
