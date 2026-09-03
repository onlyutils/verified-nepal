import { useMemo, useRef, useState } from "react";
import { climateSeriesColor } from "@/lib/climate-colors";

const WIDTH = 720;
const HEIGHT = 280;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export interface LineSeries {
  iso3: string;
  name: string;
  values: (number | null)[];
}

export function MultiLineChart({
  years,
  series,
  unit,
  logScale,
  formatValue,
}: {
  years: number[];
  series: LineSeries[];
  unit: string;
  logScale: boolean;
  formatValue: (value: number) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plot = useMemo(() => {
    const known = series.flatMap((s) => s.values.filter((v): v is number => v !== null && (!logScale || v > 0)));
    const maxValue = Math.max(...known, 0.0001);
    const minPositive = Math.min(...known.filter((v) => v > 0), maxValue);
    const minYear = years[0];
    const maxYear = years[years.length - 1];

    const x = (year: number) => PAD_LEFT + ((year - minYear) / (maxYear - minYear || 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
    const y = (value: number) => {
      const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
      if (logScale) {
        const logMin = Math.log(minPositive);
        const logMax = Math.log(maxValue);
        const t = (Math.log(Math.max(value, minPositive)) - logMin) / (logMax - logMin || 1);
        return HEIGHT - PAD_BOTTOM - t * innerHeight;
      }
      return HEIGHT - PAD_BOTTOM - (value / maxValue) * innerHeight;
    };

    return { x, y, minYear, maxYear };
  }, [series, years, logScale]);

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const fraction = (localX - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT);
    const yearFloat = plot.minYear + fraction * (plot.maxYear - plot.minYear);
    const index = Math.round(yearFloat - years[0]);
    setHoverIndex(Math.max(0, Math.min(years.length - 1, index)));
  };

  const hoverYear = hoverIndex !== null ? years[hoverIndex] : null;
  const tooltipRows =
    hoverIndex !== null
      ? series
          .map((s, i) => ({ ...s, value: s.values[hoverIndex ?? 0], color: climateSeriesColor(i) }))
          .filter((row) => row.value !== null)
      : [];
  const tooltipLeft = hoverIndex !== null ? (plot.x(years[hoverIndex]) / WIDTH) * 100 : 0;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-64 w-full touch-none"
        role="img"
        aria-label={`${plot.minYear}–${plot.maxYear} trend`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + t * (HEIGHT - PAD_TOP - PAD_BOTTOM)}
            y2={PAD_TOP + t * (HEIGHT - PAD_TOP - PAD_BOTTOM)}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        {series.map((s, i) => {
          const points = years
            .map((year, index) => ({ year, value: s.values[index] }))
            .filter((p): p is { year: number; value: number } => p.value !== null && (!logScale || p.value > 0));
          if (points.length < 2) return null;
          const path = points.map((p) => `${plot.x(p.year)},${plot.y(p.value)}`).join(" ");
          return <polyline key={s.iso3} points={path} fill="none" stroke={climateSeriesColor(i)} strokeWidth={2} />;
        })}
        {hoverYear !== null ? (
          <line
            x1={plot.x(hoverYear)}
            x2={plot.x(hoverYear)}
            y1={PAD_TOP}
            y2={HEIGHT - PAD_BOTTOM}
            className="stroke-muted-foreground"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
        {hoverIndex !== null
          ? series.map((s, i) => {
              const value = s.values[hoverIndex];
              if (value === null || (logScale && value <= 0)) return null;
              return <circle key={s.iso3} cx={plot.x(years[hoverIndex])} cy={plot.y(value)} r={3.5} fill={climateSeriesColor(i)} />;
            })
          : null}
        <text x={PAD_LEFT} y={HEIGHT - 8} className="fill-muted-foreground text-[10px]">
          {plot.minYear}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {plot.maxYear}
        </text>
      </svg>
      {hoverIndex !== null && tooltipRows.length ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-32 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${Math.min(88, Math.max(12, tooltipLeft))}%` }}
        >
          <p className="mb-1 font-medium text-foreground">{hoverYear}</p>
          {tooltipRows.map((row) => (
            <p key={row.iso3} className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                {row.name}
              </span>
              <span className="font-medium text-foreground">
                {formatValue(row.value as number)} {unit}
              </span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
