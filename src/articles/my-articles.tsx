import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { localStrings } from "@/i18n/local";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import { createArticle, deleteArticle, listMyArticles, type ArticleStatus, type MyArticle } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useGoogleAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import type { Language } from "@/lib/types";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SignInNudge } from "@/components/sign-in-nudge";
import { StatusBadge, toneForStatus } from "@/components/status-badge";

function openArticle(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function MyArticlesPage({ language, localOnly = false, embedded = false }: { language: Language; localOnly?: boolean; embedded?: boolean }) {
  const local = localStrings[language];
  const t = localOnly ? { ...articlesEditorStrings[language], ...local, newArticle: local.title, listLoading: local.loading, listLoadError: local.loadError } : articlesEditorStrings[language];
  const auth = useGoogleAuth();
  const [items, setItems] = useState<MyArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.idToken) return;
    setError(null);
    try {
      setItems((await listMyArticles(auth.idToken)).items.filter((item) => localOnly ? item.kind === "news" : item.kind !== "news"));
    } catch (cause) {
      setError(apiErrorMessage(cause, language) || t.listLoadError);
    }
  }, [auth.idToken, language, localOnly, t.listLoadError]);

  useEffect(() => {
    if (auth.idToken) void load();
    else setItems(null);
  }, [auth.idToken, load]);

  const canWriteUpdate = auth.profile?.role === "admin" || Boolean(auth.profile?.reporter?.approvedAt);
  const create = async () => {
    if (!auth.idToken) return;
    if (localOnly) {
      openArticle("/me/articles/new/edit?kind=news");
      return;
    }
    setBusy("new");
    try {
      const result = await createArticle(auth.idToken, { language });
      openArticle(`/me/articles/${encodeURIComponent(result.id)}/edit`);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: MyArticle) => {
    if (!auth.idToken || !window.confirm(t.deleteConfirm)) return;
    setBusy(item.id);
    try {
      await deleteArticle(auth.idToken, item.id);
      setItems((current) => current?.filter((candidate) => candidate.id !== item.id) ?? current);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
    } finally {
      setBusy(null);
    }
  };

  if (embedded && localOnly && !canWriteUpdate && !items?.length) return null;
  if (auth.loading) return <LoadingState label={t.listLoading} />;
  if (!auth.idToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow={t.eyebrow} title={t.listTitle} />
        <SignInNudge language={language} id="my-articles" title={t.signedOutTitle} body={t.signedOutBody} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        as={embedded ? "h2" : "h1"}
        eyebrow={embedded ? undefined : t.eyebrow}
        title={t.listTitle}
        actions={
          <div className="flex flex-wrap gap-3">
            {!localOnly || canWriteUpdate ? <Button type="button" className={localOnly ? "h-auto min-h-11 whitespace-normal py-3" : undefined} disabled={busy === "new"} onClick={() => void create()}>
              <Plus aria-hidden="true" />
              {t.newArticle}
            </Button> : null}
            {!localOnly && canWriteUpdate ? <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal py-3"><a href="/me/articles/new/edit?kind=news">{local.title}</a></Button> : null}
          </div>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              {t.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!items && !error ? <LoadingState label={t.listLoading} /> : null}
      {items?.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t.empty}
          action={(!localOnly || canWriteUpdate) ?
            <Button type="button" className={localOnly ? "h-auto min-h-11 whitespace-normal py-3" : undefined} onClick={() => void create()}>
              {t.newArticle}
            </Button> : undefined
          }
        />
      ) : null}
      <div className="grid gap-4">
        {items?.map((item) => (
          <ArticleRow key={item.id} item={item} language={language} t={t} busy={busy === item.id} onDelete={() => void remove(item)} />
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: ArticleStatus, t: (typeof articlesEditorStrings)["en"]) {
  return { draft: t.statusDraft, pending: t.statusPending, published: t.statusPublished, rejected: t.statusRejected }[status];
}

function ArticleRow({
  item,
  language,
  t,
  busy,
  onDelete,
}: {
  item: MyArticle;
  language: Language;
  t: (typeof articlesEditorStrings)["en"];
  busy: boolean;
  onDelete: () => void;
}) {
  const counters = t.counters
    .replace("{views}", formatNumber(item.views, language))
    .replace("{likes}", formatNumber(item.likes, language))
    .replace("{shares}", formatNumber(item.shares, language));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        {item.cover?.url ? (
          <img
            src={item.cover.url}
            alt={item.cover.caption || ""}
            className="aspect-video w-full rounded-lg object-cover sm:w-48"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{item.title || t.title}</CardTitle>
            <StatusBadge tone={toneForStatus(item.status)}>{statusLabel(item.status, t)}</StatusBadge>
          </div>
          {item.kind !== "news" ? <p className="text-sm text-muted-foreground">{counters}</p> : null}
          {item.rejectReason ? (
            <p className="text-sm text-destructive">
              <span className="font-semibold">{t.rejectedReason}:</span> {item.rejectReason}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className={item.kind === "news" ? "min-h-11" : undefined}>
              <a
                href={
                  item.kind === "news"
                    ? item.status === "published"
                      ? `/articles/${encodeURIComponent(item.id)}`
                      : `/me/articles/${encodeURIComponent(item.id)}/edit?kind=news`
                    : item.status === "draft" || item.status === "rejected"
                    ? `/me/articles/${encodeURIComponent(item.id)}/edit`
                    : `/articles/${encodeURIComponent(item.id)}`
                }
              >
                {item.status === "draft" || item.status === "rejected" ? t.edit : t.view}
              </a>
            </Button>
            {item.kind !== "news" && item.status !== "published" ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
                {t.delete}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
