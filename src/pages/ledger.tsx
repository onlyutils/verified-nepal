import { useEffect, useState } from "react";
import { ApiError, getLedger, getLedgerCsvUrl, type LedgerItem } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import { districtLabels, districtNames } from "@/lib/geo";
import { goodsLabel } from "@/lib/goods";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TurnstileWidget } from "@/components/turnstile";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format-date";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
function dateLabel(value: string, language: Language) {
  return formatDateTime(value, language);
}

export function Ledger({ language }: { language: Language }) {
  const t = communityStrings[language];
  const [district, setDistrict] = useState<string>(() => {
    const value = new URLSearchParams(window.location.search).get("district");
    return value && districtNames.includes(value as (typeof districtNames)[number]) ? value : "";
  });
  const [ward, setWard] = useState(() => new URLSearchParams(window.location.search).get("ward") ?? "");
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [csvOpen, setCsvOpen] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
    setItems((await getLedger({ district: district || undefined, ward: ward ? Number(ward) : undefined })).items);
    } catch (cause) {
      const api = cause as ApiError;
      setError(apiErrorMessage(cause, language));
      setOffline(api.status === 0 || !navigator.onLine);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [district, ward]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (district) params.set("district", district);
    else params.delete("district");
    if (ward) params.set("ward", ward);
    else params.delete("ward");
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [district, ward]);
  const districtLabel = district ? districtLabels[district as keyof typeof districtLabels]?.[language] ?? district : t.ledgerAllDistricts;
  const csvUrl = getLedgerCsvUrl(district, ward ? Number(ward) : undefined, turnstileToken);
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.accountabilityEyebrow} title={t.ledgerTitle} description={t.ledgerLead} />
      <Card className="print:hidden">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="ledger-district">{t.ledgerDistrict}</Label>
            <NativeSelect id="ledger-district" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <NativeSelectOption value="">{t.ledgerAllDistricts}</NativeSelectOption>
              {districtNames.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {districtLabels[name][language]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ledger-ward">{t.ledgerWard}</Label>
            <NativeSelect id="ledger-ward" value={ward} onChange={(e) => setWard(e.target.value)}>
              <NativeSelectOption value="">{t.ledgerAllWards}</NativeSelectOption>
              {Array.from({ length: 33 }, (_, index) => String(index + 1)).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t.ledgerWard} {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-5">
            <Button variant="outline" onClick={() => window.print()}>
              {t.ledgerPrint}
            </Button>
            <Button variant="secondary" onClick={() => setCsvOpen(true)}>
              {t.ledgerCsv}
            </Button>
            <span className="text-sm text-muted-foreground">{t.ledgerCsvHint}</span>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={csvOpen}
        onOpenChange={(open) => {
          setCsvOpen(open);
          if (!open) setTurnstileToken("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.ledgerCsv}</DialogTitle>
            <DialogDescription>{t.ledgerCsvHint}</DialogDescription>
          </DialogHeader>
          {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} language={language} onToken={setTurnstileToken} /> : null}
          <DialogFooter>
            {csvUrl && (!TURNSTILE_KEY || turnstileToken) ? (
              <Button asChild>
                <a href={csvUrl} download onClick={() => setCsvOpen(false)}>
                  {t.ledgerCsv}
                </a>
              </Button>
            ) : (
              <Button disabled>{t.ledgerCsv}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="hidden text-sm print:block">
        {districtLabel}
        {ward ? ` · ${t.ledgerWard} ${ward}` : ""}
      </p>
      {loading && !items.length ? <LoadingState label={t.ledgerLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            {offline ? ` ${t.offline}` : ""}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !items.length ? <EmptyState title={t.ledgerEmpty} /> : null}
      {items.length ? (
        <>
          <div className="divide-y rounded-xl border md:hidden print:hidden">
            {items.map((item, index) => (
              <div key={`${item.maskedName}-${item.redeemedAt}-mobile-${index}`} className="space-y-1 px-4 py-4">
                <p className="font-semibold">{item.maskedName}</p>
                <p className="text-sm text-muted-foreground">
                  {district ? null : `${districtLabels[item.district as keyof typeof districtLabels]?.[language] ?? item.district} · `}{goodsLabel(item.category, language)} · {t.ledgerWard} {item.ward}
                </p>
                <p className="text-sm text-muted-foreground">{dateLabel(item.redeemedAt, language)}</p>
                {item.orgName ? <p className="text-sm text-muted-foreground">{t.ledgerOrg}: {item.orgName}</p> : null}
              </div>
            ))}
          </div>
          <div className="hidden rounded-xl border md:block print:block print:border-black">
            <Table className="print:min-w-0">
              <TableHeader>
                <TableRow className="bg-secondary print:border-black print:bg-background">
                  <TableHead>{t.ledgerName}</TableHead>
                  <TableHead>{t.ledgerDistrict}</TableHead>
                  <TableHead>{t.ledgerCategory}</TableHead>
                  <TableHead>{t.ledgerWard}</TableHead>
                  <TableHead>{t.ledgerDate}</TableHead>
                  <TableHead>{t.ledgerOrg}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={`${item.maskedName}-${item.redeemedAt}-${index}`} className="print:break-inside-avoid print:border-black">
                    <TableCell className="font-medium">{item.maskedName}</TableCell>
                    <TableCell>{districtLabels[item.district as keyof typeof districtLabels]?.[language] ?? item.district}</TableCell>
                    <TableCell>{goodsLabel(item.category, language)}</TableCell>
                    <TableCell>
                      {t.ledgerWard} {item.ward}
                    </TableCell>
                    <TableCell>{dateLabel(item.redeemedAt, language)}</TableCell>
                    <TableCell>{item.orgName ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
