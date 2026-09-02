import { useEffect, useState } from "react";
import { ApiError, getAudit, type AuditItem } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { communityStrings } from "@/i18n/community";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";

function months() {
  const result: string[] = [];
  const now = new Date();
  for (let index = 0; index < 12; index += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    result.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}
function monthLabel(value: string, language: Language) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(language === "ne" ? "ne-NP" : "en-US", {
    month: "long",
    year: "numeric",
  });
}
function actionLabel(action: string, language: Language) {
  const t = communityStrings[language];
  return (
    (
      {
        publish: t.actionPublish,
        reject: t.actionReject,
        match: t.actionMatch,
        fulfill: t.actionFulfill,
        redeem: t.actionRedeem,
        verify: t.actionVerify,
        suspend: t.actionSuspend,
        reinstate: t.actionReinstate,
        update: t.actionUpdate,
        create: t.actionCreate,
        archive: t.actionArchive,
        "set-status": t.actionSetStatus,
      } as Record<string, string>
    )[action] ?? t.actionUpdate
  );
}
function targetLabel(type: string, language: Language) {
  const t = communityStrings[language];
  return (
    (
      {
        need: t.targetNeed,
        project: t.targetProject,
        dispatch: t.targetDispatch,
        organization: t.targetOrganization,
        center: t.targetCenter,
        user: t.targetUser,
      } as Record<string, string>
    )[type] ?? t.targetUser
  );
}

export function AuditPage({ language }: { language: Language }) {
  const t = communityStrings[language];
  const options = months();
  const [month, setMonth] = useState(options[0] ?? "");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async (cursor?: string, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAudit({ month, cursor });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setNextCursor(response.cursor);
    } catch (cause) {
      setError(apiErrorMessage(cause, language));
      if (!append) setItems([]);
      setNextCursor(undefined);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [month, language]);
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={t.accountabilityEyebrow} title={t.auditTitle} description={`${t.auditLead} ${t.auditIntro}`} />
      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="min-w-56 space-y-2">
            <Label htmlFor="audit-month">{t.auditMonth}</Label>
            <NativeSelect id="audit-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {options.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {monthLabel(value, language)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            {t.ledgerPrint}
          </Button>
        </CardContent>
      </Card>
      {loading && !items.length ? <LoadingState label={t.auditLoading} /> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <span className="mt-2 block">
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t.retry}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {!loading && !error && !items.length ? <EmptyState title={t.auditEmpty} /> : null}
      {items.length ? (
        <>
          <div className="divide-y rounded-xl border md:hidden print:hidden">
            {items.map((item, index) => (
              <div key={`${item.ts}-${index}-mobile`} className="space-y-1 px-4 py-4">
                <p className="font-semibold">
                  {actionLabel(item.action, language)} · {targetLabel(item.targetType, language)}
                </p>
                <p className="text-sm">{item.targetLabel}</p>
                <p className="text-sm text-muted-foreground">
                  {item.actorName} · {new Date(item.ts).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}
                </p>
                {item.reason ? <p className="text-sm text-muted-foreground">{item.reason}</p> : null}
              </div>
            ))}
          </div>
          <div className="hidden rounded-xl border md:block print:block print:border-black">
            <Table className="print:min-w-0">
              <TableHeader>
                <TableRow className="bg-secondary print:border-black print:bg-background">
                  <TableHead>{t.auditTime}</TableHead>
                  <TableHead>{t.auditActor}</TableHead>
                  <TableHead>{t.auditAction}</TableHead>
                  <TableHead>{t.auditTarget}</TableHead>
                  <TableHead>{t.auditReason}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={`${item.ts}-${index}`} className="print:break-inside-avoid print:border-black">
                    <TableCell className="whitespace-nowrap">
                      {new Date(item.ts).toLocaleString(language === "ne" ? "ne-NP" : "en-US")}
                    </TableCell>
                    <TableCell>{item.actorName}</TableCell>
                    <TableCell>{actionLabel(item.action, language)}</TableCell>
                    <TableCell>
                      {targetLabel(item.targetType, language)} · {item.targetLabel}
                    </TableCell>
                    <TableCell>{item.reason || t.dash}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
      {nextCursor ? (
        <div className="flex justify-center print:hidden">
          <Button variant="outline" onClick={() => void load(nextCursor, true)} disabled={loading}>
            {t.auditLoadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
