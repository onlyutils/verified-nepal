import { useEffect, useState } from "react";
import { ApiError, getCenter, type CenterDetailResponse } from "../api";
import { apiErrorMessage } from "../api-error";
import { centerStrings } from "../i18n-centers";
import { districtLabels } from "../geo";
import { goodsLabel, unitLabel } from "../goods";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Headline, SectionLabel, RuledTable, Rule, StatusMark } from "../ui";
import type { Language, Page } from "../types";
import { fillTemplate } from "../edition";

function tierLabel(tier: string | undefined, language: Language): string {
  const s = centerStrings[language];
  if (tier === "known") return s.tierKnown;
  if (tier === "vouched") return s.tierVouched;
  return s.tierSelfDeclared;
}

function statusTone(status: string): "published" | "pending" | "archived" {
  if (status === "open") return "published";
  if (status === "paused") return "pending";
  return "archived";
}

function statusLabel(status: string, language: Language): string {
  const s = centerStrings[language];
  if (status === "open") return s.statusOpen;
  if (status === "paused") return s.statusPaused;
  return s.statusClosed;
}

function entryLabel(entry: CenterDetailResponse["recent"][number], language: Language): string {
  const s = centerStrings[language];
  if (entry.entryType === "intake") return s.activityIntake;
  if (entry.entryType === "distribution") return s.activityDistribution;
  if (entry.entryType === "transfer_out") {
    const dest = entry.destinationLabel || entry.destinationCenterId || "";
    return fillTemplate(s.activityTransferOut, { destination: dest });
  }
  if (entry.entryType === "transfer_in") {
    const src = entry.sourceLabel || entry.sourceCenterId || "";
    return fillTemplate(s.activityTransferIn, { source: src });
  }
  if (entry.entryType === "correction") return s.activityCorrection;
  return entry.entryType;
}

export function DropCenterDetail({ language, navigate, id }: { language: Language; navigate: (page: Page) => void; id: string }) {
  const s = centerStrings[language];
  const [data, setData] = useState<CenterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    getCenter(id)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setNotFound(true);
        } else {
          setError(apiErrorMessage(e, language));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, language]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="font-sans text-sm text-muted">{s.loading}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="border-ink">
          <CardHeader>
            <CardTitle className="font-serif text-xl">{s.centerNotFoundTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-sans text-sm text-muted">{s.centerNotFoundBody}</p>
            <Button className="min-h-11" onClick={() => navigate("dropCenters")}>
              {s.backToCenters}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="border border-rule bg-card px-4 py-4" role="alert">
          <p className="font-sans text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => navigate("dropCenters")}>
            {s.backToCenters}
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const districtLabel = districtLabels[data.district as keyof typeof districtLabels]?.[language] ?? data.district;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => navigate("dropCenters")}
        className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
      >
        ← {s.backToCenters}
      </button>

      <header className="border-b border-rule pb-6">
        <SectionLabel>{s.centersSectionLabel}</SectionLabel>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.org.status === "verified" ? (
            <Badge variant="default" className="text-[0.62rem] uppercase">
              {tierLabel(data.org.tier, language)}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-rule text-[0.62rem] uppercase text-muted">
              {s.unverifiedOrg}
            </Badge>
          )}
          <span className="font-sans text-xs text-muted">{data.org.name}</span>
          <StatusMark tone={statusTone(data.status)}>{statusLabel(data.status, language)}</StatusMark>
        </div>
        <Headline level={1} className="mt-3 text-3xl">
          {data.name}
        </Headline>
        <div className="mt-3 space-y-1 font-sans text-sm text-muted">
          <p>
            {s.addressLabel}: {data.address}
          </p>
          <p>{data.ward ? fillTemplate(s.districtWard, { district: districtLabel, ward: String(data.ward) }) : districtLabel}</p>
          {data.hours ? <p>{s.hoursLabel}: {data.hours}</p> : null}
          <p>
            {s.phoneLabel}:{" "}
            <a href={`tel:${data.contactPhone}`} className="font-semibold text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red">
              {data.contactPhone}
            </a>
          </p>
        </div>
        {data.accepts.length ? (
          <div className="mt-4">
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-wide text-muted">{s.acceptsLabel}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {data.accepts.map((a) => (
                <Badge key={a} variant="secondary" className="text-[0.68rem]">
                  {goodsLabel(a, language)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{s.stockTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.stock.length === 0 ? (
            <p className="font-sans text-sm text-muted">{s.stockEmpty}</p>
          ) : (
            <RuledTable
              caption={s.stockTitle}
              rows={data.stock.map((item) => ({
                key: item.category,
                label: goodsLabel(item.category, language),
                value: `${item.qty} ${unitLabel(item.unit, language)}`,
              }))}
            />
          )}
          <p className="mt-4 border-t border-rule pt-3 font-sans text-xs italic text-muted">{s.stockNote}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{s.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="font-sans text-sm text-muted">{s.activityEmpty}</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.recent.map((entry) => {
                const corrected = !!entry.correctedByEntryId;
                return (
                  <li key={entry.id} className={`flex flex-col gap-1 px-2 py-3 font-sans text-sm ${corrected ? "line-through text-muted" : "text-ink"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{entryLabel(entry, language)}</span>
                      <span className="text-xs text-muted">
                        {goodsLabel(entry.category, language)} · {entry.qty} {unitLabel(entry.unit, language)}
                      </span>
                      {corrected ? <Badge variant="outline" className="text-[0.62rem]">{s.activityCorrected}</Badge> : null}
                    </div>
                    <span className="font-sans text-xs text-muted">{new Date(entry.createdAt).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}</span>
                    {entry.note ? <span className="font-sans text-xs italic text-muted">{entry.note}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Rule />
      <div className="flex">
        <Button variant="outline" className="min-h-11" onClick={() => navigate("dropCenters")}>
          {s.backToCenters}
        </Button>
      </div>
    </div>
  );
}
