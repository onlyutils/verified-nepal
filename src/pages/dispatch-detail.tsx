import { apiErrorMessage } from "@/lib/api-error";
import { useEffect, useState } from "react";
import { ApiError, getDispatch, type DispatchDetailResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";
import { Headline, Rule } from "@/components/legacy";
import { formatDateTime, localizedText } from "@/lib/format";

function tagLabel(tag: string, t: Record<string,string>): string {
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

export function DispatchDetail({ language, id }: { language: Language; id: string }) {
  const t = labels[language] as Record<string,string>;
  const [item, setItem] = useState<DispatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [offline, setOffline] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true);
    setError(null);
    setOffline(false);
    getDispatch(id).then(res=>{
      if (!cancelled) { setItem(res); setLoading(false); }
    }).catch(e=>{
      if (cancelled) return;
      const err = e as ApiError;
      if (err.status===0 || !navigator.onLine) { setOffline(true); setError(t.dispatchDetailOffline ?? t.dispatchDetailError); }
      else if (err.status===404) setError(t.dispatchDetailNotFound);
      else setError(apiErrorMessage(err, language));
      setLoading(false);
    });
    return ()=>{ cancelled=true };
  }, [id, t.dispatchDetailError, t.dispatchDetailNotFound, t.dispatchDetailOffline]);

  if (loading) return <p className="font-sans text-sm text-muted-foreground-foreground">{t.dispatchDetailLoading}</p>;
  if (error) return <div className="mx-auto max-w-3xl border border-rule bg-card px-4 py-6" role="alert"><p className="font-sans text-sm text-destructive">{error}</p>{offline ? <p className="mt-1 font-sans text-xs text-muted-foreground-foreground">{t.dispatchDetailOffline}</p> : null}<div className="mt-4"><a href="/dispatches" className="font-sans text-sm underline">{t.dispatchDetailBack}</a></div></div>;
  if (!item) return <p className="font-sans text-sm text-muted-foreground-foreground">{t.dispatchDetailNotFound}</p>;

  const url = `${window.location.origin}/dispatches/${encodeURIComponent(item.id)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <a href="/dispatches" className="font-sans text-sm underline print:hidden">{t.dispatchDetailBack}</a>

      <article className="border-b border-rule pb-8 print:border-black">
        <div className="flex flex-wrap gap-1">
          {item.tags.map(tag=> <Badge key={tag} variant="secondary" className="text-[10px] uppercase tracking-wide">{tagLabel(tag, t)}</Badge>)}
        </div>
        <Headline level={2} as="h1" className="mt-3 !text-3xl sm:!text-[2.1rem]">{localizedText(item.title, language)}</Headline>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs uppercase tracking-wide text-muted-foreground-foreground">
          <span>{t.dispatchMetaBy} <span className="font-semibold text-ink">{item.author.displayName}</span>{item.author.place ? <> · {item.author.place}</> : null}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt, language)}</time>
        </div>
        <Rule className="mt-4" />

        <div className="mt-6 font-serif text-[17px] leading-8 text-ink print:text-black print:leading-7">
          <p className="whitespace-pre-wrap break-words">{localizedText(item.body, language)}</p>
        </div>
      </article>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={copy}>{copied ? t.dispatchShareCopied : t.dispatchShareCopy}</Button>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center border border-rule bg-paper px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink hover:border-ink">{t.dispatchShareWhatsapp}</a>
        <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center border border-rule bg-paper px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink hover:border-ink">{t.dispatchShareFacebook}</a>
        <Button variant="outline" size="sm" onClick={()=>window.print()}>{t.dispatchPrint}</Button>
      </div>

      <style>{`@media print {
        header, nav, footer, .no-print { display: none !important; }
        body { background: white !important; color: black !important; }
        a { color: black !important; }
      }`}</style>
    </div>
  );
}
