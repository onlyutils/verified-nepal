import { useEffect, useState } from "react";
import { ApiError, getDispatch, type DispatchDetailResponse, type DispatchTag } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { formatDateTime, localizedText } from "@/lib/format";
import type { Language } from "@/lib/types";
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

export function DispatchDetail({ language, id }: { language: Language; id: string }) {
  const t = communityStrings[language];
  const [item, setItem] = useState<DispatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      setItem(await getDispatch(id));
    } catch (cause) {
      const api = cause as ApiError;
      setError(api.status === 404 ? t.dispatchNotFound : apiErrorMessage(cause, language));
      setOffline(api.status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, language]);
  if (loading) return <LoadingState label={t.dispatchLoading} />;
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
          <a href="/articles">{t.dispatchBack}</a>
        </Button>
      </div>
    );
  if (!item)
    return (
      <EmptyState
        title={t.dispatchNotFound}
        action={
          <Button asChild>
            <a href="/articles">{t.dispatchBack}</a>
          </Button>
        }
      />
    );
  const url = `${window.location.origin}/articles/${encodeURIComponent(item.id)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* text remains available through the page URL */
    }
  };
  return (
    <article className="mx-auto max-w-3xl space-y-8 print:max-w-none">
      <Button asChild variant="link" className="h-auto min-h-11 px-0 print:hidden">
        <a href="/articles">← {t.dispatchBack}</a>
      </Button>
      <PageHeader
        eyebrow={t.communityEyebrow}
        title={localizedText(item.title, language)}
        description={`${t.dispatchBy} ${item.author.displayName}${item.author.place ? ` · ${item.author.place}` : ""} · ${formatDateTime(item.publishedAt, language)}`}
      />
      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tagLabel(tag, language)}
          </Badge>
        ))}
      </div>
      <div className="border-t pt-8 text-base leading-8 print:border-black">
        <p className="whitespace-pre-wrap break-words">{localizedText(item.body, language)}</p>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? t.dispatchCopied : t.dispatchCopy}
        </Button>
        <Button asChild variant="outline">
          <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            {t.shareWhatsapp}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
            {t.shareFacebook}
          </a>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          {t.dispatchPrint}
        </Button>
      </div>
    </article>
  );
}
