import { lazy, useEffect, useState } from "react";
import { floodReliefStrings } from "@/i18n/flood-relief";
import { exportCanvas } from "@/lib/climate-share";
import { districtLabels, districtShapes, riverPath } from "@/lib/geo";
import { loadPosterFonts, token } from "@/lib/poster-draw";
import type { Language } from "@/lib/types";
import type { ReliefCenter, ReliefCenterCategory } from "@/types/relief-center";

export const categoryColors: Record<ReliefCenterCategory, string> = {
  public_dropoff: "rgb(var(--success))",
  coordinating_office: "rgb(var(--primary))",
  incoming_international_staging: "rgb(var(--warning))",
  volunteer_dropoff: "rgb(var(--subtle))",
};

const categoryLabels = {
  public_dropoff: "dropoffPoint",
  coordinating_office: "coordinatingOffice",
  incoming_international_staging: "incomingInternationalStaging",
  volunteer_dropoff: "volunteerDropoff",
} as const;

const categoryList: ReliefCenterCategory[] = [
  "public_dropoff",
  "coordinating_office",
  "incoming_international_staging",
  "volunteer_dropoff",
];

const SHARE_CARD_FAMILY = "'Noto Sans', 'Noto Sans Devanagari', system-ui, sans-serif";
const RELIEF_LIST_WIDTH = 1080;
const RELIEF_LIST_MAX_ROWS = 24;
const RELIEF_LIST_ROW_HEIGHT = 120;
const RELIEF_LIST_MIN_HEIGHT = 520;
const RELIEF_LIST_MAX_HEIGHT = 3400;

const pinPath =
  '<path d="M12 2.5c-3.9 0-7 3-7 6.8 0 5 7 12.2 7 12.2s7-7.2 7-12.2c0-3.8-3.1-6.8-7-6.8Z" fill="currentColor"/><circle cx="12" cy="9.4" r="2.5" fill="rgb(var(--background))"/>';

const defaultMapCenter: [number, number] = [27.7172, 85.324];
const defaultMapZoom = 12;

function resolveTokenColor(value: string) {
  const match = value.match(/var\((--[\w-]+)\)/);
  return match ? token(match[1]) : value;
}

function truncatedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let result = text;
  while (result && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1).trimEnd();
  return result ? `${result}…` : "…";
}

