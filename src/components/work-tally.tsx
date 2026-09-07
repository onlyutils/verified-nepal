import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { WorkResponse } from "@/lib/api";
import { meStrings } from "@/i18n/me";

export function WorkTally({ data, t, showTitle = true }: { data: WorkResponse; t: (typeof meStrings)["en"]; showTitle?: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState(data.months[0]?.month ?? "");
  const month = data.months.find((item) => item.month === selectedMonth) ?? data.months[0];
  const rows = Object.entries(month?.counts ?? {}).sort(([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB));
  const workT = t as Record<string, string>;

  return (
    <Card>
      <CardHeader>
        {showTitle ? <CardTitle>{t.workTitle}</CardTitle> : null}
        <CardDescription>{t.workDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.months.length > 1 ? (
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="work-month">{t.workMonthLabel}</Label>
            <NativeSelect id="work-month" value={month?.month ?? ""} onChange={(event) => setSelectedMonth(event.target.value)}>
              {data.months.map((item) => (
                <NativeSelectOption key={item.month} value={item.month}>
                  {item.month}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        {rows.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2" role="list">
            {rows.map(([key, count]) => (
              <div key={key} className="flex items-center justify-between gap-4 border-b py-2 text-sm" role="listitem">
                <span>{workT[`work_${key}`] ?? key}</span>
                <span className="tabular-nums font-semibold">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.workEmpty}</p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <p>{t.workLifetime}: <span className="tabular-nums font-semibold">{data.lifetime.total}</span></p>
          <p>{t.workMonthTotal}: <span className="tabular-nums font-semibold">{month?.total ?? 0}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}
