import { useEffect, useState } from "react";
import { ApiError, getDonation, type DonationStatus } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { centerStrings } from "@/i18n/centers";
import { districtLabels } from "@/lib/geo";
import { goodsLabel, unitLabel } from "@/lib/goods";
import { fillTemplate } from "@/lib/edition";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { CodeDisplay } from "@/components/code-display";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";

function dateLabel(value: string, language: Language) {
  return new Date(value).toLocaleString(language === "ne" ? "ne-NP" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}
function statusText(data: DonationStatus, language: Language) {
  const t = communityStrings[language];
  if (data.status === "received")
    return fillTemplate(t.donationReceived, { date: dateLabel(data.receivedAt ?? data.declaredAt, language) });
  if (data.status === "not_received") return t.donationNotReceived;
  return t.donationDeclared;
}

export function DonationStatusPage({
  language,
  navigate,
  refCode,
}: {
  language: Language;
  navigate: (page: Page) => void;
  refCode: string;
}) {
  const t = communityStrings[language];
  const s = centerStrings[language];
  const [data, setData] = useState<DonationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");
  const load = async (code = refCode) => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setData(null);
    try {
      setData(await getDonation(code.trim().toUpperCase()));
    } catch (cause) {
      const api = cause as ApiError;
      if (api.status === 404) setNotFound(true);
      else setError(apiErrorMessage(cause, language));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [refCode, language]);
  const submitLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const value = lookup.trim().toUpperCase();
    if (value) window.location.assign(`/donation/${encodeURIComponent(value)}`);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.dropCentersEyebrow} title={s.donationStatusTitle} description={t.donationKeepCode} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submitLookup} className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="donation-lookup">{t.donationLookup}</Label>
              <Input
                id="donation-lookup"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder={t.donationPlaceholder}
                className="font-mono uppercase"
                autoComplete="off"
              />
            </div>
            <Button type="submit">{t.donationCheck}</Button>
          </form>
        </CardContent>
      </Card>
      {loading ? <LoadingState label={t.donationLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notFound ? (
        <EmptyState
          title={t.donationNotFound}
          description={t.donationNotFoundBody}
          action={
            <Button variant="secondary" onClick={() => navigate("dropCenters")}>
              {s.backToCenters}
            </Button>
          }
        />
      ) : null}
      {data ? (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <CodeDisplay code={data.ref} kind="ref" label={t.donationLookup} />
            <StatusBadge tone={toneForStatus(data.status === "not_received" ? "not_received" : data.status)}>
              {statusText(data, language)}
            </StatusBadge>
            <dl className="divide-y rounded-lg border">
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">{t.donationCenter}</dt>
                <dd className="sm:col-span-2">
                  {data.center.name} ·{" "}
                  {districtLabels[data.center.district as keyof typeof districtLabels]?.[language] ?? data.center.district}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">{t.donationCategory}</dt>
                <dd className="sm:col-span-2">{goodsLabel(data.category, language)}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">{t.donationQuantity}</dt>
                <dd className="sm:col-span-2">
                  {data.qty} {unitLabel(data.unit, language)}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">{t.donationStatus}</dt>
                <dd className="sm:col-span-2">{fillTemplate(t.donationDeclaredOn, { date: dateLabel(data.declaredAt, language) })}</dd>
              </div>
            </dl>
            {data.sinceReceived ? (
              <p className="border-l-2 border-primary pl-4 text-base leading-7">
                {fillTemplate(t.donationSince, {
                  distributed: `${data.sinceReceived.distributed} ${unitLabel(data.unit, language)}`,
                  transferred: `${data.sinceReceived.transferred} ${unitLabel(data.unit, language)}`,
                  category: goodsLabel(data.category, language),
                })}
              </p>
            ) : null}
            <Button asChild variant="link" className="h-auto px-0">
              <a href={`/drop-centers/${encodeURIComponent(data.center.id)}`}>{t.viewCenter} →</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
