import { Fragment, useEffect, useState } from "react";
import { meStrings } from "@/i18n/me";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import { posterStrings } from "@/i18n/poster";
import { labels } from "@/i18n";
import { orgStrings } from "@/i18n/orgs";
import { useGoogleAuth } from "@/lib/auth";
import {
  createArticle,
  deleteMissing,
  getDashboard,
  listMyOrgs,
  putMissing,
  renewNeed,
  saveArticle,
  type Category,
  type DashboardResponse,
  type MissingBody,
  type MyMissing,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import type { Language, Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { SignInNudge } from "@/components/sign-in-nudge";

function categoryLabel(category: Category, language: Language) {
  const t = labels[language];
  return (
    {
      goods: t.categoryGoods,
      shelter: t.categoryShelter,
      transport: t.categoryTransport,
      medical: t.categoryMedical,
      "skilled-labor": t.categorySkilledLabor,
      "funds-guidance": t.categoryFundsGuidance,
    } as Record<Category, string>
  )[category];
}

function statusLabel(status: string, language: Language) {
  const t = labels[language] as Record<string, string>;
  const key = `deskNeedsStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  if (status === "in_progress" || status === "in-progress") return t.inProgress;
  return t[key] ?? t.unavailable;
}

function groupItemStatusLabel(status: string, t: (typeof meStrings)["en"]) {
  if (status === "open") return t.groupsStatusOpen;
  if (status === "claimed") return t.groupsStatusClaimed;
  return t.groupsStatusDone;
}

function timestamp(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function latestTimestamp(values: Array<string | undefined>) {
  return Math.max(0, ...values.map(timestamp));
}

export function MePage({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = meStrings[language];
  const articleT = articlesEditorStrings[language];
  const tl = labels[language];
  const auth = useGoogleAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [orgCount, setOrgCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [renewed, setRenewed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!auth.idToken) {
      setData(null);
      return;
    }
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([getDashboard(auth.idToken), listMyOrgs(auth.idToken).catch(() => ({ items: [] }))])
      .then(([dash, orgs]) => {
        if (cancelled) return;
        setData(dash);
        setOrgCount(orgs.items.length);
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e, language) || t.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.idToken, language, t.loadError]);

  const shareStory = async () => {
    if (!auth.idToken) return;
    setBusy((b) => ({ ...b, story: true }));
    try {
      const { id } = await createArticle(auth.idToken, { language });
      await saveArticle(auth.idToken, id, { tags: ["story"] });
      window.location.assign(`/me/articles/${encodeURIComponent(id)}/edit`);
    } catch (e) {
      setError(apiErrorMessage(e, language));
      setBusy((b) => ({ ...b, story: false }));
    }
  };

  const toggleFound = async (m: MyMissing) => {
    if (!auth.idToken) return;
    setBusy((b) => ({ ...b, [m.id]: true }));
    try {
      const { id, createdAt, updatedAt, ...fields } = m as MyMissing & MissingBody;
      await putMissing(auth.idToken, m.id, { ...fields, status: m.status === "found" ? "missing" : "found" });
      setData(
        (d) =>
          d && {
            ...d,
            missing: d.missing.map((x) => (x.id === m.id ? { ...x, status: m.status === "found" ? "missing" : "found" } : x)),
          },
      );
    } catch {}
    setBusy((b) => ({ ...b, [m.id]: false }));
  };

  const remove = async (id: string) => {
    if (!auth.idToken || !window.confirm(t.posterDeleteConfirm)) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await deleteMissing(auth.idToken, id);
      setData((d) => d && { ...d, missing: d.missing.filter((x) => x.id !== id) });
    } catch {}
    setBusy((b) => ({ ...b, [id]: false }));
  };

  if (auth.loading) return <LoadingState label={t.loading} />;
  if (!auth.idToken) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow={t.eyebrow} title={t.title} />
        <SignInNudge language={language} id="me" title={t.signedOutTitle} body={t.signedOutBody} />
      </div>
    );
  }

  const isModerator = auth.profile?.role === "moderator" || auth.profile?.role === "admin";
  const dashboardSections = data
    ? (() => {
        const needs = [...data.needs].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
        const groups = [...data.groups].sort((a, b) => timestamp(b.joinedAt) - timestamp(a.joinedAt));
        const offers = [...data.offers].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
        const missing = [...data.missing].sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
        return [
          {
            key: "needs",
            hasItems: needs.length > 0,
            latestTimestamp: latestTimestamp(data.needs.map((need) => need.createdAt)),
            render: () => (
              <section className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight">{t.needsTitle}</h2>
                {needs.length === 0 ? (
                  <EmptyState
                    title={t.needsEmpty}
                    action={
                      <Button type="button" onClick={() => navigate("getHelp")}>
                        {t.needsNew}
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {needs.map((need) => (
                      <Card key={need.id}>
                        <CardHeader>
                          <CardTitle className="font-mono tracking-widest">{need.refCode}</CardTitle>
                          <CardDescription>
                            {need.district ?? tl.unavailable}
                            {need.ward ? ` · ${t.ward} ${need.ward}` : ""}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-3">
                          <StatusBadge tone={toneForStatus(need.status)}>{statusLabel(need.status, language)}</StatusBadge>
                          {need.expiresAt ? (
                            <span className="text-sm text-muted-foreground">
                              {t.needExpires.replace("{date}", formatDateTime(need.expiresAt, language))}
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={renewed[need.id]}
                            onClick={() =>
                              renewNeed(need.refCode)
                                .then(() => setRenewed((current) => ({ ...current, [need.id]: true })))
                                .catch(() => {})
                            }
                          >
                            {renewed[need.id] ? t.needRenewed : t.needRenew}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            key: "groups",
            hasItems: groups.length > 0,
            latestTimestamp: latestTimestamp(
              data.groups.flatMap((group) => [group.joinedAt, ...group.myItems.flatMap((item) => [item.claimedAt, item.doneAt])]),
            ),
            render: () => (
              <section className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight">{t.groupsTitle}</h2>
                {groups.length === 0 ? (
                  <EmptyState title={t.groupsEmpty} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map((group) => (
                      <Card key={group.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{group.groupName ?? t.groupsTitle}</CardTitle>
                          <CardDescription>{group.district ?? tl.unavailable}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {group.myItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t.groupsNoItems}</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {group.myItems.map((item) => (
                                <li key={item.itemId} className="flex items-center justify-between gap-2">
                                  <span>{item.description}</span>
                                  <Badge variant={item.status === "done" ? "default" : "secondary"}>
                                    {groupItemStatusLabel(item.status, t)}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            key: "offers",
            hasItems: offers.length > 0,
            latestTimestamp: latestTimestamp(data.offers.map((offer) => offer.createdAt)),
            render: () => (
              <section className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight">{t.offersTitle}</h2>
                {offers.length === 0 ? (
                  <EmptyState
                    title={t.offersEmpty}
                    action={
                      <Button type="button" onClick={() => navigate("giveHelp")}>
                        {t.offersNew}
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {offers.map((offer) => (
                      <Card key={offer.id}>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {offer.categories.map((category) => categoryLabel(category, language)).join(", ")}
                          </CardTitle>
                          <CardDescription>{offer.districts.join(", ")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <StatusBadge tone={toneForStatus(offer.status)}>{statusLabel(offer.status, language)}</StatusBadge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ),
          },
          {
            key: "missing",
            hasItems: missing.length > 0,
            latestTimestamp: latestTimestamp(data.missing.map((item) => item.updatedAt)),
            render: () => (
              <section className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight">{t.postersTitle}</h2>
                {missing.length === 0 ? (
                  <EmptyState
                    title={t.postersEmpty}
                    action={
                      <Button type="button" onClick={() => navigate("poster")}>
                        {t.postersMake}
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {missing.map((m) => (
                      <Card key={m.id} className="overflow-hidden">
                        {m.photo ? <img src={m.photo.url} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : null}
                        <CardHeader>
                          <CardTitle className="text-base">{m.name}</CardTitle>
                          <CardDescription>{m.district}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={m.status === "found" ? "success" : "danger"}>
                            {m.status === "found" ? posterStrings[language].headlineFound : posterStrings[language].headlineMissing}
                          </StatusBadge>
                          <Button asChild size="sm" variant="outline">
                            <a href={`/poster?id=${encodeURIComponent(m.id)}`}>{t.posterOpen}</a>
                          </Button>
                          <Button size="sm" variant="outline" type="button" disabled={busy[m.id]} onClick={() => toggleFound(m)}>
                            {m.status === "found" ? t.posterMissingAgain : t.posterFound}
                          </Button>
                          <Button size="sm" variant="ghost" type="button" disabled={busy[m.id]} onClick={() => remove(m.id)}>
                            {t.posterDelete}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ),
          },
        ].sort((a, b) => Number(b.hasItems) - Number(a.hasItems) || b.latestTimestamp - a.latestTimestamp);
      })()
    : [];
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={t.eyebrow}
        title={auth.profile?.name || auth.profile?.displayName || t.title}
        description={auth.profile?.email}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!data && !error ? <LoadingState label={t.loading} /> : null}
      {data ? (
        <>
          {dashboardSections.map((section) => (
            <Fragment key={section.key}>{section.render()}</Fragment>
          ))}
          <section className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">{articleT.listTitle}</h2>
            <Card>
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{articleT.articlesCardBody}</p>
                <Button asChild variant="outline" className="shrink-0">
                  <a href="/me/articles">{articleT.listTitle}</a>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{data.storyRole ? t.storyEligibleBody : t.storyIneligibleBody}</p>
                {data.storyRole ? (
                  <Button type="button" className="shrink-0" disabled={busy.story} onClick={() => void shareStory()}>
                    {t.storyShare}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">{t.shortcutsTitle}</h2>
            <div className="flex flex-wrap gap-3">
              {isModerator ? (
                <Button type="button" variant="secondary" onClick={() => navigate("desk")}>
                  {t.shortcutDesk}
                </Button>
              ) : null}
              {orgCount > 0 ? (
                <Button type="button" variant="secondary" onClick={() => navigate("org")}>
                  {t.shortcutOrg}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => navigate("registerOrg")}>
                {t.shortcutRegisterOrg}
              </Button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
