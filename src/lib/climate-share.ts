import { CHOROPLETH_SHADES, bucketIndex, climateSeriesColor, quantileThresholds } from "./climate-colors.ts";
import type { CountryClimate } from "./climate-data.ts";
import { token } from "./poster-draw.ts";
import type { PlacedWord } from "./word-cloud.ts";

const SIZE = 1080;
const FAMILY = "'Noto Sans', 'Noto Sans Devanagari', system-ui, sans-serif";

export interface ShareCardInput {
  headline: string;
  subline?: string;
  message?: string;
  footnote?: string;
  draw?: (ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void;
}

type TextAlign = CanvasRenderingContext2D["textAlign"];

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line && ctx.measureText(word).width > maxWidth) {
        let chunk = "";
        for (const character of word) {
          const next = chunk + character;
          if (chunk && ctx.measureText(next).width > maxWidth) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk = next;
          }
        }
        line = chunk;
        continue;
      }
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function limitedLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  let last = result[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
  result[maxLines - 1] = `${last}…`;
  return result;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function setText(ctx: CanvasRenderingContext2D, color: string, font: string, align: TextAlign = "left") {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
}

export function renderShareCard(canvas: HTMLCanvasElement, input: ShareCardInput): void {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const margin = 72;
  const contentW = SIZE - margin * 2;
  const footerTop = SIZE - 110;
  const background = token("--background");
  const foreground = token("--foreground");
  const muted = token("--muted-foreground");
  const brand = token("--primary");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.textBaseline = "top";
  let y = margin;

  setText(ctx, foreground, `700 64px ${FAMILY}`);
  let headlineLines = limitedLines(ctx, input.headline, contentW, 3);
  if (wrapText(ctx, input.headline, contentW).length > 3) {
    ctx.font = `700 52px ${FAMILY}`;
    headlineLines = limitedLines(ctx, input.headline, contentW, 3);
  }
  y = drawLines(ctx, headlineLines, margin, y, ctx.font.includes("52px") ? 62 : 76) + 16;

  if (input.subline) {
    setText(ctx, muted, `400 32px ${FAMILY}`);
    y = drawLines(ctx, wrapText(ctx, input.subline, contentW), margin, y, 42) + 12;
  }
  if (input.message) {
    setText(ctx, brand, `700 56px ${FAMILY}`);
    y = drawLines(ctx, limitedLines(ctx, input.message, contentW, 2), margin, y, 66) + 12;
  }

  const footnoteLines = input.footnote
    ? (() => {
        setText(ctx, muted, `400 24px ${FAMILY}`);
        return limitedLines(ctx, input.footnote, contentW, 2);
      })()
    : [];
  const footnoteY = footnoteLines.length ? footerTop - footnoteLines.length * 31 - 24 : footerTop - 24;
  if (input.draw) {
    const drawY = y + 16;
    input.draw(ctx, { x: margin, y: drawY, w: contentW, h: Math.max(0, footnoteY - drawY - 20) });
  }
  if (footnoteLines.length) {
    setText(ctx, muted, `400 24px ${FAMILY}`);
    drawLines(ctx, footnoteLines, margin, footnoteY, 31);
  }

  ctx.fillStyle = token("--border");
  ctx.fillRect(margin, footerTop, contentW, 1);
  // Keep this footer identical to the poster footer.
  const brandY = SIZE - 72;
  setText(ctx, brand, `600 26px ${FAMILY}`, "center");
  const label = "verifiednepal.com";
  const labelW = ctx.measureText(label).width;
  ctx.fillText(label, SIZE / 2, brandY);
  ctx.fillRect(SIZE / 2 - labelW / 2, brandY + 34, labelW, 2);
  ctx.textAlign = "left";
}

export interface RankingBarRow {
  name: string;
  warming_c: number;
  rank: number;
}

export function drawRankingBars(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { rows: RankingBarRow[]; nepal?: RankingBarRow; unit: string },
): void {
  const muted = token("--muted-foreground");
  const foreground = token("--foreground");
  const brand = token("--primary");
  const rows = data.rows.slice(0, 15);
  const all = data.nepal ? [...rows, data.nepal] : rows;
  if (!all.length) return;
  const left = box.x + 64;
  const top = box.y + 30;
  const bottom = box.y + box.h - 126;
  const chartW = Math.max(1, box.w - 80);
  const chartH = Math.max(1, bottom - top);
  const maxValue = Math.max(0, ...all.map((row) => row.warming_c)) || 1;
  const nepalGap = data.nepal ? Math.min(24, chartW * 0.03) : 0;
  const slotW = (chartW - nepalGap) / all.length;
  const baseY = top + chartH;

  ctx.strokeStyle = token("--border");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, baseY);
  ctx.lineTo(left + chartW, baseY);
  ctx.stroke();
  setText(ctx, muted, `400 20px ${FAMILY}`);
  ctx.fillText(data.unit, left, box.y + 2);

  all.forEach((row, index) => {
    const center = left + slotW * (index + 0.5) + (data.nepal && index === all.length - 1 ? nepalGap : 0);
    const barH = (Math.max(0, row.warming_c) / maxValue) * (chartH - 12);
    ctx.fillStyle = data.nepal && index === all.length - 1 ? brand : token("--secondary");
    ctx.fillRect(center - Math.min(34, slotW * 0.32), baseY - barH, Math.min(68, slotW * 0.64), barH);
    setText(ctx, foreground, `400 20px ${FAMILY}`, "center");
    ctx.fillText(`${row.warming_c.toFixed(3)}${data.unit}`, center, baseY - barH - 26);
    const label = `${row.rank}. ${row.name}`;
    const fits = ctx.measureText(label).width <= slotW - 8;
    ctx.save();
    ctx.fillStyle = muted;
    if (fits) {
      ctx.fillText(label, center, baseY + 14);
    } else {
      ctx.translate(center, baseY + 18);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  });
}

export interface TrendSeries {
  name: string;
  values: (number | null)[];
  colorIndex: number;
}

function axisNumber(value: number) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function drawTrendLines(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { years: number[]; series: TrendSeries[]; logScale: boolean; unit: string },
): void {
  const muted = token("--muted-foreground");
  const foreground = token("--foreground");
  const left = box.x + 92;
  const top = box.y + 26;
  const right = box.x + box.w - 20;
  const chartBottom = box.y + Math.max(120, box.h - 94);
  const chartW = Math.max(1, right - left);
  const chartH = Math.max(1, chartBottom - top);
  const values = data.series
    .flatMap((series) => series.values)
    .filter((value): value is number => value !== null && Number.isFinite(value) && (!data.logScale || value > 0));
  if (!values.length || !data.years.length) return;
  const transformed = (value: number) => (data.logScale ? Math.log10(value) : value);
  const numeric = values.map(transformed);
  let min = Math.min(...numeric);
  let max = Math.max(...numeric);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const xFor = (index: number) => left + (data.years.length <= 1 ? chartW / 2 : (index / (data.years.length - 1)) * chartW);
  const yFor = (value: number) => chartBottom - ((transformed(value) - min) / (max - min)) * chartH;

  ctx.strokeStyle = token("--border");
  ctx.lineWidth = 1;
  setText(ctx, muted, `400 20px ${FAMILY}`);
  for (let tick = 0; tick < 4; tick += 1) {
    const y = top + (tick / 3) * chartH;
    const value = max - (tick / 3) * (max - min);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(axisNumber(value), box.x, y - 10);
  }
  const tickCount = Math.min(5, data.years.length);
  for (let tick = 0; tick < tickCount; tick += 1) {
    const index = tickCount === 1 ? 0 : Math.round((tick / (tickCount - 1)) * (data.years.length - 1));
    const x = xFor(index);
    ctx.fillText(String(data.years[index]), x, chartBottom + 12);
  }
  ctx.fillText(data.unit, box.x, box.y + 2);

  for (const series of data.series) {
    ctx.strokeStyle = climateSeriesColor(series.colorIndex);
    ctx.lineWidth = 3;
    let drawing = false;
    series.values.forEach((value, index) => {
      const valid = value !== null && Number.isFinite(value) && (!data.logScale || value > 0);
      if (!valid) {
        drawing = false;
        return;
      }
      if (!drawing) {
        ctx.beginPath();
        ctx.moveTo(xFor(index), yFor(value));
        drawing = true;
      } else {
        ctx.lineTo(xFor(index), yFor(value));
      }
      ctx.stroke();
    });
  }

  const legendY = chartBottom + 48;
  let legendX = left;
  setText(ctx, foreground, `400 20px ${FAMILY}`);
  for (const series of data.series) {
    const nameW = ctx.measureText(series.name).width;
    if (legendX + nameW + 40 > right && legendX !== left) {
      legendX = left;
    }
    ctx.fillStyle = climateSeriesColor(series.colorIndex);
    ctx.fillRect(legendX, legendY + 5, 18, 18);
    ctx.fillStyle = foreground;
    ctx.fillText(series.name, legendX + 26, legendY);
    legendX += nameW + 54;
  }
}

interface CompositionSide {
  title: string;
  segments: { label: string; value: number; color: string }[];
}

export function drawComposition(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { left: CompositionSide; right: CompositionSide },
): void {
  const muted = token("--muted-foreground");
  const foreground = token("--foreground");
  const sides = [data.left, data.right];
  const halfW = box.w / 2;
  const radius = Math.min(halfW * 0.28, box.h * 0.28);
  sides.forEach((side, sideIndex) => {
    const centerX = box.x + halfW * (sideIndex + 0.5);
    const centerY = box.y + radius + 46;
    setText(ctx, foreground, `600 24px ${FAMILY}`, "center");
    ctx.fillText(side.title, centerX, box.y + 4);
    const total = side.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
    let start = -Math.PI / 2;
    for (const segment of side.segments) {
      const amount = Math.max(0, segment.value);
      const end = start + (total ? (amount / total) * Math.PI * 2 : 0);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();
      start = end;
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = token("--background");
    ctx.fill();
    let legendY = centerY + radius + 30;
    setText(ctx, muted, `400 20px ${FAMILY}`);
    for (const segment of side.segments) {
      ctx.fillStyle = segment.color;
      ctx.fillRect(centerX - halfW * 0.38, legendY + 4, 16, 16);
      ctx.fillStyle = muted;
      const percentage = total ? `${((Math.max(0, segment.value) / total) * 100).toFixed(1)}%` : "0.0%";
      ctx.fillText(`${segment.label} ${percentage}`, centerX - halfW * 0.38 + 24, legendY);
      legendY += 28;
    }
  });
}

function drawRing(ctx: CanvasRenderingContext2D, ring: unknown, project: (point: number[]) => [number, number]) {
  if (!Array.isArray(ring) || !ring.length) return;
  let started = false;
  for (const point of ring) {
    if (!Array.isArray(point) || typeof point[0] !== "number" || typeof point[1] !== "number") continue;
    const [x, y] = project(point as number[]);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  if (started) ctx.closePath();
}

function drawPolygon(ctx: CanvasRenderingContext2D, polygon: unknown, project: (point: number[]) => [number, number]) {
  if (!Array.isArray(polygon)) return;
  for (const ring of polygon) drawRing(ctx, ring, project);
}

export function drawWorldMap(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { geojson: GeoJSON.FeatureCollection; countries: CountryClimate[]; highlightIso3?: string },
): void {
  const border = token("--border");
  const secondary = token("--secondary");
  const brand = token("--primary");
  const muted = token("--muted-foreground");
  const mapH = Math.max(1, box.h - 54);
  const aspect = 360 / 145;
  const mapW = Math.min(box.w, mapH * aspect);
  const fittedH = mapW / aspect;
  const mapX = box.x + (box.w - mapW) / 2;
  const mapY = box.y + (mapH - fittedH) / 2;
  const project = (point: number[]): [number, number] => [mapX + ((point[0] + 180) / 360) * mapW, mapY + ((85 - point[1]) / 145) * fittedH];
  const byIso3 = new Map(data.countries.map((country) => [country.iso3, country]));
  const shares = data.countries.map((country) => country.share_pct).filter(Number.isFinite);
  const thresholds = quantileThresholds(shares, CHOROPLETH_SHADES.length);

  for (const feature of data.geojson.features) {
    const properties = feature.properties as { iso3?: string } | null;
    const iso3 = properties?.iso3 ?? (feature.id === undefined ? undefined : String(feature.id));
    const country = iso3 ? byIso3.get(iso3) : undefined;
    const geometry = feature.geometry;
    if (!geometry) continue;
    ctx.beginPath();
    if (geometry.type === "Polygon") drawPolygon(ctx, geometry.coordinates, project);
    else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) drawPolygon(ctx, polygon, project);
    }
    ctx.fillStyle = country ? CHOROPLETH_SHADES[bucketIndex(country.share_pct, thresholds)] : secondary;
    ctx.fill();
    ctx.strokeStyle = iso3 === data.highlightIso3 ? brand : border;
    ctx.lineWidth = iso3 === data.highlightIso3 ? 4 : 1;
    ctx.stroke();
  }

  const legendY = box.y + box.h - 31;
  const swatchW = Math.max(18, Math.min(34, (box.w - 10) / 10));
  setText(ctx, muted, `400 20px ${FAMILY}`);
  for (let index = 0; index < CHOROPLETH_SHADES.length; index += 1) {
    const x = box.x + index * (swatchW + 48);
    ctx.fillStyle = CHOROPLETH_SHADES[index];
    ctx.fillRect(x, legendY, swatchW, 18);
    const label =
      index === 0
        ? `≤${thresholds[0]?.toFixed(2) ?? "0"}`
        : index === thresholds.length
          ? `>${thresholds.at(-1)?.toFixed(2) ?? "0"}`
          : `${thresholds[index - 1]?.toFixed(2) ?? "0"}`;
    ctx.fillStyle = muted;
    ctx.fillText(label, x + swatchW + 5, legendY - 1);
  }
}

export function drawWordCloud(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { words: PlacedWord[]; width: number; height: number },
): void {
  if (!data.words.length || data.width <= 0 || data.height <= 0) return;
  const scale = Math.min(box.w / data.width, box.h / data.height);
  const scaleX = box.w / data.width;
  const scaleY = box.h / data.height;
  data.words.forEach((word, index) => {
    const x = box.x + word.x * scaleX;
    const y = box.y + word.y * scaleY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(1, word.size * scale)}px ${FAMILY}`;
    ctx.fillStyle = climateSeriesColor(index);
    ctx.fillText(word.text, x, y);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  opts: { share?: boolean } = {},
): Promise<"downloaded" | "shared" | "cancelled" | "failed"> {
  let blob: Blob | null;
  try {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    return "failed";
  }
  if (!blob) return "failed";
  let file: File;
  try {
    file = new File([blob], filename, { type: "image/png" });
  } catch {
    return "failed";
  }
  const canShare = typeof navigator !== "undefined" && opts.share && navigator.canShare?.({ files: [file] });
  if (canShare) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}
