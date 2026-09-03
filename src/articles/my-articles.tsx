import { useCallback, useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
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

export function MyArticlesPage({ language }: { language: Language }) {
  const t = articlesEditorStrings[language];
  const auth = useGoogleAuth();
  const [items, setItems] = useState<MyArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.idToken) return;
    setError(null);
    try {
      setItems((await listMyArticles(auth.idToken)).items);
    } catch (cause) {
      setError(apiErrorMessage(cause, language) || t.listLoadError);
    }
  }, [auth.idToken, language, t.listLoadError]);

  useEffect(() => {
    if (auth.idToken) void load();
    else setItems(null);
  }, [auth.idToken, load]);

  const create = async () => {
    if (!auth.idToken) return;
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
        eyebrow={t.eyebrow}
        title={t.listTitle}
        actions={
          <Button type="button" disabled={busy === "new"} onClick={() => void create()}>
            <Plus aria-hidden="true" />
            {t.newArticle}
          </Button>
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
          action={
            <Button type="button" onClick={() => void create()}>
              {t.newArticle}
            </Button>
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
          <p className="text-sm text-muted-foreground">{counters}</p>
          {item.rejectReason ? (
            <p className="text-sm text-destructive">
              <span className="font-semibold">{t.rejectedReason}:</span> {item.rejectReason}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/me/articles/${encodeURIComponent(item.id)}/edit`}>{t.edit}</a>
            </Button>
            {item.status !== "published" ? (
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