export function drawReliefCentersSummary(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  data: { centers: ReliefCenter[]; language: Language },
): void {
  const strings = floodReliefStrings[data.language];
  const foreground = token("--foreground");
  const muted = token("--muted-foreground");
  const border = token("--border");
  const secondary = token("--secondary");
  const primary = token("--primary");
  const categories = categoryList.filter((category) => data.centers.some((center) => center.category === category));
  const located = data.centers.filter(
    (center): center is ReliefCenter & { lat: number; lng: number } =>
      typeof center.lat === "number" && Number.isFinite(center.lat) && typeof center.lng === "number" && Number.isFinite(center.lng),
  );
  const summaryDistricts = ["Kathmandu", "Nuwakot", "Dhading", "Rasuwa", "Chitwan", "Lalitpur", "Bhaktapur"] as const;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  const districtBounds = new Map<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }>();
  const centerDistrictBounds = new Map<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }>();
  const updateBounds = (
    boundsMap: Map<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }>,
    district: string,
    lat: number,
    lng: number,
  ) => {
    const bounds = boundsMap.get(district) ?? { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
    bounds.minLng = Math.min(bounds.minLng, lng);
    bounds.maxLng = Math.max(bounds.maxLng, lng);
    boundsMap.set(district, bounds);
  };
  const includePoint = (lat: number, lng: number, district?: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    if (district) updateBounds(districtBounds, district, lat, lng);
  };

  for (const district of summaryDistricts) {
    const rings = districtShapes[district];
    if (!rings) continue;
    for (const ring of rings) {
      for (const [lat, lng] of ring) includePoint(lat, lng, district);
    }
  }
  for (const center of located) {
    includePoint(center.lat, center.lng);
    updateBounds(centerDistrictBounds, center.district, center.lat, center.lng);
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return;

  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const paddedMinLat = minLat - latSpan * 0.11;
  const paddedMaxLat = maxLat + latSpan * 0.11;
  const paddedMinLng = minLng - lngSpan * 0.11;
  const paddedMaxLng = maxLng + lngSpan * 0.11;
  const legendFontSize = 20;
  const legendLineHeight = 29;
  const legendGap = 22;
  const legendItems = categories.map((category) => {
    ctx.font = `600 ${legendFontSize}px ${SHARE_CARD_FAMILY}`;
    const label = truncatedText(ctx, strings[categoryLabels[category]], Math.max(0, box.w - 18 - legendGap));
    return { category, label, width: 18 + ctx.measureText(label).width + legendGap };
  });
  let legendRows = 1;
  let legendRowWidth = 0;
  for (const item of legendItems) {
    if (legendRowWidth && legendRowWidth + item.width > box.w) {
      legendRows += 1;
      legendRowWidth = 0;
    }
    legendRowWidth += item.width;
  }
  const unlocatedCount = data.centers.length - located.length;
  const noteHeight = unlocatedCount ? 30 : 0;
  const mapHeight = Math.max(1, box.h - legendRows * legendLineHeight - noteHeight - 18);
  const aspect = lngSpan / latSpan;
  const mapWidth = Math.min(box.w, mapHeight * aspect);
  const fittedHeight = mapWidth / aspect;
  const mapX = box.x + (box.w - mapWidth) / 2;
  const mapY = box.y + (mapHeight - fittedHeight) / 2;
  const project = (point: [number, number]): [number, number] => [
    mapX + ((point[1] - paddedMinLng) / (paddedMaxLng - paddedMinLng)) * mapWidth,
    mapY + ((paddedMaxLat - point[0]) / (paddedMaxLat - paddedMinLat)) * fittedHeight,
  ];

  const drawPath = (path: Array<[number, number]>, close = true) => {
    let started = false;
    for (const point of path) {
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
      const [x, y] = project(point);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (started && close) ctx.closePath();
    return started;
  };

  const hasShape = (district: string) => Boolean(districtShapes[district as keyof typeof districtShapes]);
  const softMarkerDistricts = [...centerDistrictBounds.entries()].filter(([district]) => !hasShape(district));
  const projectBounds = (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
    const [left, bottom] = project([bounds.minLat, bounds.minLng]);
    const [right, top] = project([bounds.maxLat, bounds.maxLng]);
    return {
      minX: Math.min(left, right),
      maxX: Math.max(left, right),
      minY: Math.min(top, bottom),
      maxY: Math.max(top, bottom),
    };
  };

  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapWidth, fittedHeight);
  ctx.clip();
  for (const district of summaryDistricts) {
    const rings = districtShapes[district];
    if (!rings) continue;
    for (const ring of rings) {
      ctx.beginPath();
      if (!drawPath(ring)) continue;
      ctx.fillStyle = secondary;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const areaMarker = token("--accent", 0.42);
  for (const [, bounds] of softMarkerDistricts) {
    const projected = projectBounds(bounds);
    const padding = Math.max(20, Math.min(36, mapWidth * 0.025));
    const centerX = (projected.minX + projected.maxX) / 2;
    const centerY = (projected.minY + projected.maxY) / 2;
    const radiusX = Math.max((projected.maxX - projected.minX) / 2 + padding, 28);
    const radiusY = Math.max((projected.maxY - projected.minY) / 2 + padding, 28);
    ctx.fillStyle = areaMarker;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  drawPath(riverPath, false);
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `500 18px ${SHARE_CARD_FAMILY}`;
  ctx.fillStyle = muted;
  ctx.textAlign = "center";
  const labelHeight = 23;
  const labelGap = 9;
  const labelBoxes: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  const labelFor = (district: string) => districtLabels[district as keyof typeof districtLabels]?.[data.language] ?? district;
  const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: (typeof labelBoxes)[number]) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const placeLabel = (
    district: string,
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    preferred: "center" | "above",
  ) => {
    const label = labelFor(district);
    const width = ctx.measureText(label).width;
    const projected = projectBounds(bounds);
    const centerX = (projected.minX + projected.maxX) / 2;
    const centerY = (projected.minY + projected.maxY) / 2;
    const candidates =
      preferred === "above"
        ? [
            [centerX, projected.minY - labelHeight - labelGap],
            [centerX, projected.maxY + labelGap],
            [projected.maxX + width / 2 + labelGap, centerY - labelHeight / 2],
            [projected.minX - width / 2 - labelGap, centerY - labelHeight / 2],
          ]
        : [
            [centerX, centerY - labelHeight / 2],
            [centerX, projected.minY - labelHeight - labelGap],
            [centerX, projected.maxY + labelGap],
          ];
    const mapRight = mapX + mapWidth;
    const mapBottom = mapY + fittedHeight;
    for (const [candidateX, candidateY] of candidates) {
      const x = Math.min(Math.max(candidateX, mapX + width / 2), mapRight - width / 2);
      const y = Math.min(Math.max(candidateY, mapY), mapBottom - labelHeight);
      const box = { left: x - width / 2, top: y, right: x + width / 2, bottom: y + labelHeight };
      if (labelBoxes.every((existing) => !overlaps(box, existing))) {
        ctx.fillText(label, x, y);
        labelBoxes.push(box);
        return;
      }
    }
  };

  for (const district of summaryDistricts) {
    const bounds = districtBounds.get(district);
    if (bounds) placeLabel(district, bounds, "center");
  }
  for (const [district, bounds] of softMarkerDistricts) placeLabel(district, bounds, "above");

  const radius = Math.max(5, Math.min(8, mapWidth / 120));
  for (const center of located) {
    const [x, y] = project([center.lat, center.lng]);
    ctx.fillStyle = token("--background");
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = resolveTokenColor(categoryColors[center.category]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  let legendX = box.x;
  let legendY = box.y + mapHeight + 8;
  ctx.textAlign = "left";
  ctx.font = `600 ${legendFontSize}px ${SHARE_CARD_FAMILY}`;
  for (const item of legendItems) {
    if (legendX !== box.x && legendX + item.width > box.x + box.w) {
      legendX = box.x;
      legendY += legendLineHeight;
    }
    ctx.fillStyle = resolveTokenColor(categoryColors[item.category]);
    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = foreground;
    ctx.fillText(item.label, legendX + 18, legendY);
    legendX += item.width;
  }

  if (unlocatedCount) {
    ctx.fillStyle = muted;
    ctx.font = `400 19px ${SHARE_CARD_FAMILY}`;
    ctx.fillText(
      truncatedText(ctx, strings.notShownOnMap.replace("{count}", String(unlocatedCount)), box.w),
      box.x,
      legendY + legendLineHeight,
    );
  }

  ctx.restore();
}

export async function drawReliefCentersList(data: {
  event: string;
  title: string;
  subline: string;
  centers: ReliefCenter[];
  language: Language;
}): Promise<"downloaded" | "shared" | "cancelled" | "failed"> {
  await loadPosterFonts();

  const canvas = document.createElement("canvas");
  const headerHeight = 190;
  const footerHeight = 110;
  const margin = 72;
  const needsMoreLine = data.centers.length > RELIEF_LIST_MAX_ROWS;
  const visibleCount = needsMoreLine ? RELIEF_LIST_MAX_ROWS - 1 : data.centers.length;
  const rowCount = Math.max(1, visibleCount + (needsMoreLine ? 1 : 0));
  const height = Math.min(
    RELIEF_LIST_MAX_HEIGHT,
    Math.max(RELIEF_LIST_MIN_HEIGHT, headerHeight + rowCount * RELIEF_LIST_ROW_HEIGHT + footerHeight),
  );
  canvas.width = RELIEF_LIST_WIDTH;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "failed";

  const background = token("--background");
  const foreground = token("--foreground");
  const muted = token("--muted-foreground");
  const border = token("--border");
  const brand = token("--primary");
  const contentWidth = RELIEF_LIST_WIDTH - margin * 2;
  const right = RELIEF_LIST_WIDTH - margin;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, RELIEF_LIST_WIDTH, height);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.fillStyle = foreground;
  ctx.font = `700 54px ${SHARE_CARD_FAMILY}`;
  ctx.fillText(truncatedText(ctx, data.event, contentWidth), margin, 56);
  ctx.fillStyle = muted;
  ctx.font = `400 32px ${SHARE_CARD_FAMILY}`;
  ctx.fillText(truncatedText(ctx, data.title, contentWidth), margin, 122);
  ctx.font = `400 22px ${SHARE_CARD_FAMILY}`;
  ctx.fillText(truncatedText(ctx, data.subline, contentWidth), margin, 160);

  const rowsTop = headerHeight;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, rowsTop);
  ctx.lineTo(right, rowsTop);
  ctx.stroke();

  const strings = floodReliefStrings[data.language];
  const rowTextX = margin + 30;
  const rowTextWidth = contentWidth - 30;
  ctx.font = `700 27px ${SHARE_CARD_FAMILY}`;
  data.centers.slice(0, visibleCount).forEach((center, index) => {
    const rowY = rowsTop + index * RELIEF_LIST_ROW_HEIGHT;
    const district = districtLabels[center.district as keyof typeof districtLabels]?.[data.language] ?? center.district;
    const category = strings[categoryLabels[center.category]];
    const runBy = center.run_by || strings.noAdditionalInfo;

    ctx.fillStyle = resolveTokenColor(categoryColors[center.category]);
    ctx.beginPath();
    ctx.arc(margin + 8, rowY + 28, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = foreground;
    ctx.fillText(truncatedText(ctx, center.name, rowTextWidth), rowTextX, rowY + 12);
    ctx.fillStyle = muted;
    ctx.font = `400 22px ${SHARE_CARD_FAMILY}`;
    ctx.fillText(truncatedText(ctx, center.name_np, rowTextWidth), rowTextX, rowY + 44);
    ctx.font = `400 21px ${SHARE_CARD_FAMILY}`;
    ctx.fillText(truncatedText(ctx, `${district} · ${category}`, rowTextWidth), rowTextX, rowY + 73);
    ctx.fillText(truncatedText(ctx, `${strings.runBy}: ${runBy}`, rowTextWidth), rowTextX, rowY + 97);

    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(margin, rowY + RELIEF_LIST_ROW_HEIGHT);
    ctx.lineTo(right, rowY + RELIEF_LIST_ROW_HEIGHT);
    ctx.stroke();
    ctx.font = `700 27px ${SHARE_CARD_FAMILY}`;
  });

  if (!data.centers.length) {
    ctx.fillStyle = muted;
    ctx.font = `400 26px ${SHARE_CARD_FAMILY}`;
    ctx.fillText(strings.noCenters, rowTextX, rowsTop + 35);
  } else if (needsMoreLine) {
    ctx.fillStyle = muted;
    ctx.font = `600 23px ${SHARE_CARD_FAMILY}`;
    ctx.fillText(`+${data.centers.length - visibleCount} more`, rowTextX, rowsTop + visibleCount * RELIEF_LIST_ROW_HEIGHT + 42);
  }

  const footerTop = height - footerHeight;
  ctx.fillStyle = border;
  ctx.fillRect(margin, footerTop, contentWidth, 1);
  const brandY = height - 72;
  ctx.fillStyle = brand;
  ctx.font = `600 26px ${SHARE_CARD_FAMILY}`;
  ctx.textAlign = "center";
  const label = "verifiednepal.com";
  const labelWidth = ctx.measureText(label).width;
  ctx.fillText(label, RELIEF_LIST_WIDTH / 2, brandY);
  ctx.fillRect(RELIEF_LIST_WIDTH / 2 - labelWidth / 2, brandY + 34, labelWidth, 2);
  ctx.textAlign = "left";

  return exportCanvas(canvas, "flood-relief-drop-centers-list.png", { share: false });
}

export const FloodReliefMap = lazy(async () => {
  const [{ MapContainer, TileLayer, Marker, Tooltip, useMap }, leaflet] = await Promise.all([import("react-leaflet"), import("leaflet")]);
  await import("leaflet/dist/leaflet.css");
  const Leaflet = leaflet.default;

  function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    useEffect(() => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = () => setPrefersReducedMotion(media.matches);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }, []);

    return prefersReducedMotion;
  }

  function MapFocus({ selectedCenter }: { selectedCenter: ReliefCenter | null }) {
    const map = useMap();
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
      if (selectedCenter && selectedCenter.lat !== null && selectedCenter.lng !== null) {
        const target: [number, number] = [selectedCenter.lat, selectedCenter.lng];
        if (prefersReducedMotion) map.setView(target, 13, { animate: false });
        else map.flyTo(target, 13, { duration: 0.8 });
        return;
      }

      if (prefersReducedMotion) map.setView(defaultMapCenter, defaultMapZoom, { animate: false });
      else map.flyTo(defaultMapCenter, defaultMapZoom, { duration: 0.8 });
    }, [map, prefersReducedMotion, selectedCenter?.id, selectedCenter?.lat, selectedCenter?.lng]);

    return null;
  }

  function MapView({ centers, language, selectedId, onSelect }: FloodReliefMapProps) {
    const located = centers.filter((center) => typeof center.lat === "number" && typeof center.lng === "number");
    const selectedCenter = centers.find((center) => center.id === selectedId) ?? null;
    const strings = floodReliefStrings[language];
    const markerIcon = (center: ReliefCenter) => {
      const active = center.id === selectedId;
      const size = active ? 38 : 30;
      return Leaflet.divIcon({
        className: "vn-flood-relief-pin",
        html: `<span style="color:${categoryColors[center.category]};display:block;width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${pinPath}</svg></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });
    };

    return (
      <figure aria-label={strings.mapCaption} className="m-0">
        <div className="relative isolate h-[20rem] overflow-hidden rounded-xl border bg-secondary sm:h-[24rem] lg:h-[36rem]">
          <a
            href="/"
            className="absolute left-1/2 top-2 z-[1001] -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm"
          >
            verifiednepal.com
          </a>
          <MapContainer center={defaultMapCenter} zoom={defaultMapZoom} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus selectedCenter={selectedCenter} />
            {located.map((center) => (
              <Marker
                key={center.id}
                position={[center.lat as number, center.lng as number]}
                icon={markerIcon(center)}
                eventHandlers={{ click: () => onSelect(center.id) }}
                zIndexOffset={center.id === selectedId ? 1000 : 0}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="font-semibold">
                    {center.name}
                    <br />
                    <span className="font-normal">{center.name_np}</span>
                    <br />
                    <span className="text-xs">
                      {center.district} · {strings[categoryLabels[center.category]]}
                    </span>
                  </span>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-subtle">
          {categoryList.map((category) => (
            <span key={category} className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: categoryColors[category] }} aria-hidden="true" />
              {strings[categoryLabels[category]]}
            </span>
          ))}
          <span className="basis-full">{strings.mapCredit}</span>
        </figcaption>
      </figure>
    );
  }

  return { default: MapView };
});

export interface FloodReliefMapProps {
  centers: ReliefCenter[];
  language: Language;
  selectedId: string | null;
  onSelect: (id: string) => void;
}
