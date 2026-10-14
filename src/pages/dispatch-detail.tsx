import { useEffect, useState } from "react";
import { Check, Copy, Eye, Heart, Printer, Share2 } from "lucide-react";
import {
  ApiError,
  getDispatch,
  postArticleLike,
  postArticleShare,
  postArticleView,
  type DispatchDetailResponse,
  type DispatchTag,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { articlesPublicStrings } from "@/i18n/articles-public";
import { communityStrings } from "@/i18n/community";
import { formatDateTime, formatNumber, localizedText } from "@/lib/format";
import { formatBsDate, formatRelativeTime } from "@/lib/format-date";
import { municipalityById, municipalityLabel } from "@/lib/admin-units";
import { districtLabels, type DistrictName } from "@/lib/districts";
import { TextShareRow } from "@/components/share-button";
import { AdSlot } from "@/components/ad-slot";
import { StatusBadge } from "@/components/status-badge";
import { useGoogleAuth } from "@/lib/auth";
import type { Language } from "@/lib/types";
import { ArticleBody } from "@/articles/render";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState, LoadingState } from "@/components/empty-state";

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

function storageKey(kind: "view" | "like", id: string) {
  return `vn:article-${kind}:${id}`;
}

function readAnonymousLike(id: string) {
  try {
    return localStorage.getItem(storageKey("like", id)) === "1";
  } catch {
    return false;
  }
}

