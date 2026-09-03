import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ClimateRankingsByYear, CountryClimate } from "@/lib/climate-data";
import { WorldMap } from "@/components/climate/world-map";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Tab = "bar" | "table" | "map";
type SortKey = "warming_c" | "share_pct" | "cumulative_pg_co2e100" | "name";

function formatNumber(value: number | null, digits = 4) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefers(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return prefers;
}

export function RankingPanel({
  countriesLatest,
  rankingsByYear,
  latestYear,
  selectedIso3,
  onSelect,
  strings,
  unit,
}: {
  countriesLatest: CountryClimate[];
  rankingsByYear: ClimateRankingsByYear;
  latestYear: number;
  selectedIso3: string;
  onSelect: (iso3: string) => void;
  strings: Record<string, string>;
  unit: string;
}) {
  const t = strings;
  const [tab, setTab] = useState<Tab>("bar");
  const [yearIndex, setYearIndex] = useState(rankingsByYear.years.length - 1);
  const [playing, setPlaying] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("warming_c");
  const [sortDesc, setSortDesc] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setYearIndex((current) => {
        if (current >= rankingsByYear.years.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 120);
    return () => clearInterval(id);
  }, [playing, rankingsByYear.years.length]);

  const year = rankingsByYear.years[yearIndex];
  const yearRows = rankingsByYear.byYear[yearIndex];
  const nepalRow = yearRows.find((r) => r.iso3 === "NPL");
  const nepalInTop = yearRows.slice(0, 15).some((r) => r.iso3 === "NPL");
  const maxWarming = yearRows[0]?.warming_c ?? 1;

  const sortedTable = useMemo(() => {
    const rows = [...countriesLatest];
    rows.sort((a, b) => {
      if (sortKey === "name") return sortDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDesc ? bv - av : av - bv;
    });
    return rows;
  }, [countriesLatest, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["bar", "table", "map"] as const).map((value) => (
          <Button key={value} type="button" size="sm" variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>
            {t[`tab${value.charAt(0).toUpperCase()}${value.slice(1)}`]}
          </Button>
        ))}
      </div>

      {tab === "bar" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-secondary/40 px-3 py-2">
          {!reducedMotion ? (
            <Button type="button" size="icon" variant="outline" onClick={() => setPlaying((p) => !p)} aria-label={t.playPause}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
          ) : null}
          <input
            type="range"
            min={0}
            max={rankingsByYear.years.length - 1}
            value={yearIndex}
            onChange={(e) => {
              setPlaying(false);
              setYearIndex(Number(e.target.value));
            }}
            className="h-2 flex-1 accent-primary"
            aria-label={t.yearScrubber}
          />
          <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{year}</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t.latestYearNote.replace("{year}", String(latestYear))}</p>
      )}

      {tab === "bar" ? (
        <div className="space-y-2 rounded-xl border p-4">
          {yearRows.slice(0, 15).map((row) => (
            <BarRow key={row.iso3} row={row} maxWarming={maxWarming} unit={unit} onSelect={onSelect} highlight={row.iso3 === selectedIso3} />
          ))}
          {!nepalInTop && nepalRow ? (
            <>
              <p className="border-t pt-3 text-xs text-muted-foreground">{t.nepalHighlightNote}</p>
              <BarRow row={nepalRow} maxWarming={maxWarming} unit={unit} onSelect={onSelect} highlight />
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "table" ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label={t.colCountry} active={sortKey === "name"} desc={sortDesc} onClick={() => toggleSort("name")} />
                <SortableHead
                  label={t.colWarming}
                  active={sortKey === "warming_c"}
                  desc={sortDesc}
                  onClick={() => toggleSort("warming_c")}
                  align="right"
                />
                <SortableHead
                  label={t.colShare}
                  active={sortKey === "share_pct"}
                  desc={sortDesc}
                  onClick={() => toggleSort("share_pct")}
                  align="right"
                />
                <SortableHead
                  label={t.colCumulative}
                  active={sortKey === "cumulative_pg_co2e100"}
                  desc={sortDesc}
                  onClick={() => toggleSort("cumulative_pg_co2e100")}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTable.map((row) => (
                <TableRow
                  key={row.iso3}
                  className={`cursor-pointer ${row.iso3 === selectedIso3 ? "bg-accent" : ""}`}
                  onClick={() => onSelect(row.iso3)}
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.warming_c)} {unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.share_pct, 2)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.cumulative_pg_co2e100)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {tab === "map" ? (
        <WorldMap countries={countriesLatest} selectedIso3={selectedIso3} onSelect={onSelect} noDataLabel={t.noData} loadingLabel={t.mapLoading} />
      ) : null}
    </div>
  );
}

function BarRow({
  row,
  maxWarming,
  unit,
  onSelect,
  highlight,
}: {
  row: { iso3: string; name: string; warming_c: number; share_pct: number | null; rank: number };
  maxWarming: number;
  unit: string;
  onSelect: (iso3: string) => void;
  highlight: boolean;
}) {
  const widthPct = maxWarming > 0 ? Math.max(2, (row.warming_c / maxWarming) * 100) : 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.iso3)}
      className={`w-full space-y-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent ${highlight ? "bg-accent" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">
          {row.rank}. {row.name}
        </span>
        <span className="whitespace-nowrap text-muted-foreground">
          {formatNumber(row.warming_c)} {unit}
          {row.share_pct !== null ? ` · ${formatNumber(row.share_pct, 2)}%` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${widthPct}%` }} />
      </div>
    </button>
  );
}

function SortableHead({
  label,
  active,
  desc,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      >
        {label}
        {active ? <span aria-hidden="true">{desc ? "↓" : "↑"}</span> : null}
      </button>
    </TableHead>
  );
}
