import { useCallback, useEffect, useState } from "react";
import { listOrgNeeds, orgDeliverNeed, orgReleaseNeed, type OrgNeed } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { fillTemplate } from "@/lib/edition";
import { districtLabels } from "@/lib/geo";
import type { Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format-date";
import { NeedTimeline } from "@/components/need-timeline";
import type { OrgController } from "./org-types";

export function OrgNeeds({ controller, navigate }: { controller: OrgController; navigate: (page: Page) => void }) {
  const { t, language, selectedOrg, auth } = controller;
  const [items, setItems] = useState<OrgNeed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.idToken || !selectedOrg) return;
    setError(null);
    try {
      setItems((await listOrgNeeds(auth.idToken, selectedOrg.id)).items);
    } catch (e) {
      setError(apiErrorMessage(e, language));
    }
  }, [auth.idToken, selectedOrg, language]);
  useEffect(() => { void load(); }, [load]);

  const act = async (need: OrgNeed, action: "deliver" | "release") => {
    if (!auth.idToken || !selectedOrg) return;
    setBusy(need.id);
    setError(null);
    try {
      if (action === "deliver") await orgDeliverNeed(auth.idToken, selectedOrg.id, need.id, notes[need.id]?.trim() || undefined);
      else await orgReleaseNeed(auth.idToken, selectedOrg.id, need.id);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e, language));
    } finally {
      setBusy(null);
    }
  };

  if (!selectedOrg) return null;
  const date = (iso?: string) => (iso ? formatDateTime(iso, language) : "");
  const handovers = items?.filter((need) => need.handover) ?? [];
  const active = items?.filter((need) => !need.handover) ?? [];
  const renderNeed = (need: OrgNeed) => (
    <Card key={need.id}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{need.beneficiary.name}</CardTitle>
          <StatusBadge tone={toneForStatus(need.status)}>{need.status}</StatusBadge>
        </div>
        <CardDescription>
          {districtLabels[need.beneficiary.district as keyof typeof districtLabels]?.[language] ?? need.beneficiary.district} · W{need.beneficiary.ward} · {need.handover && need.donation ? fillTemplate(t.needsHandoverVia, { center: need.donation.center?.name ?? "" }) : need.status === "fulfilled" ? fillTemplate(t.needsDoneAt, { date: date(need.handledAt) }) : fillTemplate(t.needsTakenAt, { date: date(need.handledAt) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{need.description}</p>
        {need.handover && need.donation ? <p className="text-sm text-muted-foreground">{fillTemplate(t.needsHandoverHandler, { label: need.handledBy || "" })}</p> : need.beneficiary.phone ? <p className="text-sm">{t.needsPhone}: <a className="underline" href={`tel:${need.beneficiary.phone}`}>{need.beneficiary.phone}</a></p> : null}
        <NeedTimeline steps={need.timeline} language={language} />
        {need.status === "matched" ? (
          <div className="space-y-2">
            <Input value={notes[need.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [need.id]: e.target.value }))} placeholder={t.needsDeliverNote} maxLength={500} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy === need.id} onClick={() => void act(need, "deliver")}>{busy === need.id ? t.needsDelivering : t.needsDeliver}</Button>
              {!need.handover ? <Button size="sm" variant="outline" disabled={busy === need.id} onClick={() => void act(need, "release")}>{t.needsRelease}</Button> : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow={t.navNeeds} title={t.needsTitle} description={t.needsDescription} />
      {selectedOrg.status !== "verified" ? (
        <Alert>
          <AlertDescription>{t.needsNotVerified}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {items === null && !error ? <LoadingState label={t.needsLoading} /> : null}
      {items && !items.length ? (
        <EmptyState
          title={t.needsEmpty}
          action={
            <Button type="button" onClick={() => navigate("giveHelp")}>
              {t.needsOpenBoard}
            </Button>
          }
        />
      ) : null}
      {items?.length ? (
        <>
          {handovers.length ? <section className="space-y-3"><h2 className="text-2xl font-bold tracking-tight">{t.needsHandoverTitle}</h2><div className="grid gap-4 md:grid-cols-2">{handovers.map(renderNeed)}</div></section> : null}
          {active.length ? <section className="space-y-3"><div className="grid gap-4 md:grid-cols-2">{active.map(renderNeed)}</div></section> : null}
        </>
      ) : null}
    </div>
  );
}
