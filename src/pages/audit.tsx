import { apiErrorMessage } from "../api-error";
import { useEffect, useState } from "react";
import { ApiError, getAudit, type AuditItem } from "../api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { labels } from "../i18n";
import type { Language } from "../types";

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

export function AuditPage({ language }: { language: Language }) {
  const t = labels[language];
  const months = last12Months();
  const [month, setMonth] = useState<string>(months[0] ?? "");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (m: string, cur?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAudit({ month: m, cursor: cur });
      if (append) setItems((prev) => [...prev, ...res.items]);
      else setItems(res.items);
      setNextCursor(res.cursor);
      setCursor(res.cursor);
    } catch (e) {
      const err = e as ApiError;
      setError(apiErrorMessage(err, language));
      if (!append) setItems([]);
      setNextCursor(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (month) {
      setCursor(undefined);
      setNextCursor(undefined);
      fetchPage(month, undefined, false);
    }
  }, [month]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonth(e.target.value);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 sm:px-4">
      <header className="border-b border-rule pb-6 print:border-black">
        <h1 className="font-display text-2xl font-bold tracking-tight print:text-black">{(t as Record<string, string>).auditTitle}</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm font-medium leading-6 text-ink print:text-black">
          {(t as Record<string, string>).auditLead}
        </p>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-6 text-muted-foreground print:text-black">
          {(t as Record<string, string>).auditIntro}
        </p>
      </header>

      <Card className="no-print print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{(t as Record<string, string>).auditMonthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[14rem]">
            <Label htmlFor="audit-month">{(t as Record<string, string>).auditMonthLabel}</Label>
            <Select id="audit-month" value={month} onChange={handleMonthChange}>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto">
            {(t as Record<string, string>).auditPrint}
          </Button>
        </CardContent>
      </Card>

      {loading && items.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">{(t as Record<string, string>).auditLoading}</p>
      ) : error ? (
        <p className="font-sans text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="border border-rule bg-card px-4 py-8 text-center font-sans text-sm text-muted-foreground print:border-black print:bg-white">
          {(t as Record<string, string>).auditEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto border border-rule bg-paper print:border-black print:bg-white">
          <Table>
            <TableHeader>
              <TableRow className="print:border-black">
                <TableHead>{(t as Record<string, string>).auditTime}</TableHead>
                <TableHead>{(t as Record<string, string>).auditActor}</TableHead>
                <TableHead>{(t as Record<string, string>).auditAction}</TableHead>
                <TableHead>{(t as Record<string, string>).auditTarget}</TableHead>
                <TableHead>{(t as Record<string, string>).auditReason}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`${it.ts}-${idx}`} className="print:break-inside-avoid">
                  <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(it.ts).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}</TableCell>
                  <TableCell className="font-sans text-sm">{it.actorName}</TableCell>
                  <TableCell className="font-mono text-xs">{it.action}</TableCell>
                  <TableCell className="font-sans text-sm">
                    <span className="font-medium">{it.targetType}</span> <span className="text-muted-foreground">· {it.targetLabel}</span>
                  </TableCell>
                  <TableCell className="font-sans text-sm">{it.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center no-print print:hidden">
          <Button variant="outline" onClick={() => fetchPage(month, nextCursor, true)} disabled={loading}>
            {loading ? (t as Record<string, string>).auditLoading : (t as Record<string, string>).auditLoadMore}
          </Button>
        </div>
      ) : null}

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
