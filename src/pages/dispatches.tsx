import { useEffect, useRef, useState } from "react";
import { ApiError, createDispatch, DISPATCH_TAGS, listDispatches, type DispatchPublicItem, type DispatchTag } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { formatDateTime, localizedText } from "@/lib/format";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TurnstileWidget } from "@/components/turnstile";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
function tagLabel(tag: DispatchTag, language: Language) {
  const t = communityStrings[language];
  return {
    climate: t.tagClimate,
    mountains: t.tagMountains,
    floods: t.tagFloods,
    landslides: t.tagLandslides,
    glaciers: t.tagGlaciers,
    community: t.tagCommunity,
    story: t.tagStory,
  }[tag];
}

export function DispatchesPage({ language }: { language: Language }) {
  const t = communityStrings[language];
  const formRef = useRef<HTMLDivElement>(null);
  const [activeTag, setActiveTag] = useState("");
  const [items, setItems] = useState<DispatchPublicItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [place, setPlace] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState<DispatchTag[]>([]);
  const [formLanguage, setFormLanguage] = useState<"en" | "ne">(language);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchList = async (next?: string, append = false) => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const response = await listDispatches({ tag: activeTag || undefined, cursor: next });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setCursor(response.cursor);
    } catch (cause) {
      const api = cause as ApiError;
      setError(apiErrorMessage(cause, language));
      setOffline(api.status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeTag]);
  useEffect(() => setFormLanguage(language), [language]);
  const toggleTag = (tag: DispatchTag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : current.length < 3 ? [...current, tag] : current,
    );
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (
      !title.trim() ||
      !body.trim() ||
      !displayName.trim() ||
      !email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !tags.length ||
      body.length > 6000 ||
      (TURNSTILE_KEY && !turnstileToken)
    ) {
      setFormError(t.dispatchValidation);
      return;
    }
    setSubmitting(true);
    try {
      await createDispatch({
        title: title.trim(),
        body: body.trim(),
        author: { displayName: displayName.trim(), place: place.trim() || undefined, email: email.trim() },
        tags,
        language: formLanguage,
        turnstileToken: turnstileToken || undefined,
      });
      setSuccess(true);
      setTitle("");
      setBody("");
      setDisplayName("");
      setPlace("");
      setEmail("");
      setTags([]);
      setTurnstileToken("");
    } catch (cause) {
      setFormError((cause as ApiError).status === 0 ? t.dispatchOffline : apiErrorMessage(cause, language));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={t.communityEyebrow}
        title={t.dispatchesTitle}
        description={t.dispatchesLead}
        actions={<Button onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>{t.writeDispatch}</Button>}
      />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <span className="mr-2 text-sm font-semibold">{t.dispatchFilter}</span>
          <Button type="button" size="sm" variant={activeTag === "" ? "default" : "secondary"} onClick={() => setActiveTag("")}>
            {t.dispatchAll}
          </Button>
          {DISPATCH_TAGS.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={activeTag === tag ? "default" : "secondary"}
              onClick={() => setActiveTag(tag)}
            >
              {tagLabel(tag, language)}
            </Button>
          ))}
        </CardContent>
      </Card>
      {loading && items.length === 0 ? <LoadingState label={t.dispatchLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {offline ? ` ${t.offline}` : ""}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void fetchList()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !items.length ? <EmptyState title={t.dispatchEmpty} description={t.offline} /> : null}
      <div className="divide-y border-y">
        {items.map((item) => {
          const url = `/dispatches/${encodeURIComponent(item.id)}`;
          return (
            <article key={item.id} className="space-y-3 py-6">
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tagLabel(tag, language)}
                  </Badge>
                ))}
              </div>
              <a href={url} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <h2 className="line-clamp-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {localizedText(item.title, language)}
                </h2>
                <p className="mt-2 line-clamp-3 text-base leading-7 text-muted-foreground">{localizedText(item.excerpt, language)}</p>
              </a>
              <p className="text-sm text-muted-foreground">
                {t.dispatchBy} {item.author.displayName}
                {item.author.place ? ` · ${item.author.place}` : ""} ·{" "}
                <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt, language)}</time>
              </p>
              <Button asChild variant="link" className="h-auto px-0">
                <a href={url}>{t.dispatchRead} →</a>
              </Button>
            </article>
          );
        })}
      </div>
      {cursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void fetchList(cursor, true)} disabled={loading}>
            {t.dispatchLoadMore}
          </Button>
        </div>
      ) : null}
      <div ref={formRef} className="scroll-mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.dispatchTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 rounded-lg border bg-secondary p-6 text-center">
                <p className="text-lg font-semibold">{t.dispatchReceived}</p>
                <p className="text-sm text-muted-foreground">{t.dispatchReceivedBody}</p>
                <Button variant="secondary" onClick={() => setSuccess(false)}>
                  {t.writeDispatch}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="dispatch-title">{t.dispatchTitleField} *</Label>
                    <Input id="dispatch-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="dispatch-body">{t.dispatchBody} *</Label>
                    <Textarea
                      id="dispatch-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={6000}
                      rows={10}
                      required
                    />
                    <div className="flex justify-between gap-3 text-sm text-muted-foreground">
                      <span>{t.dispatchBodyHint}</span>
                      <span className={body.length > 5900 ? "text-destructive" : ""}>{body.length} / 6,000</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispatch-name">{t.dispatchDisplayName} *</Label>
                    <Input id="dispatch-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispatch-place">{t.dispatchPlace}</Label>
                    <Input id="dispatch-place" value={place} onChange={(e) => setPlace(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispatch-email">{t.dispatchEmail} *</Label>
                    <Input id="dispatch-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <p className="text-sm text-muted-foreground">{t.dispatchEmailHint}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispatch-language">{t.dispatchLanguage}</Label>
                    <NativeSelect
                      id="dispatch-language"
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value as "en" | "ne")}
                    >
                      <NativeSelectOption value="en">{t.dispatchEnglish}</NativeSelectOption>
                      <NativeSelectOption value="ne">{t.dispatchNepali}</NativeSelectOption>
                    </NativeSelect>
                  </div>
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">{t.dispatchTags} *</legend>
                  <div className="flex flex-wrap gap-2">
                    {DISPATCH_TAGS.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        size="sm"
                        variant={tags.includes(tag) ? "default" : "secondary"}
                        disabled={!tags.includes(tag) && tags.length >= 3}
                        onClick={() => toggleTag(tag)}
                        aria-pressed={tags.includes(tag)}
                      >
                        {tagLabel(tag, language)}
                      </Button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.dispatchTagsHint} · {tags.length}/3
                  </p>
                </fieldset>
                {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} /> : null}
                {formError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" size="lg" disabled={submitting} className="w-full">
                  {submitting ? t.dispatchSubmitting : t.dispatchSubmit}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
