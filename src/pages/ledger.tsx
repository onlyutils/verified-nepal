import { apiErrorMessage } from "@/lib/api-error";
import { useEffect, useState } from "react";
import { ApiError, getLedger, getLedgerCsvUrl, type LedgerItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TurnstileWidget } from "@/components/turnstile";
import { districtLabels, districtNames } from "@/lib/geo";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";

const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function Ledger({ language }: { language: Language }) {
  const t = labels[language];
  const [district, setDistrict] = useState<string>(districtNames[0] ?? "Rasuwa");
  const [ward, setWard] = useState<string>("");
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  const fetchLedger = async () => {
    if (!district) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getLedger({ district, ward: ward ? Number(ward) : undefined });
      setItems(res.items);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 0) {
        setError(t.ledgerOffline);
      } else {
        setError(apiErrorMessage(err, language));
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [district, ward]);

  const csvUrl = district ? getLedgerCsvUrl(district, ward ? Number(ward) : undefined, turnstileToken || undefined) : "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 sm:px-4">
      <header className="border-b border-rule pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t.ledgerTitle}</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-muted-foreground-foreground">{t.ledgerLead}</p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.ledgerTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[14rem]">
              <Label>{t.ledgerDistrict}</Label>
              <NativeSelect value={district} onChange={(e) => setDistrict(e.target.value)}>
                {districtNames.map((d) => (
                  <NativeSelectOption key={d} value={d}>
                    {districtLabels[d][language]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="min-w-[10rem]">
              <Label>{t.ledgerWard}</Label>
              <NativeSelect value={ward} onChange={(e) => setWard(e.target.value)}>
                <option value="">{t.ledgerAllWards}</option>
                {Array.from({ length: 33 }, (_, i) => i + 1).map((w) => (
                  <NativeSelectOption key={w} value={String(w)}>
                    W{w}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                {t.ledgerPrintAction}
              </Button>
              {csvUrl ? (
                <a
                  href={csvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center border border-ink bg-ink px-3 font-sans text-xs font-semibold uppercase tracking-wide text-paper hover:bg-ink/90"
                >
                  {t.ledgerDownloadCsv}
                </a>
              ) : null}
            </div>
          </div>
          <p className="font-sans text-xs text-muted-foreground-foreground">{t.ledgerDownloadHint}</p>
          {TURNSTILE_KEY ? <TurnstileWidget siteKey={TURNSTILE_KEY} onToken={setTurnstileToken} /> : <p className="font-sans text-xs text-muted-foreground-foreground">{t.ledgerTurnstileHint}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <p className="font-sans text-sm text-muted-foreground-foreground">{t.ledgerLoading}</p>
      ) : error ? (
        <div className="border border-rule bg-card px-4 py-6" role="alert">
          <p className="font-sans text-sm text-destructive">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground-foreground">{t.ledgerEmpty}</p>
      ) : (
        <div className="overflow-x-auto border border-rule bg-paper print:border-black print:bg-white">
          <Table>
            <TableHeader>
              <TableRow className="print:border-black">
                <TableHead>{t.ledgerMaskedName}</TableHead>
                <TableHead>{t.ledgerCategory}</TableHead>
                <TableHead>{t.ledgerWard}</TableHead>
                <TableHead>{t.ledgerDate}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`${it.maskedName}-${it.redeemedAt}-${idx}`} className="print:break-inside-avoid">
                  <TableCell className="font-medium">{it.maskedName}</TableCell>
                  <TableCell className="capitalize">{it.category}</TableCell>
                  <TableCell>W{it.ward}</TableCell>
                  <TableCell className="text-xs">{new Date(it.redeemedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <style>{`@media print {
        header, nav, footer, .no-print { display: none !important; }
        body { background: white !important; color: black !important; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid black; color: black; background: white; }
        tr { page-break-inside: avoid; }
      }`}</style>
    </div>
  );
}
