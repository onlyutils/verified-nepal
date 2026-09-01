import { useEffect, useState, useRef } from "react";
import { ApiError, createDispatch, DISPATCH_TAGS, listDispatches, type DispatchPublicItem, type DispatchTag } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectItem } from "@/components/ui/select";
import { labels } from "../i18n";
import { apiErrorMessage } from "../api-error";
import type { Language } from "../types";
import { Headline, Rule, SectionLabel } from "../ui";
import { formatDateTime } from "../utils";
import { TurnstileWidget } from "../components/turnstile";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

function tagLabel(tag: DispatchTag, t: Record<string,string>): string {
  const map: Record<string,string> = {
    climate: t.dispatchesTagClimate,
    mountains: t.dispatchesTagMountains,
    floods: t.dispatchesTagFloods,
    landslides: t.dispatchesTagLandslides,
    glaciers: t.dispatchesTagGlaciers,
    community: t.dispatchesTagCommunity,
    story: t.dispatchesTagStory,
  };
  return map[tag] ?? tag;
}

export function DispatchesPage({ language }: { language: Language }) {
  const t = labels[language] as Record<string,string>;
  const [activeTag, setActiveTag] = useState<string>("");
  const [items, setItems] = useState<DispatchPublicItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const fetchList = async (tag: string, cur?: string, append=false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const res = await listDispatches({ tag: tag || undefined, cursor: cur });
      setItems(prev => append ? [...prev, ...res.items] : res.items);
      setCursor(res.cursor);
    } catch (e) {
      if ((e as ApiError).status===0 || !navigator.onLine) {
        setOffline(true);
        setError(t.dispatchesOffline ?? t.dispatchesError);
      } else setError(apiErrorMessage(e, language));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(()=>{ fetchList(activeTag, undefined, false); }, [activeTag]);

  const handleTag = (tag: string) => setActiveTag(tag);

  // form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [place, setPlace] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState<DispatchTag[]>([]);
  const [formLang, setFormLang] = useState<"en"|"ne">(language);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string|null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(()=>{ setFormLang(language); }, [language]);

  const toggleTag = (tag: DispatchTag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(x=>x!==tag) : prev.length >=3 ? prev : [...prev, tag]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !body.trim() || !displayName.trim() || !email.trim() || tags.length===0) {
      setFormError(t.dispatchWriteValidation);
      return;
    }
    if (tags.length>3) { setFormError(t.dispatchWriteValidation); return; }
    if (body.length>6000) { setFormError(t.dispatchWriteValidation); return; }
    // basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFormError(t.dispatchWriteValidation); return; }
    if (TURNSTILE_KEY && !turnstileToken) { setFormError(t.dispatchTurnstileHint); return; }
    setSubmitting(true);
    try {
      await createDispatch({ title: title.trim(), body: body.trim(), author: { displayName: displayName.trim(), place: place.trim() || undefined, email: email.trim() }, tags, language: formLang, turnstileToken: turnstileToken || undefined });
      setFormSuccess(true);
      setTitle(""); setBody(""); setDisplayName(""); setPlace(""); setEmail(""); setTags([]); setTurnstileToken("");
    } catch (err) {
      if ((err as ApiError).status===0) setFormError(t.dispatchWriteOffline);
      else setFormError(apiErrorMessage(err, language));
    } finally { setSubmitting(false); }
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b border-ink pb-6">
        <Headline level={2} as="h1">{t.dispatchesTitle}</Headline>
        <p className="mt-3 max-w-3xl font-serif text-base italic leading-7 text-muted-foreground">{t.dispatchesLead}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={scrollToForm}>{t.dispatchesWriteCta}</Button>
          <span className="inline-flex items-center font-sans text-xs text-muted-foreground">— {language==="ne" ? "हिमाल र जलवायुबारे सम्पादकीय लेखन" : "No comments, no threads, by design."}</span>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.dispatchesFilters}:</span>
          <button
            type="button"
            onClick={()=>handleTag("")}
            aria-pressed={activeTag===""}
            className={` border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide transition-colors ${activeTag==="" ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink hover:border-ink"}`}
          >
            {t.dispatchesAllTags}
          </button>
          {DISPATCH_TAGS.map(tag=>(
            <button
              key={tag}
              type="button"
              onClick={()=>handleTag(tag)}
              aria-pressed={activeTag===tag}
              className={` border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide transition-colors ${activeTag===tag ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink hover:border-ink"}`}
            >
              {tagLabel(tag, t)}
            </button>
          ))}
        </div>
        <Rule />
      </div>

      {loading ? <p className="font-sans text-sm text-muted-foreground">{t.dispatchesLoading}</p> : null}
      {error ? <div className="border border-rule bg-card px-4 py-4" role="alert"><p className="font-sans text-sm text-destructive">{error}</p>{offline ? <p className="mt-1 font-sans text-xs text-muted-foreground">{t.dispatchesOffline}</p> : null}<div className="mt-3"><Button variant="outline" size="sm" onClick={()=>fetchList(activeTag)}>{t.dispatchesTryAgain}</Button></div></div> : null}
      {!loading && !error && items.length===0 ? <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground">{t.dispatchesEmpty}</p> : null}

      <div className="divide-y divide-rule border-y border-rule">
        {items.map(item => {
          const url = `/dispatches/${encodeURIComponent(item.id)}`;
          return (
            <article key={item.id} className="grid gap-2 py-6 sm:py-7">
              <div className="flex flex-wrap gap-1">
                {item.tags.map(tag=> <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">{tagLabel(tag as DispatchTag, t)}</Badge>)}
              </div>
              <a href={url} className="group block">
                <h2 className="font-display text-xl font-bold leading-tight text-ink group-hover:underline sm:text-2xl">{item.title}</h2>
                <p className="mt-2 line-clamp-3 font-serif text-[15px] leading-7 text-ink/90">{item.excerpt}</p>
              </a>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t.dispatchMetaBy} <span className="font-semibold text-ink">{item.author.displayName}</span>{item.author.place ? <> · {item.author.place}</> : null}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt, language)}</time>
              </div>
              <div><a href={url} className="inline-flex items-center font-sans text-xs font-semibold uppercase tracking-wide text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">{t.dispatchesReadMore} <span aria-hidden="true" className="ml-1">→</span></a></div>
            </article>
          );
        })}
      </div>
      {cursor ? <div className="flex justify-center"><Button variant="outline" onClick={()=>fetchList(activeTag, cursor, true)} disabled={loadingMore}>{loadingMore ? t.dispatchesLoading : t.dispatchesLoadMore}</Button></div> : null}

      <div ref={formRef} className="scroll-mt-8 pt-2">
        <SectionLabel>{t.dispatchWriteTitle}</SectionLabel>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-6 text-muted-foreground">{t.dispatchWriteLead}</p>
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">{t.dispatchWriteTitle}</CardTitle></CardHeader>
          <CardContent>
            {formSuccess ? (
              <div className="space-y-4 border border-ink bg-secondary px-4 py-6 text-center">
                <h3 className="font-display text-lg font-bold">{t.dispatchWriteSuccessTitle}</h3>
                <p className="mx-auto max-w-xl font-serif text-sm leading-6 text-ink">{t.dispatchWriteSuccessBody}</p>
                <Button variant="outline" onClick={()=>setFormSuccess(false)}>{t.commonAgain ?? "Again"}</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1">
                    <Label htmlFor="d-title">{t.dispatchWriteTitleLabel} *</Label>
                    <Input id="d-title" value={title} onChange={e=>setTitle(e.target.value)} placeholder={t.dispatchWriteTitlePlaceholder} maxLength={200} required />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label htmlFor="d-body">{t.dispatchWriteBodyLabel} *</Label>
                    <Textarea id="d-body" value={body} onChange={e=>setBody(e.target.value)} placeholder={t.dispatchWriteBodyPlaceholder} rows={10} maxLength={6000} required className="min-h-[180px]" />
                    <div className="flex justify-between">
                      <p className="font-sans text-xs text-muted-foreground">{t.dispatchWriteBodyHint}</p>
                      <p className={`font-sans text-xs ${body.length>5900 ? "text-red" : body.length>5500 ? "text-ink" : "text-muted-foreground"}`}>{body.length} / 6,000</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-name">{t.dispatchWriteDisplayNameLabel} *</Label>
                    <Input id="d-name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder={t.dispatchWriteDisplayNamePlaceholder} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-place">{t.dispatchWritePlaceLabel}</Label>
                    <Input id="d-place" value={place} onChange={e=>setPlace(e.target.value)} placeholder={t.dispatchWritePlacePlaceholder} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-email">{t.dispatchWriteEmailLabel} *</Label>
                    <Input id="d-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={t.dispatchWriteEmailPlaceholder} required />
                    <p className="font-sans text-xs text-muted-foreground">{t.dispatchWriteEmailHint}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="d-lang">{t.dispatchWriteLanguageLabel}</Label>
                    <Select value={formLang} onChange={e=>setFormLang(e.target.value as "en"|"ne")}>
                      <SelectItem value="en">{t.dispatchWriteLanguageEn}</SelectItem>
                      <SelectItem value="ne">{t.dispatchWriteLanguageNe}</SelectItem>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>{t.dispatchWriteTagsLabel} *</Label>
                    <div className="flex flex-wrap gap-2">
                      {DISPATCH_TAGS.map(tag=> {
                        const selected = tags.includes(tag);
                        const disabled = !selected && tags.length>=3;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={()=>toggleTag(tag)}
                            disabled={disabled}
                            aria-pressed={selected}
                            className={` border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wide ${selected ? "border-ink bg-ink text-paper" : disabled ? "border-rule bg-secondary text-muted-foreground opacity-50" : "border-rule bg-paper text-ink hover:border-ink"}`}
                          >
                            {tagLabel(tag, t)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="font-sans text-xs text-muted-foreground">{t.dispatchWriteTagsHint} · {tags.length}/3</p>
                  </div>
                </div>
                {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} /> : null}
                {formError ? <p className="font-sans text-sm text-destructive" role="alert">{formError}</p> : null}
                <Button type="submit" disabled={submitting}>{submitting ? t.dispatchWriteSubmitting : t.dispatchWriteSubmit}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
