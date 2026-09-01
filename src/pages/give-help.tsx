import { useEffect, useState } from "react";
import { ApiError, CATEGORIES, type Category, createOffer, flagNeed, listNeeds, listOffers, type NeedPublic, type OfferPublic } from "../api";
import { apiErrorMessage } from "../api-error";
import { useGoogleAuth } from "../auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TurnstileWidget } from "../components/turnstile";
import { districtLabels, districtNames } from "../geo";
import { labels } from "../i18n";
import { formStrings } from "../i18n-forms";
import type { Language } from "../types";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

function categoryLabel(cat: string, lang: Language): string {
  const t = labels[lang];
  const map: Record<string, string> = {
    goods: t.categoryGoods,
    shelter: t.categoryShelter,
    transport: t.categoryTransport,
    medical: t.categoryMedical,
    "skilled-labor": t.categorySkilledLabor,
    "funds-guidance": t.categoryFundsGuidance,
  };
  return map[cat] ?? cat;
}

function FlagDialog({ language, needId, open, onClose }: { language: Language; needId: string | null; open: boolean; onClose: () => void }) {
  const t = labels[language];
  const [reason, setReason] = useState<"already_received" | "not_real" | "other">("already_received");
  const [details, setDetails] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("already_received");
      setDetails("");
      setTurnstileToken("");
      setError(null);
      setDone(false);
    }
  }, [open, needId]);

  const handleSubmit = async () => {
    if (!needId) return;
    if (details.length > 500) {
      setError(t.flagDetailsHint);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await flagNeed(needId, { reason, details: details.trim() || undefined, turnstileToken: turnstileToken || undefined });
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle>{t.flagSuccessTitle}</DialogTitle>
              <DialogDescription>{t.flagSuccessBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose}>{t.deskCancel}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t.flagDialogTitle}</DialogTitle>
              <DialogDescription>{t.flagDetailsHint}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="font-sans text-xs font-semibold uppercase tracking-wide">{t.flagReasonLabel}</legend>
                <label className="flex items-center gap-2 font-sans text-sm">
                  <input type="radio" name="flagReason" checked={reason === "already_received"} onChange={() => setReason("already_received")} />
                  {t.flagReasonAlready}
                </label>
                <label className="flex items-center gap-2 font-sans text-sm">
                  <input type="radio" name="flagReason" checked={reason === "not_real"} onChange={() => setReason("not_real")} />
                  {t.flagReasonNotReal}
                </label>
                <label className="flex items-center gap-2 font-sans text-sm">
                  <input type="radio" name="flagReason" checked={reason === "other"} onChange={() => setReason("other")} />
                  {t.flagReasonOther}
                </label>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="flagDetails">{t.flagDetailsLabel}</Label>
                <Textarea id="flagDetails" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder={t.flagDetailsPlaceholder} maxLength={500} />
                <p className="font-sans text-xs text-muted-foreground">{details.length}/500</p>
              </div>
              {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} /> : <p className="font-sans text-xs text-muted-foreground">{t.flagTurnstileHint}</p>}
              {error ? <p className="font-sans text-sm text-destructive" role="alert">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{t.deskCancel}</Button>
              <Button onClick={handleSubmit} disabled={submitting}>{submitting ? t.flagSubmitting : t.flagSubmit}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [flagNeedId, setFlagNeedId] = useState<string | null>(null);

  const [offersDistrict, setOffersDistrict] = useState("");
  const [offersCategory, setOffersCategory] = useState("");
  const [offers, setOffers] = useState<OfferPublic[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const [orgOnBehalf, setOrgOnBehalf] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgContact, setOrgContact] = useState("");
  const [offerCategories, setOfferCategories] = useState<Category[]>([]);
  const [offerDistricts, setOfferDistricts] = useState<string[]>([]);
  const [offerDesc, setOfferDesc] = useState("");
  const [offerPhone, setOfferPhone] = useState("");
  const [offerEmail, setOfferEmail] = useState("");
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);

  const fetchNeeds = async () => {
    setNeedsLoading(true);
    setNeedsError(null);
    try {
      const res = await listNeeds({ district: needsDistrict || undefined, category: needsCategory || undefined });
      setNeeds(res.items);
    } catch (e) {
      setNeedsError(apiErrorMessage(e, language));
      setNeeds([]);
    } finally {
      setNeedsLoading(false);
    }
  };

  const fetchOffers = async () => {
    setOffersLoading(true);
    try {
      const res = await listOffers({ district: offersDistrict || undefined, category: offersCategory || undefined });
      setOffers(res.items);
    } catch {
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    fetchNeeds();
  }, [needsDistrict, needsCategory]);

  useEffect(() => {
    fetchOffers();
  }, [offersDistrict, offersCategory]);

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.idToken) {
      setOfferError(t.giveHelpSignInRequired);
      return;
    }
    if (offerCategories.length === 0) {
      setOfferError(t.getHelpValidationRequired);
      return;
    }
    if (offerDistricts.length === 0) {
      setOfferError(t.getHelpValidationRequired);
      return;
    }
    if (!offerDesc.trim() || !offerPhone.trim()) {
      setOfferError(t.getHelpValidationRequired);
      return;
    }
    if (orgOnBehalf && (!orgName.trim() || !orgContact.trim())) {
      setOfferError(t.getHelpValidationRequired);
      return;
    }
    setOfferSubmitting(true);
    setOfferError(null);
    try {
      const res = await createOffer(auth.idToken, {
        org: orgOnBehalf ? { name: orgName.trim(), contact: orgContact.trim() } : undefined,
        categories: offerCategories,
        districts: offerDistricts,
        description: offerDesc.trim(),
        phone: offerPhone.trim(),
        email: offerEmail.trim() || undefined,
      });
      setOfferSuccess(res.id);
      setOfferDesc("");
      setOfferPhone("");
      setOfferEmail("");
    } catch (err) {
      setOfferError(apiErrorMessage(err, language));
    } finally {
      setOfferSubmitting(false);
    }
  };

  const toggleCategory = (c: Category) => {
    setOfferCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const toggleDistrict = (d: string) => {
    setOfferDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.giveHelpTitle}</h1>
        <p className="mt-3 max-w-2xl font-serif leading-7 text-muted-foreground">{t.giveHelpLead}</p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">{t.giveHelpNeedsBoardTitle}</h2>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[12rem]">
              <Label htmlFor="needsDistrict">{t.giveHelpFilterDistrict}</Label>
              <Select id="needsDistrict" value={needsDistrict} onChange={(e) => setNeedsDistrict(e.target.value)}>
                <option value="">{t.giveHelpAllDistricts}</option>
                {districtNames.map((d) => (
                  <SelectItem key={d} value={d}>
                    {districtLabels[d][language]}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="min-w-[12rem]">
              <Label htmlFor="needsCategory">{t.giveHelpFilterCategory}</Label>
              <Select id="needsCategory" value={needsCategory} onChange={(e) => setNeedsCategory(e.target.value)}>
                <option value="">{t.giveHelpAllCategories}</option>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c, language)}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {needsLoading ? (
          <p className="font-sans text-sm text-muted-foreground">{t.giveHelpLoading}</p>
        ) : needsError ? (
          <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
            {needsError}
          </p>
        ) : needs.length === 0 ? (
          <p className="border border-rule bg-card px-4 py-6 text-center font-sans text-sm text-muted-foreground">{t.giveHelpEmpty}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {needs.map((need) => (
              <Card key={need.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{categoryLabel(need.category, language)}</Badge>
                    <span className="font-sans text-xs text-muted-foreground">{need.district} · W{need.ward}</span>
                  </div>
                  <CardTitle className="text-base">{need.maskedName}</CardTitle>
                  <CardDescription className="font-sans text-xs">{new Date(need.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="line-clamp-4 font-serif text-sm leading-6">{need.description}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const url = `${window.location.origin}/get-help?need=${encodeURIComponent(need.id)}`;
                        try {
                          await navigator.clipboard.writeText(url);
                          setShareCopied(need.id);
                          setTimeout(() => setShareCopied(null), 2000);
                        } catch {
                          window.prompt("Share link", url);
                        }
                      }}
                    >
                      {shareCopied === need.id ? t.giveHelpShareCopied : t.giveHelpShare}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFlagNeedId(need.id)}>
                      {t.flagReportProblem}
                    </Button>
                    <Badge variant="outline" className="ml-auto capitalize">
                      {need.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <FlagDialog language={language} needId={flagNeedId} open={!!flagNeedId} onClose={() => setFlagNeedId(null)} />

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">{t.giveHelpOfferTitle}</h2>
        <p className="font-sans text-sm text-muted-foreground">{t.giveHelpOfferLead}</p>

        {!auth.idToken ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.giveHelpSignInRequired}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {auth.clientId ? (
                <Button onClick={auth.signIn} className="w-full max-w-[280px]" aria-label="Continue with Google">
                  {t.deskContinueWithGoogle}
                </Button>
              ) : (
                <p className="font-sans text-sm text-muted-foreground">{t.deskNotConfigured}</p>
              )}
              {auth.error ? (
                <p className="font-sans text-sm text-destructive" role="alert">
                  {t.deskSignInFailed}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : offerSuccess ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.giveHelpOfferSuccessTitle}</CardTitle>
              <CardDescription>{t.giveHelpOfferSuccessBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border border-ink bg-paper p-3 text-center" role="status">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-muted">{ts.offerReferenceLabel}</p>
                <p className="mt-2 break-all font-mono text-lg font-bold tracking-widest text-ink">{offerSuccess}</p>
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">{ts.offerWhatNextTitle}</h3>
                <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">{ts.offerWhatNextBody}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <form onSubmit={handleOfferSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="orgCheck" checked={orgOnBehalf} onChange={(e) => setOrgOnBehalf(e.target.checked)} />
                  <Label htmlFor="orgCheck">{t.giveHelpOrgCheckbox}</Label>
                </div>
                {orgOnBehalf ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">{t.giveHelpOrgName} *</Label>
                      <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required={orgOnBehalf} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgContact">{t.giveHelpOrgContact} *</Label>
                      <Input id="orgContact" value={orgContact} onChange={(e) => setOrgContact(e.target.value)} required={orgOnBehalf} />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>{t.giveHelpCategories} *</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <label key={c} className={`cursor-pointer border px-3 py-2 font-sans text-xs ${offerCategories.includes(c) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}>
                        <input type="checkbox" className="sr-only" checked={offerCategories.includes(c)} onChange={() => toggleCategory(c)} />
                        {categoryLabel(c, language)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.giveHelpDistricts} *</Label>
                  <div className="flex flex-wrap gap-2">
                    {districtNames.map((d) => (
                      <label key={d} className={`cursor-pointer border px-3 py-2 font-sans text-xs ${offerDistricts.includes(d) ? "border-ink bg-ink text-paper" : "border-rule bg-paper"}`}>
                        <input type="checkbox" className="sr-only" checked={offerDistricts.includes(d)} onChange={() => toggleDistrict(d)} />
                        {districtLabels[d][language]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerDesc">{t.giveHelpDescriptionLabel} *</Label>
                  <Textarea id="offerDesc" value={offerDesc} onChange={(e) => setOfferDesc(e.target.value)} rows={3} placeholder={t.giveHelpDescriptionHint} required />
                  <p className="font-sans text-xs text-muted-foreground">{t.giveHelpDescriptionHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerPhone">{t.giveHelpPhone} *</Label>
                  <Input id="offerPhone" value={offerPhone} onChange={(e) => setOfferPhone(e.target.value)} inputMode="tel" required />
                  <p className="font-sans text-xs text-muted-foreground">{t.giveHelpPhoneHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerEmail">{t.giveHelpEmail}</Label>
                  <Input id="offerEmail" value={offerEmail} onChange={(e) => setOfferEmail(e.target.value)} type="email" />
                </div>

                {offerError ? (
                  <p className="border border-destructive bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive" role="alert">
                    {offerError}
                  </p>
                ) : null}

                <Button type="submit" disabled={offerSubmitting} className="w-full">
                  {offerSubmitting ? "…" : t.giveHelpSubmitOffer}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={auth.signOut} className="w-full">
                  {t.deskSignOut}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">{t.giveHelpOffersBoardTitle}</h2>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[11rem]">
              <Label htmlFor="offersDistrict">{t.giveHelpFilterDistrict}</Label>
              <Select id="offersDistrict" value={offersDistrict} onChange={(e) => setOffersDistrict(e.target.value)}>
                <option value="">{t.giveHelpAllDistricts}</option>
                {districtNames.map((d) => (
                  <SelectItem key={d} value={d}>
                    {districtLabels[d][language]}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="min-w-[11rem]">
              <Label htmlFor="offersCategory">{t.giveHelpFilterCategory}</Label>
              <Select id="offersCategory" value={offersCategory} onChange={(e) => setOffersCategory(e.target.value)}>
                <option value="">{t.giveHelpAllCategories}</option>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {categoryLabel(c, language)}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </div>
        {offersLoading ? (
          <p className="font-sans text-sm text-muted-foreground">{t.giveHelpLoading}</p>
        ) : offers.length === 0 ? (
          <p className="border border-rule bg-card px-4 py-6 text-center font-sans text-sm text-muted-foreground">{t.giveHelpOffersEmpty}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {offers.map((o) => (
              <Card key={o.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{o.helperLabel}</CardTitle>
                  {o.org ? <CardDescription>{o.org.name}</CardDescription> : null}
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-serif text-sm leading-6">{o.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {o.categories.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">
                        {categoryLabel(c, language)}
                      </Badge>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-muted-foreground">
                    {o.districts.join(" · ")} · {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
