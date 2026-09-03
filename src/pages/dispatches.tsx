import { useCallback, useEffect, useState } from "react";
import { Eye, Heart, Share2 } from "lucide-react";
import { ApiError, DISPATCH_TAGS, listDispatches, type DispatchPublicItem, type DispatchTag } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { articlesPublicStrings } from "@/i18n/articles-public";
import { communityStrings } from "@/i18n/community";
import { formatDateTime, formatNumber, localizedText } from "@/lib/format";
import { useGoogleAuth } from "@/lib/auth";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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

function openArticle(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Counters({ item, language, t }: { item: DispatchPublicItem; language: Language; t: (typeof articlesPublicStrings)["en"] }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
      aria-label={`${item.views ?? 0} ${t.views}, ${item.likes ?? 0} ${t.likes}, ${item.shares ?? 0} ${t.shares}`}
    >
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Eye aria-hidden="true" className="size-4" />
        {formatNumber(item.views ?? 0, language)} <span className="sr-only">{t.views}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Heart aria-hidden="true" className="size-4" />
        {formatNumber(item.likes ?? 0, language)} <span className="sr-only">{t.likes}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Share2 aria-hidden="true" className="size-4" />
        {formatNumber(item.shares ?? 0, language)} <span className="sr-only">{t.shares}</span>
      </span>
    </div>
  );
}

export function DispatchesPage({ language }: { language: Language }) {
  const t = articlesPublicStrings[language];
  const auth = useGoogleAuth();
  const [activeTag, setActiveTag] = useState("");
  const [items, setItems] = useState<DispatchPublicItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const fetchList = useCallback(
    async (next?: string, append = false) => {
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
    },
    [activeTag, language],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const writeArticle = () => {
    if (auth.idToken) {
      openArticle("/me/articles");
      return;
    }
    if (!auth.clientId) {
      openArticle("/me/articles");
      return;
    }
    // ponytail: the auth hook stores the current path as its OAuth return path.
    window.history.replaceState({}, "", "/me/articles");
    void auth.signIn();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.lead}
        actions={
          <Button type="button" onClick={writeArticle}>
            {t.writeArticle}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-y py-4" aria-label={t.filter}>
        <span className="mr-2 text-sm font-semibold">{t.filter}</span>
        <Button type="button" size="sm" variant={activeTag === "" ? "default" : "secondary"} onClick={() => setActiveTag("")}>
          {t.allTags}
        </Button>
        {DISPATCH_TAGS.map((tag) => (
          <Button key={tag} type="button" size="sm" variant={activeTag === tag ? "default" : "secondary"} onClick={() => setActiveTag(tag)}>
            {tagLabel(tag, language)}
          </Button>
        ))}
      </div>
      {loading && items.length === 0 ? <LoadingState label={t.loading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error} {offline ? t.offline : null}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void fetchList()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !items.length ? <EmptyState title={t.empty} description={t.emptyBody} /> : null}
      <div className="divide-y border-y">
        {items.map((item) => {
          const url = `/articles/${encodeURIComponent(item.id)}`;
          return (
            <article key={item.id} className="grid gap-5 py-6 sm:grid-cols-[12rem_1fr] sm:items-start">
              {item.cover?.url ? (
                <a href={url} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <img src={item.cover.url} alt={t.coverAlt} className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
                </a>
              ) : null}
              <div className="min-w-0 space-y-3">
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
                  {t.by} {item.author.displayName}
                  {item.author.place ? ` · ${item.author.place}` : ""} ·{" "}
                  <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt, language)}</time>
                </p>
                <Counters item={item} language={language} t={t} />
                <Button asChild variant="link" className="h-auto min-h-11 px-0">
                  <a href={url}>{t.readArticle} →</a>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {cursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void fetchList(cursor, true)} disabled={loading}>
            {t.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
