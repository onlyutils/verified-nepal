import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, listDispatches, type DispatchPublicItem } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { formatBsDate, formatRelativeTime } from "@/lib/format-date";
import { localUpdateNowItem, sortNowItems } from "@/lib/now-items";
import type { Language } from "@/lib/types";
import { labels } from "@/i18n";
import { localUpdatesStrings } from "@/i18n/local-updates";
import { nowStrings } from "@/i18n/now";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function LocalUpdatesPage({ language }: { language: Language }) {
  const t = localUpdatesStrings[language];
  const n = nowStrings[language];
  const [items, setItems] = useState<DispatchPublicItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  const [offline, setOffline] = useState(false);
  const requestId = useRef(0);

  const fetchList = useCallback(async (next?: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const response = await listDispatches({ kind: "news", cursor: next });
      if (currentRequest !== requestId.current) return;
      const updates = response.items.filter((item) => item.kind === "news");
      setItems((current) => [...new Map((next ? [...current, ...updates] : updates).map((item) => [item.id, item])).values()]);
      setCursor(response.cursor);
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setError({ cause });
      setOffline((cause instanceof ApiError && cause.status === 0) || !navigator.onLine);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
    return () => { requestId.current++; };
  }, [fetchList]);

  const rows = sortNowItems(items.map((item) => localUpdateNowItem(item, language)));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 break-words">
      <PageHeader title={t.title} description={t.description} />
      {loading && !rows.length ? <LoadingState label={t.loading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {apiErrorMessage(error.cause, language)} {offline ? t.offline : null}
            <span className="mt-2 block">
              <Button type="button" variant="secondary" onClick={() => void fetchList(cursor)} disabled={loading}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !rows.length ? <EmptyState title={t.empty} /> : null}
      {rows.length ? (
        <Card aria-busy={loading}>
          <CardContent className="p-0">
            <ul className="divide-y">
              {rows.map((item) => (
                <li key={item.id} className="flex min-w-0 flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" lang={item.language}>{item.language === "ne" ? n.languageNe : n.languageEn}</Badge>
                    {item.trust ? (
                      <StatusBadge tone={item.trust === "official" ? "info" : "success"}>
                        {item.trust === "official" ? n.officialSource : n.checked}
                      </StatusBadge>
                    ) : null}
                  </div>
                  {item.place ? <p className="break-words text-sm text-muted-foreground">{item.place}</p> : null}
                  <p className="text-sm text-muted-foreground">
                    <time dateTime={item.happenedAt ?? undefined}>{formatBsDate(item.happenedAt, language)}</time>
                    {" · "}{formatRelativeTime(item.happenedAt, language)}
                  </p>
                  <h2 className="min-w-0 text-lg font-bold">
                    <a href={item.href} lang={item.language} className="block min-h-11 break-words rounded-md py-2 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {item.title}
                    </a>
                  </h2>
                  {item.shareCard?.message ? <p lang={item.language} className="line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{item.shareCard.message}</p> : null}
                  {item.source.url ? (
                    <Button asChild variant="link" className="min-h-11 max-w-full self-start px-0">
                      <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="break-words text-left">{item.source.label}</a>
                    </Button>
                  ) : <p className="break-words text-sm text-muted-foreground">{item.source.label}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {cursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => void fetchList(cursor)} disabled={loading}>
            {loading ? t.loading : t.loadMore}
          </Button>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle><h2 className="text-lg leading-normal">{t.nextAction}</h2></CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="w-full sm:w-auto" onClick={() => navigate("/get-help")}>{labels[language].getHelp}</Button>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => navigate("/give-help")}>{labels[language].giveHelp}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
