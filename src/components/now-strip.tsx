import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
import { getLedger, postArticleShare } from "@/lib/api";
import { useLiveData } from "@/lib/live";
import type { Language } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format-date";
import { normaliseNowItems, nowEmptyMessage, nowShareText, type NowItem, type NowLedgerItem } from "@/lib/now-items";
import { nowStrings } from "@/i18n/now";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { SectionHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

interface StripSources {
  ledger: NowLedgerItem[];
}

// Share the in-flight pair across StrictMode mounts; each source can succeed independently.
let sourcesRequest: Promise<StripSources> | null = null;
function loadSources() {
  if (!sourcesRequest) {
    sourcesRequest = getLedger({}).then((ledger) => ({ ledger: ledger.items })).catch(() => ({ ledger: [] }))
      .finally(() => { sourcesRequest = null; });
  }
  return sourcesRequest;
}

export function NowStrip({ language }: { language: Language }) {
  const official = useLiveData().officialUpdates;
  const t = nowStrings[language];
  const [sources, setSources] = useState<StripSources>({ ledger: [] });
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const latestAt = useRef<string | null>(null);
  const feed = normaliseNowItems({ official: official ?? [], ...sources }, language);
  useEffect(() => {
    if (feed.latestAt) latestAt.current = feed.latestAt;
  }, [feed.latestAt]);
  useEffect(() => {
    let active = true;
    loadSources().then((value) => {
      if (active) {
        setSources(value);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);
  const rows = showAll ? feed.all : feed.visible;

  return (
    <section className="bg-secondary" aria-labelledby="now-title">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <SectionHeader id="now-title" title={t.nowTitle} />
        <Card className="mt-5">
          <CardContent className="p-0">
            {rows.length ? (
              <ul className="divide-y">
                {rows.map((item) => <NowRow key={item.id} item={item} language={language} />)}
              </ul>
            ) : loading ? (
              <LoadingState label={t.loading} className="m-5" />
            ) : (
              <EmptyState title={nowEmptyMessage(latestAt.current, language)} className="m-5" />
            )}
            {!showAll && feed.all.length > feed.visible.length ? (
              <div className="p-5">
                {/* ponytail: Expand the fetched rows here until G-1 permits a public Now archive. */}
                <Button type="button" className="w-full sm:w-auto" onClick={() => setShowAll(true)}>{t.nowSeeAll}</Button>
              </div>
            ) : null}
            <ul className="divide-y border-t">
              {feed.standing.map((item) => (
                <li key={item.id} className="px-5 py-2">
                  <Button asChild variant="link" className="min-h-11 max-w-full justify-start px-0">
                    <a href={item.href}>{item.title}</a>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function NowRow({ item, language }: { item: NowItem; language: Language }) {
  const t = nowStrings[language];
  const [expanded, setExpanded] = useState(false);
  const relativeTime = formatRelativeTime(item.happenedAt, language);
  const bodyId = `now-body-${item.id}`;
  const external = item.href.startsWith("https://") || item.href.startsWith("http://");
  const externalSource = item.source.url?.startsWith("https://") || item.source.url?.startsWith("http://");
  return (
    <li className="flex min-w-0 flex-col gap-2 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" lang={item.language}>{item.language === "ne" ? t.languageNe : t.languageEn}</Badge>
        {item.trust ? (
          <span title={item.trust === "checked" ? t.checkedTooltip : undefined}>
            <StatusBadge tone={item.trust === "official" ? "info" : "success"}>
              {item.trust === "official" ? t.officialSource : t.checked}
            </StatusBadge>
          </span>
        ) : null}
        <time dateTime={item.happenedAt ?? undefined} className="text-xs text-muted-foreground">{relativeTime}</time>
      </div>
      {item.place ? <p className="break-words text-sm text-muted-foreground">{item.place}</p> : null}
      <h3 className="text-base font-semibold">
        <a
          href={item.href}
          lang={item.kind === "delivery" ? language : item.language}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="flex min-h-11 items-center break-words rounded-md py-2 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.title}
        </a>
      </h3>
      {item.body ? (
        <div>
          <p id={bodyId} lang={item.language} className={`${expanded ? "" : "line-clamp-3 "}whitespace-pre-line break-words text-sm text-muted-foreground`}>{item.body}</p>
          <Button type="button" variant="link" className="min-h-11 max-w-full px-0" aria-controls={bodyId} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t.hideBody : t.showBody}
          </Button>
        </div>
      ) : null}
      {item.source.url ? (
        <Button asChild variant="link" className="min-h-11 max-w-full self-start px-0">
          <a href={item.source.url} target={externalSource ? "_blank" : undefined} rel={externalSource ? "noopener noreferrer" : undefined}>
            <span className="min-w-0 break-words">{item.source.label}</span>
            {externalSource ? <ExternalLink aria-hidden="true" /> : null}
          </a>
        </Button>
      ) : <p className="break-words text-sm text-muted-foreground">{item.source.label}</p>}
      <RowShare item={item} language={language} />
    </li>
  );
}

function RowShare({ item, language }: { item: NowItem; language: Language }) {
  const t = nowStrings[language];
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const text = nowShareText(item, language, window.location.origin);
  const encoded = encodeURIComponent(text);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <div className="flex flex-wrap items-start gap-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="min-h-11 max-w-full px-3">
          <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />{t.whatsapp}</a>
        </Button>
        <Button asChild size="sm" variant="outline" className="min-h-11 max-w-full px-3">
          <a href={`viber://forward?text=${encoded}`}><Send aria-hidden="true" />{t.viber}</a>
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11 max-w-full px-3" onClick={copy}>
          <Copy aria-hidden="true" />{t.copy}
        </Button>
      </div>
      {copyState === "copied" ? <p role="status" className="text-sm text-muted-foreground">{t.copied}</p> : null}
      {copyState === "failed" ? <Alert variant="destructive"><AlertDescription>{t.copyFailed}</AlertDescription></Alert> : null}
    </div>
  );
}