export function DispatchDetail({ language, id }: { language: Language; id: string }) {
  const t = articlesPublicStrings[language];
  const auth = useGoogleAuth();
  const [item, setItem] = useState<DispatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      setItem(await getDispatch(id));
    } catch (cause) {
      const api = cause as ApiError;
      setError(api.status === 404 ? t.notFound : apiErrorMessage(cause, language));
      setOffline(api.status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, language]);

  useEffect(() => {
    if (!item || item.id !== id) return;
    setLikeCount(item.likes ?? 0);
    setShareCount(item.shares ?? 0);
    setLiked(!auth.idToken && readAnonymousLike(item.id));
  }, [auth.idToken, item]);

  useEffect(() => {
    if (!item) return;
    const key = storageKey("view", id);
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    void postArticleView(id).catch(() => {});
  }, [id, item]);

  if (loading) return <LoadingState label={t.loading} />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {offline ? ` ${t.offline}` : ""}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
        <Button asChild variant="secondary">
          <a href="/articles">{t.back}</a>
        </Button>
      </div>
    );
  if (!item)
    return (
      <EmptyState
        title={t.notFound}
        action={
          <Button asChild>
            <a href="/articles">{t.back}</a>
          </Button>
        }
      />
    );

  const isLocalUpdate = item.kind === "news";
  const contentLanguage = isLocalUpdate ? item.language || language : language;
  const municipality = item.locality ? municipalityById(Number(item.locality.municipalityId)) : undefined;
  const locality = item.locality ? [
    districtLabels[item.locality.district as DistrictName]?.[language] || item.locality.district,
    municipality?.district === item.locality.district ? municipalityLabel(municipality, language) : "",
    item.locality.ward == null ? "" : `${t.ward} ${formatNumber(item.locality.ward, language)}`,
  ].filter(Boolean).join(" · ") : "";
  const title = localizedText(item.title, contentLanguage);
  const timestamp = isLocalUpdate ? item.happenedAt : item.publishedAt;
  const url = `${window.location.origin}/articles/${encodeURIComponent(item.id)}`;
  const trackShare = () => {
    setShareCount((count) => count + 1);
    void postArticleShare(item.id).catch(() => setShareCount((count) => Math.max(0, count - 1)));
  };
  const copy = async () => {
    trackShare();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* text remains available through the page URL */
    }
  };
  const toggleLike = async () => {
    if (likeBusy) return;
    const previousLiked = liked;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    setLikeBusy(true);
    try {
      const response = auth.idToken
        ? await postArticleLike(item.id, auth.idToken)
        : await postArticleLike(item.id, undefined, previousLiked ? { undo: true } : {});
      setLikeCount(Math.max(0, response.likes));
      if (auth.idToken) setLiked(response.liked ?? nextLiked);
      else {
        try {
          if (nextLiked) localStorage.setItem(storageKey("like", item.id), "1");
          else localStorage.removeItem(storageKey("like", item.id));
        } catch {}
      }
    } catch {
      setLiked(previousLiked);
      setLikeCount((count) => Math.max(0, count + (previousLiked ? 1 : -1)));
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <article className="mx-auto max-w-3xl space-y-8 print:max-w-none">
      <Button asChild variant="link" className="h-auto min-h-11 px-0 print:hidden">
        <a href="/articles">← {t.back}</a>
      </Button>
      <PageHeader
        eyebrow={isLocalUpdate ? t.localUpdate : t.eyebrow}
        title={<span lang={contentLanguage}>{title}</span>}
        description={`${t.by} ${item.author.displayName}${item.author.place ? ` · ${item.author.place}` : ""}${isLocalUpdate ? "" : ` · ${formatDateTime(item.publishedAt, language)} · ${formatRelativeTime(item.publishedAt, language)}`}`}
      />
      {isLocalUpdate ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {locality ? <Badge variant="secondary" className="whitespace-normal">{locality}</Badge> : null}
            <Badge variant="outline" lang={item.language || language}>{(item.language || language) === "ne" ? t.languageNe : t.languageEn}</Badge>
            {/* ponytail: Native tooltip avoids another dependency; upgrade to the shared Tooltip when installed. */}
            <span tabIndex={0} title={t.checkedTooltip} aria-label={`${t.checked}: ${t.checkedTooltip}`} className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <StatusBadge tone="success">{t.checked}</StatusBadge>
            </span>
          </div>
          {item.happenedAt ? (
            <p className="text-sm text-muted-foreground">
              {t.happened} <time dateTime={item.happenedAt}>{formatBsDate(item.happenedAt, language)}</time> ({formatRelativeTime(item.happenedAt, language)})
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tagLabel(tag, language)}
          </Badge>
        ))}
      </div>
      {item.cover?.url ? (
        <figure className="space-y-3">
          <img
            src={item.cover.url}
            alt={item.cover.caption || title}
            className="aspect-video w-full rounded-xl object-cover"
          />
          <figcaption className="space-y-1 text-sm text-muted-foreground">
            {item.cover.caption ? <span className="block">{item.cover.caption}</span> : null}
            <span className="block">
              {t.source}: {item.cover.source}
            </span>
          </figcaption>
        </figure>
      ) : null}
      <div className="border-t pt-8 print:border-black">
        <div lang={contentLanguage}><ArticleBody blocks={item.blocks} body={item.body} language={contentLanguage} /></div>
      </div>
      <AdSlot
        key={item.id}
        slot="articleEnd"
        district={isLocalUpdate ? item.locality?.district : undefined}
        municipalityId={isLocalUpdate ? item.locality?.municipalityId : undefined}
        language={language}
      />
      {isLocalUpdate && (item.sourceUrls?.length || item.sourceNote) ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.sources}</h2>
          {item.sourceUrls?.length ? (
            <ul className="flex flex-col gap-1">
              {item.sourceUrls.map((sourceUrl, index) => (
                <li key={`${index}-${sourceUrl}`}>
                  {/^https?:\/\//i.test(sourceUrl) ? (
                    <Button asChild variant="link" className="h-auto min-h-11 max-w-full whitespace-normal px-0 text-left">
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all">{sourceUrl}</a>
                    </Button>
                  ) : <span className="break-all text-sm">{sourceUrl}</span>}
                </li>
              ))}
            </ul>
          ) : null}
          {item.sourceNote ? <p lang={contentLanguage} className="break-words text-sm text-muted-foreground">{item.sourceNote}</p> : null}
        </section>
      ) : null}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-4 text-sm text-muted-foreground"
        aria-label={`${formatNumber(item.views ?? 0, language)} ${t.views}, ${formatNumber(likeCount, language)} ${t.likes}, ${formatNumber(shareCount, language)} ${t.shares}`}
      >
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Eye aria-hidden="true" className="size-4" /> {formatNumber(item.views ?? 0, language)} <span className="sr-only">{t.views}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Heart aria-hidden="true" className="size-4" /> {formatNumber(likeCount, language)} <span className="sr-only">{t.likes}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Share2 aria-hidden="true" className="size-4" /> {formatNumber(shareCount, language)}{" "}
          <span className="sr-only">{t.shares}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant={liked ? "default" : "secondary"} onClick={() => void toggleLike()} disabled={likeBusy} aria-pressed={liked}>
          <Heart aria-hidden="true" />
          {liked ? t.liked : t.like} · {formatNumber(likeCount, language)}
        </Button>
        {!auth.idToken ? (
          <Button
            type="button"
            variant="link"
            className="h-11 px-1"
            onClick={() => void auth.signIn()}
            disabled={!auth.clientId || auth.loading}
          >
            {t.signInToKeepLikes}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <TextShareRow title={title} place={locality || item.author.place} timestamp={timestamp} url={url} language={language} onShare={trackShare} />
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t.copied : t.copyLink}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            trackShare();
            window.print();
          }}
        >
          <Printer aria-hidden="true" />
          {t.print}
        </Button>
      </div>
    </article>
  );
}
