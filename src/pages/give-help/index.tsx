import { useEffect, useState } from "react";
import { Flag, Share2 } from "lucide-react";
import {
  CATEGORIES,
  declareDonation,
  addGroupItem,
  claimGroupItem,
  createOffer,
  getDashboard,
  flagNeed,
  joinGroupApi,
  listMyOrgs,
  listNeeds,
  listCenters,
  listOffers,
  markGroupItemDone,
  takeNeed,
  takeNeedAsGroup,
  setNeedDelivery,
  deliverNeed,
  deliverGroupNeed,
  orgClaimNeed,
  releaseGroupItem,
  startGroup,
  type Category,
  type CenterPublic,
  type NeedTimelineStep,
  type GroupPublic,
  type MyOrg,
  type NeedPublic,
  type OfferPublic,
} from "@/lib/api";
import { apiErrorMessage, isTurnstileError } from "@/lib/api-error";
import { rememberReturnTo, useGoogleAuth } from "@/lib/auth";
import { GENERAL_INCIDENT_ID, useIncidents } from "@/lib/incidents";
import { districtLabels, districtNames } from "@/lib/geo";
import { labels } from "@/i18n";
import { formatDateTime } from "@/lib/format-date";
import { disasterStrings } from "@/i18n/disasters";
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
import { DistrictPicker } from "@/components/district-picker";
import { SignInNudge } from "@/components/sign-in-nudge";
import { NeedTimeline } from "@/components/need-timeline";
import { goodsLabel, GOODS_CATEGORIES } from "@/lib/goods";

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
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("already_received");
      setDetails("");
      setToken("");
      setTurnstileError(false);
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
      if (isTurnstileError(err)) {
        setTurnstileError(true);
        setToken("");
        setTurnstileResetKey((key) => key + 1);
      } else setError(apiErrorMessage(err, language));
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
              <TurnstileWidget
                siteKey={TURNSTILE_KEY}
                language={language}
                onToken={(value) => {
                  setToken(value);
                  setTurnstileError(false);
                }}
                verificationError={turnstileError}
                resetKey={turnstileResetKey}
              />
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t.deskCancel}
              </Button>
              <Button onClick={submit} disabled={submitting || Boolean(TURNSTILE_KEY && !token)}>
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
  incidents,
  incidentId,
  onIncidentChange,
}: {
  language: Language;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (id: string) => void;
  incidents: import("@/lib/api").Incident[];
  incidentId: string;
  onIncidentChange: (id: string) => void;
}) {
  const t = labels[language];
  const ts = formStrings[language];
  const disaster = disasterStrings[language];
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
      !incidentId ||
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
        incidentId,
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
          <DialogDescription>{auth.idToken ? t.giveHelpOfferLeadSignedIn : t.giveHelpOfferLead}</DialogDescription>
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
          <div className="space-y-2">
            <Label htmlFor="offer-incident">{disaster.incidentPickerLabel} *</Label>
            <NativeSelect id="offer-incident" value={incidentId} onChange={(event) => onIncidentChange(event.target.value)}>
              <NativeSelectOption value="">{disaster.incidentSelect}</NativeSelectOption>
              {incidents
                .filter((incident) => incident.status === "active")
                .map((incident) => (
                  <NativeSelectOption key={incident.id} value={incident.id}>
                    {language === "ne" && incident.nameNe ? incident.nameNe : incident.name}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
          <div className="space-y-2" id="offerDistricts">
            <Label>{t.giveHelpDistricts} *</Label>
            <DistrictPicker selected={districts} onChange={setDistricts} language={language} searchPlaceholder={t.giveHelpDistricts} />
          </div>
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
  const disaster = disasterStrings[language];
  const auth = useGoogleAuth();
  const { incidents, currentIncidentId, setCurrentIncidentId } = useIncidents();
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const boardIncidentId = activeIncidents.some((incident) => incident.id === currentIncidentId)
    ? currentIncidentId
    : activeIncidents[0]?.id;
  // Which needs board is being browsed: a specific incident, or GENERAL_INCIDENT_ID for
  // requests submitted without one. Defaults to the shared incident context but is
  // independently switchable so orgs can reach general (no-event) needs.
  const [needsIncidentId, setNeedsIncidentId] = useState("");
  useEffect(() => {
    if (needsIncidentId === GENERAL_INCIDENT_ID || activeIncidents.some((incident) => incident.id === needsIncidentId)) return;
    setNeedsIncidentId(boardIncidentId ?? GENERAL_INCIDENT_ID);
  }, [activeIncidents, boardIncidentId, needsIncidentId]);
  const [needsDistrict, setNeedsDistrict] = useState("");
  const [needsCategory, setNeedsCategory] = useState("");
  const [needs, setNeeds] = useState<NeedPublic[]>([]);
  const [needsLoading, setNeedsLoading] = useState(false);
  const [needsError, setNeedsError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(0);
  const [offersDistrict, setOffersDistrict] = useState("");
  const [offersCategory, setOffersCategory] = useState("");
  const [offersIncidentId, setOffersIncidentId] = useState("");
  const [offers, setOffers] = useState<OfferPublic[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [ownOfferIds, setOwnOfferIds] = useState<Set<string>>(new Set());
  const [flagId, setFlagId] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);
  // Verified organizations the signed-in person belongs to; they may take a need off the board.
  const [verifiedOrgs, setVerifiedOrgs] = useState<MyOrg[]>([]);
  useEffect(() => {
    if (!auth.idToken) {
      setOwnOfferIds(new Set());
      return;
    }
    getDashboard(auth.idToken).then((dashboard) => setOwnOfferIds(new Set(dashboard.offers.map((offer) => offer.id)))).catch(() => setOwnOfferIds(new Set()));
  }, [auth.idToken]);
  useEffect(() => {
    if (!auth.idToken) {
      setVerifiedOrgs([]);
      return;
    }
    let cancelled = false;
    listMyOrgs(auth.idToken)
      .then((r) => { if (!cancelled) setVerifiedOrgs(r.items.filter((org) => org.status === "verified")); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [auth.idToken]);
  const [offerIncidentId, setOfferIncidentId] = useState("");
  useEffect(() => {
    if (offersIncidentId && activeIncidents.some((incident) => incident.id === offersIncidentId)) return;
    setOffersIncidentId(boardIncidentId ?? "");
  }, [activeIncidents, boardIncidentId, offersIncidentId]);
  useEffect(() => {
    if (offerIncidentId && activeIncidents.some((incident) => incident.id === offerIncidentId)) return;
    const next = activeIncidents.find((incident) => incident.id === currentIncidentId)?.id ?? activeIncidents[0]?.id ?? "";
    setOfferIncidentId(next);
  }, [activeIncidents, currentIncidentId, offerIncidentId]);
  useEffect(() => {
    let cancelled = false;
    if (!needsIncidentId) {
      setNeeds([]);
      setNeedsLoading(false);
      return;
    }
    setNeedsLoading(true);
    setNeedsError(null);
    listNeeds({ district: needsDistrict || undefined, category: needsCategory || undefined, incidentId: needsIncidentId }, auth.idToken || undefined)
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
  }, [needsIncidentId, language, needsCategory, needsDistrict, needsRefresh, auth.idToken]);
  useEffect(() => {
    let cancelled = false;
    if (!offersIncidentId) {
      setOffers([]);
      setOffersLoading(false);
      return;
    }
    setOffersLoading(true);
    listOffers({ district: offersDistrict || undefined, category: offersCategory || undefined, incidentId: offersIncidentId })
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
  }, [offersIncidentId, language, offersCategory, offersDistrict]);
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
          <TabsTrigger value="needs" className="min-h-11">{ts.giveHelpNeedsTab}</TabsTrigger>
          <TabsTrigger value="offers" className="min-h-11">{ts.giveHelpOffersTab}</TabsTrigger>
        </TabsList>
        <TabsContent value="needs" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="needs-incident">{disaster.incidentPickerLabel}</Label>
            <NativeSelect id="needs-incident" value={needsIncidentId} onChange={(event) => setNeedsIncidentId(event.target.value)}>
              {activeIncidents.map((incident) => (
                <NativeSelectOption key={incident.id} value={incident.id}>
                  {language === "ne" && incident.nameNe ? incident.nameNe : incident.name}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={GENERAL_INCIDENT_ID}>{disaster.incidentGeneral}</NativeSelectOption>
            </NativeSelect>
          </div>
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
                <NeedCard
                  key={need.id}
                  language={language}
                  need={need}
                  orgs={verifiedOrgs}
                  onFlag={() => setFlagId(need.id)}
                  onMutated={() => setNeedsRefresh((value) => value + 1)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="offers" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="offers-incident">{disaster.incidentPickerLabel}</Label>
            <NativeSelect id="offers-incident" value={offersIncidentId} onChange={(event) => setOffersIncidentId(event.target.value)}>
              {activeIncidents.map((incident) => <NativeSelectOption key={incident.id} value={incident.id}>{language === "ne" && incident.nameNe ? incident.nameNe : incident.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          {filters("offers")}
          {offersLoading ? (
            <LoadingState label={t.giveHelpLoading} />
          ) : offers.length === 0 ? (
            <EmptyState title={t.giveHelpOffersEmpty} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {offers.map((offer) => (
                  <OfferCard key={offer.id} language={language} offer={offer} isYours={ownOfferIds.has(offer.id)} />
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
            <CardDescription>{auth.idToken ? t.giveHelpOfferLeadSignedIn : t.giveHelpOfferLead}</CardDescription>
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
        <OfferDialog
          language={language}
          open={offerOpen}
          onOpenChange={setOfferOpen}
          onSuccess={setOfferSuccess}
          incidents={activeIncidents}
          incidentId={offerIncidentId}
          onIncidentChange={(id) => {
            setOfferIncidentId(id);
            if (id) setCurrentIncidentId(id);
          }}
        />
      </section>
    </div>
  );
}

function GroupPanel({
  language,
  needId,
  group,
  onGroupChange,
  onMutated,
  assignOnly,
  taken,
  onNeedHandled,
  timeline,
  district,
}: {
  language: Language;
  needId: string;
  group: GroupPublic;
  onGroupChange: (group: GroupPublic) => void;
  onMutated: () => void;
  assignOnly?: boolean;
  taken?: boolean;
  onNeedHandled: (label: string) => void;
  timeline?: NeedTimelineStep[];
  district?: string;
}) {
  const ts = formStrings[language];
  const auth = useGoogleAuth();
  const [itemText, setItemText] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showSignInNudge, setShowSignInNudge] = useState(false);
  const [isMember, setIsMember] = useState(Boolean(group.isMember));

  const requireSignIn = () => {
    rememberReturnTo();
    setShowSignInNudge(true);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err, language));
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const submitItem = () =>
    run("add", async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      if (!itemText.trim()) return;
      const result = await addGroupItem(auth.idToken, needId, itemText.trim());
      onGroupChange({
        ...group,
        items: [...group.items, { itemId: result.itemId, description: itemText.trim(), status: "open", createdAt: result.createdAt }],
      });
      setItemText("");
      onMutated();
    });

  const claim = (itemId: string) =>
    run(itemId, async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      const result = await claimGroupItem(auth.idToken, needId, itemId);
      onGroupChange({
        ...group,
        items: group.items.map((it) => (it.itemId === itemId ? { ...it, status: "claimed", claimedByName: result.claimedByName } : it)),
      });
      onMutated();
    });

  const release = (itemId: string) =>
    run(itemId, async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      await releaseGroupItem(auth.idToken, needId, itemId);
      onGroupChange({
        ...group,
        items: group.items.map((it) => (it.itemId === itemId ? { ...it, status: "open", claimedByName: undefined } : it)),
      });
      onMutated();
    });

  const markDone = (itemId: string) =>
    run(itemId, async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      await markGroupItemDone(auth.idToken, needId, itemId);
      onGroupChange({ ...group, items: group.items.map((it) => (it.itemId === itemId ? { ...it, status: "done" } : it)) });
      onMutated();
    });

  const join = () =>
    run("join", async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      await joinGroupApi(auth.idToken, needId);
      setIsMember(true);
      onGroupChange({ ...group, memberCount: group.memberCount + 1, isMember: true });
      onMutated();
    });

  const take = () =>
    run("take", async () => {
      if (!auth.idToken) {
        requireSignIn();
        return;
      }
      const result = await takeNeedAsGroup(auth.idToken, needId);
      onNeedHandled(result.handler);
      onMutated();
    });

  return (
    <div className="space-y-3 rounded-lg border bg-secondary p-3">
      <div>
        <p className="font-medium">{group.name}</p>
        <p className="text-xs text-muted-foreground">{ts.groupNotMarketplace}</p>
      </div>
      {showSignInNudge ? <SignInNudge language={language} id={`group-${needId}`} title={ts.groupSignInTitle} body={ts.groupSignInBody} /> : null}
      {group.items.length > 0 ? (
        <ul className="space-y-2">
          {group.items.map((item) => (
            <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {item.description}
                {item.status === "claimed" && item.claimedByName ? ` — ${item.claimedByName}` : ""}
              </span>
              {item.status === "open" ? (
                <Button size="sm" variant="outline" disabled={Boolean(busy[item.itemId])} onClick={() => claim(item.itemId)}>
                  {ts.groupClaim}
                </Button>
              ) : item.status === "claimed" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={Boolean(busy[item.itemId])} onClick={() => markDone(item.itemId)}>
                    {ts.groupMarkDone}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={Boolean(busy[item.itemId])} onClick={() => release(item.itemId)}>
                    {ts.groupRelease}
                  </Button>
                </div>
              ) : (
                <StatusBadge tone="success">{ts.groupDone}</StatusBadge>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={itemText}
          onChange={(event) => setItemText(event.target.value)}
          placeholder={ts.groupItemPlaceholder}
          maxLength={300}
        />
        <Button size="sm" disabled={busy.add || !itemText.trim()} onClick={submitItem}>
          {ts.groupAddItem}
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{ts.groupMemberCount.replace("{n}", String(group.memberCount))}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {!isMember ? <Button size="sm" variant="ghost" disabled={busy.join} onClick={join}>{ts.groupJoin}</Button> : null}
        </div>
      </div>
      {isMember && !assignOnly && !taken ? <Button size="sm" disabled={busy.take} onClick={take}>{ts.groupTake}</Button> : null}
      {taken ? <DeliveryChoice language={language} needId={needId} category="goods" district={district} handlerKind="group" onMutated={onMutated} /> : null}
      <NeedTimeline steps={timeline} language={language} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function DeliveryChoice({
  language,
  needId,
  category,
  district,
  handlerKind,
  currentChannel,
  currentCenterId,
  onMutated,
}: {
  language: Language;
  needId: string;
  category: Category;
  district?: string;
  handlerKind: "helper" | "group";
  currentChannel?: "direct" | "center";
  currentCenterId?: string;
  onMutated: () => void;
}) {
  const ts = formStrings[language];
  const auth = useGoogleAuth();
  const [mode, setMode] = useState<"direct" | "center">(currentChannel ?? "direct");
  const [centers, setCenters] = useState<CenterPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(currentCenterId ?? "");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [goods, setGoods] = useState("other");
  const [qty, setQty] = useState("1");
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadCenters = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listCenters();
      const available = result.items.filter((center) => center.accepts.includes(goods));
      available.sort((a, b) => {
        if (location && a.lat !== undefined && a.lng !== undefined && b.lat !== undefined && b.lng !== undefined) {
          const da = (a.lat - location.lat) ** 2 + (a.lng - location.lng) ** 2;
          const db = (b.lat - location.lat) ** 2 + (b.lng - location.lng) ** 2;
          return da - db;
        }
        return (district && a.district === district ? -1 : 0) - (district && b.district === district ? -1 : 0);
      });
      setCenters(available);
      if (!selected && available[0]) setSelected(available[0].id);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!location) return;
    setCenters((items) => [...items].sort((a, b) => {
      if (a.lat === undefined || a.lng === undefined) return 1;
      if (b.lat === undefined || b.lng === undefined) return -1;
      return (a.lat - location.lat) ** 2 + (a.lng - location.lng) ** 2 - ((b.lat - location.lat) ** 2 + (b.lng - location.lng) ** 2);
    }));
  }, [location]);
  const saveDirect = async () => {
    if (!auth.idToken) return;
    setError(null);
    setLoading(true);
    try {
      await setNeedDelivery(auth.idToken, needId, { deliveryChannel: "direct" });
      if (handlerKind === "group") await deliverGroupNeed(auth.idToken, needId);
      else await deliverNeed(auth.idToken, needId);
      onMutated();
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  const saveCenter = async () => {
    if (!auth.idToken || !selected) return;
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setError(null);
    setLoading(true);
    try {
      const donation = await declareDonation(selected, { category: goods, qty: amount, needId }, auth.idToken);
      await setNeedDelivery(auth.idToken, needId, { deliveryChannel: "center", centerId: selected, category: goods });
      setRef(donation.ref);
      onMutated();
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  const center = centers.find((item) => item.id === selected);
  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <p className="font-medium">{ts.deliveryHow}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ts.deliveryHow}>
        <Button type="button" size="sm" variant={mode === "direct" ? "default" : "outline"} onClick={() => setMode("direct")}>{ts.deliveryDirect}</Button>
        <Button type="button" size="sm" variant={mode === "center" ? "default" : "outline"} onClick={() => { setMode("center"); if (navigator.geolocation && !location) navigator.geolocation.getCurrentPosition((position) => setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }), () => undefined); if (!centers.length) void loadCenters(); }}>{ts.deliveryCenter}</Button>
      </div>
      {mode === "direct" ? <Button type="button" size="sm" onClick={() => void saveDirect()} disabled={loading}>{ts.helperDeliver}</Button> : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`delivery-goods-${needId}`}>{ts.deliveryCategory}</Label><NativeSelect id={`delivery-goods-${needId}`} value={goods} onChange={(event) => { setGoods(event.target.value); setCenters([]); setSelected(""); }}><NativeSelectOption value="">{ts.deliveryCategory}</NativeSelectOption>{GOODS_CATEGORIES.map((item) => <NativeSelectOption key={item.id} value={item.id}>{goodsLabel(item.id, language)}</NativeSelectOption>)}</NativeSelect></div>
            <div className="space-y-2"><Label htmlFor={`delivery-qty-${needId}`}>{ts.deliveryQuantity}</Label><Input id={`delivery-qty-${needId}`} type="number" min="0.01" step="0.01" value={qty} onChange={(event) => setQty(event.target.value)} /></div>
          </div>
          {!centers.length && !loading ? <Button type="button" size="sm" variant="outline" onClick={() => void loadCenters()}>{ts.deliveryCenterSelect}</Button> : null}
          {loading ? <p className="text-sm text-muted-foreground">{ts.deliveryCenterLoading}</p> : null}
          {centers.length ? <div className="space-y-2"><Label htmlFor={`delivery-center-${needId}`}>{ts.deliveryCenterSelect}</Label><NativeSelect id={`delivery-center-${needId}`} value={selected} onChange={(event) => setSelected(event.target.value)}>{centers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name} · {item.district}</NativeSelectOption>)}</NativeSelect><Button type="button" size="sm" onClick={() => void saveCenter()} disabled={loading || !selected}>{ts.deliveryConfirm}</Button></div> : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          {ref && center ? <div className="space-y-2 rounded-md border-l-2 border-primary pl-3" role="status"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{ts.deliveryInstructions}</p><StatusBadge tone="warning">{ts.deliverySaved}</StatusBadge></div><p className="text-sm">{center.name}</p><p className="text-sm">{ts.deliveryAddress.replace("{address}", center.address)}</p>{center.hours ? <p className="text-sm">{ts.deliveryHours.replace("{hours}", center.hours)}</p> : null}<p className="text-sm">{ts.deliveryBring}</p><CodeDisplay code={ref} kind="ref" label={ts.deliveryDropCode} copyLabel={ts.deliveryCopy} copiedLabel={ts.deliveryCopied} /></div> : null}
        </div>
      )}
      {mode === "direct" && error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

function NeedCard({ language, need, orgs, onFlag, onMutated }: { language: Language; need: NeedPublic; orgs: MyOrg[]; onFlag: () => void; onMutated: () => void }) {
  const t = labels[language];
  const ts = formStrings[language];
  const auth = useGoogleAuth();
  const [group, setGroup] = useState<GroupPublic | undefined>(need.group);
  const [forming, setForming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [handledBy, setHandledBy] = useState<{ status: string; label: string; kind?: string } | null>(need.handledBy ? { status: need.status, label: need.handledBy, kind: need.handledByKind } : null);
  const [taking, setTaking] = useState(false);

  const takeForOrg = async (org: MyOrg) => {
    if (!auth.idToken) return;
    setTaking(true);
    setFormError(null);
    try {
      await orgClaimNeed(auth.idToken, org.id, need.id);
      setHandledBy({ status: "matched", label: org.name, kind: "org" });
      onMutated();
    } catch (err) {
      setFormError(apiErrorMessage(err, language));
    } finally {
      setTaking(false);
    }
  };

  const takeForHelper = async () => {
    if (!auth.idToken) return;
    setTaking(true);
    setFormError(null);
    try {
      const result = await takeNeed(auth.idToken, need.id);
      setHandledBy({ status: "matched", label: result.handler, kind: "helper" });
      onMutated();
    } catch (err) {
      setFormError(apiErrorMessage(err, language));
    } finally {
      setTaking(false);
    }
  };

  const formGroup = async () => {
    if (!auth.idToken) return;
    setForming(true);
    setFormError(null);
    try {
      const result = await startGroup(auth.idToken, need.id);
      setGroup({ name: result.name, items: [], memberCount: 1, isMember: true });
      onMutated();
    } catch (err) {
      setFormError(apiErrorMessage(err, language));
    } finally {
      setForming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{categoryLabel(need.category, language)}</Badge>
          <StatusBadge tone={toneForStatus(handledBy?.status ?? need.status)}>{statusLabel(handledBy?.status ?? need.status, language)}</StatusBadge>
        </div>
        <CardTitle className="text-lg">{need.maskedName}</CardTitle>
        <CardDescription>
          {districtLabels[need.district as keyof typeof districtLabels]?.[language] ?? need.district} · W{need.ward} ·{" "}
          {formatDateTime(need.createdAt, language)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base leading-relaxed">{need.description}</p>
        {handledBy ? (
          <p className="text-sm text-muted-foreground" role="status">
            {handledBy.status === "fulfilled" && need.deliveredBy
              ? ts.deliveredBy.replace("{label}", need.deliveredBy)
              : handledBy.status === "matched" && handledBy.kind === "helper"
              ? ts.helperTaken.replace("{label}", handledBy.label)
              : handledBy.status === "matched" && handledBy.kind === "group"
                ? ts.groupTaken.replace("{label}", handledBy.label)
                : (handledBy.status === "fulfilled" ? ts.orgFulfilledBy : ts.orgHandledBy).replace("{org}", handledBy.label)}
          </p>
        ) : need.status === "published" && !need.assignOnly && auth.idToken ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={taking} onClick={() => void takeForHelper()}>{ts.helperTake}</Button>
            {!group ? orgs.map((org) => (
              <Button key={org.id} size="sm" disabled={taking} onClick={() => void takeForOrg(org)}>
                {ts.orgHandle.replace("{org}", org.name)}
              </Button>
            )) : null}
          </div>
        ) : need.status === "published" && need.assignOnly ? (
          <p className="text-sm text-muted-foreground">{ts.assignOnlyNotice}</p>
        ) : need.status === "published" && !auth.idToken ? (
          <SignInNudge language={language} id={`take-${need.id}`} title={ts.groupSignInTitle} body={ts.groupSignInBody} />
        ) : null}
        {group ? (
          <GroupPanel language={language} needId={need.id} district={need.district} timeline={need.timeline} group={group} assignOnly={need.assignOnly} taken={Boolean(handledBy)} onGroupChange={setGroup} onMutated={onMutated} onNeedHandled={(label) => setHandledBy({ status: "matched", label, kind: "group" })} />
        ) : need.status === "published" && auth.idToken && !need.handledBy ? (
          <Button variant="outline" size="sm" disabled={forming} onClick={formGroup}>
            {ts.groupForm}
          </Button>
        ) : null}
        {handledBy?.kind === "helper" ? <DeliveryChoice language={language} needId={need.id} category={need.category} district={need.district} handlerKind="helper" currentChannel={need.deliveryChannel} currentCenterId={need.centerId} onMutated={onMutated} /> : null}
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
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
function OfferCard({ language, offer, isYours }: { language: Language; offer: OfferPublic; isYours?: boolean }) {
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
          {isYours ? <Badge variant="outline">{t.giveHelpOfferYours}</Badge> : null}
        </div>
        <CardTitle className="text-lg">{offer.helperLabel}</CardTitle>
        <CardDescription>
          {offer.districts.length ? offer.districts.map((district) => districtLabels[district as keyof typeof districtLabels]?.[language] ?? district).join(" · ") : t.unavailable}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-base leading-relaxed">{offer.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {formatDateTime(offer.createdAt, language)}
        </p>
      </CardContent>
    </Card>
  );
}
