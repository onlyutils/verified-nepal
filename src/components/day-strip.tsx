import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DayStrip({
  title,
  days,
  primaryLabel,
  secondaryLabel,
}: {
  title: string;
  days: { date: string; primary: number; secondary?: number }[];
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.primary, day.secondary ?? 0]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-36 items-stretch gap-1" aria-label={title}>
          {days.map((day, index) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex min-h-0 flex-1 items-end gap-px"
                title={`${day.date}: ${primaryLabel} ${day.primary}${secondaryLabel && day.secondary !== undefined ? ` · ${secondaryLabel} ${day.secondary}` : ""}`}
              >
                <div
                  className={`${secondaryLabel ? "w-1/2" : "w-full"} rounded-t bg-primary`}
                  style={{ height: `${(day.primary / maxValue) * 100}%` }}
                />
                {secondaryLabel && day.secondary !== undefined ? (
                  <div className="w-1/2 rounded-t bg-primary/40" style={{ height: `${(day.secondary / maxValue) * 100}%` }} />
                ) : null}
              </div>
              <div className="h-4 truncate text-[10px] text-muted-foreground">
                {index === 0 || index === days.length - 1 ? day.date : ""}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
