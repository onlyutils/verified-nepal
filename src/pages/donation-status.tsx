import { useEffect, useState } from "react";
import { ApiError, getDonation, type DonationStatus } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fillTemplate } from "@/lib/edition";
import { districtLabels } from "@/lib/geo";
import { goodsLabel, unitLabel } from "@/lib/goods";
import { centerStrings } from "@/i18n/centers";
import type { Language, Page } from "@/lib/types";
import { Headline, RuledTable, SectionLabel, StatusMark } from "@/components/legacy";

function formatDate(iso: string, language: Language): string {
  try {
    return new Date(iso).toLocaleString(language === "ne" ? "ne-NP" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function DonationStatusPage({ language, navigate, refCode }: { language: Language; navigate: (page: Page) => void; refCode: string }) {
  const s = centerStrings[language];
  const [data, setData] = useState<DonationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);
    getDonation(refCode.trim().toUpperCase())
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(apiErrorMessage(e, language));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refCode, language]);

  const lookupForm = (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const code = lookup.trim().toUpperCase();
        if (code) window.location.assign(`/donation/${encodeURIComponent(code)}`);
      }}
    >
      <div className="min-w-[14rem] flex-1">
        <Label htmlFor="donation-lookup">{s.donationLookupLabel}</Label>
        <Input
          id="donation-lookup"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder={s.donationLookupPlaceholder}
          className="min-h-11 font-mono uppercase"
          autoComplete="off"
        />
      </div>
      <Button type="submit" className="min-h-11">
        {s.donationLookupButton}
      </Button>
    </form>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <p className="font-sans text-sm text-muted-foreground">{s.loading}</p>;
  } else if (notFound) {
    body = (
      <Card className="border-ink">
        <CardHeader>
          <CardTitle className="font-serif text-xl">{s.donationNotFoundTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-sans text-sm text-muted-foreground">{s.donationNotFoundBody}</p>
          <Button variant="outline" className="min-h-11" onClick={() => navigate("dropCenters")}>
            {s.backToCenters}
          </Button>
        </CardContent>
      </Card>
    );
  } else if (error) {
    body = (
      <div className="border border-rule bg-card px-4 py-4" role="alert">
        <p className="font-sans text-sm text-destructive">{error}</p>
      </div>
    );
  } else if (data) {
    const districtLabel = districtLabels[data.center.district as keyof typeof districtLabels]?.[language] ?? data.center.district;
    const statusText =
      data.status === "received"
        ? fillTemplate(s.donationReceived, { date: formatDate(data.receivedAt ?? data.declaredAt, language) })
        : data.status === "not_received"
          ? s.donationNotReceived
          : s.donationDeclared;
    const tone = data.status === "received" ? "verified" : data.status === "not_received" ? "rejected" : "pending";
    body = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl tracking-widest">{data.ref}</span>
          <StatusMark tone={tone}>{statusText}</StatusMark>
        </div>
        <RuledTable
          caption={s.donationStatusLabel}
          rows={[
            { key: "center", label: s.donationCenterLabel, value: `${data.center.name} · ${districtLabel}` },
            { key: "category", label: s.donationCategoryLabel, value: goodsLabel(data.category, language) },
            { key: "qty", label: s.donationQtyLabel, value: `${data.qty} ${unitLabel(data.unit, language)}` },
            { key: "declared", label: s.donationStatusLabel, value: fillTemplate(s.donationDeclaredOn, { date: formatDate(data.declaredAt, language) }) },
          ]}
        />
        {data.sinceReceived ? (
          <p className="border-l border-ink pl-4 font-serif text-[0.95rem] leading-7">
            {fillTemplate(s.donationSinceReceived, {
              distributed: `${data.sinceReceived.distributed} ${unitLabel(data.unit, language)}`,
              transferred: `${data.sinceReceived.transferred} ${unitLabel(data.unit, language)}`,
              category: goodsLabel(data.category, language),
            })}
          </p>
        ) : null}
        <p className="font-sans text-xs italic text-muted-foreground">{s.dropKeepCode}</p>
        <a
          href={`/drop-centers/${encodeURIComponent(data.center.id)}`}
          className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {s.viewCenter} →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-rule pb-6">
        <SectionLabel>{s.centersSectionLabel}</SectionLabel>
        <Headline level={1} className="mt-3">
          {s.donationStatusTitle}
        </Headline>
      </header>
      <Card>
        <CardContent className="pt-6">{lookupForm}</CardContent>
      </Card>
      {body}
    </div>
  );
}
