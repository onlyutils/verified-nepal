export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, centerLabel }: { segments: DonutSegment[]; centerLabel?: string }) {
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  if (!positive.length || total <= 0) return null;

  let cursor = 0;
  const stops = positive
    .map((segment) => {
      const start = (cursor / total) * 360;
      cursor += segment.value;
      const end = (cursor / total) * 360;
      return `${segment.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }} aria-hidden="true">
        <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-card text-center text-[10px] font-medium text-muted-foreground">
          {centerLabel}
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {positive.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" />
            <span className="text-foreground">{segment.label}</span>
            <span className="text-muted-foreground">{Math.round((segment.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
