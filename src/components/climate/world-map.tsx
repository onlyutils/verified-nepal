import "leaflet/dist/leaflet.css";
import type { Layer, PathOptions } from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer } from "react-leaflet";
import { loadWorldGeoJson, type CountryClimate } from "@/lib/climate-data";
import { CHOROPLETH_SHADES, bucketIndex, quantileThresholds } from "@/lib/climate-colors";

function formatPct(value: number) {
  return `${value.toLocaleString(undefined, { maximumSignificantDigits: value < 1 ? 2 : 3 })}%`;
}

function bucketLabel(index: number, thresholds: number[]) {
  if (index === 0) return `< ${formatPct(thresholds[0])}`;
  if (index === thresholds.length) return `> ${formatPct(thresholds[thresholds.length - 1])}`;
  return `${formatPct(thresholds[index - 1])} – ${formatPct(thresholds[index])}`;
}

export function WorldMap({
  countries,
  selectedIso3,
  onSelect,
  noDataLabel,
  loadingLabel,
  legendTitle,
  nepalPopup,
}: {
  countries: CountryClimate[];
  selectedIso3: string;
  onSelect: (iso3: string) => void;
  noDataLabel: string;
  loadingLabel: string;
  legendTitle: string;
  nepalPopup: string;
}) {
  const [geoJson, setGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let active = true;
    void loadWorldGeoJson().then((data) => {
      if (active) setGeoJson(data);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!geoJson) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border text-sm text-muted-foreground" role="status">
        {loadingLabel}
      </div>
    );
  }

  const byIso3 = new Map(countries.map((c) => [c.iso3, c]));
  const thresholds = quantileThresholds(
    countries.map((c) => c.share_pct),
    CHOROPLETH_SHADES.length,
  );

  return (
    <div className="space-y-2">
      <div className="h-80 overflow-hidden rounded-xl border">
        <MapContainer center={[28.4, 84.1]} zoom={6} minZoom={1} className="h-full w-full" scrollWheelZoom={false} worldCopyJump>
          <GeoJSON
            key={selectedIso3}
            data={geoJson}
            style={(feature): PathOptions => {
              const country = feature?.id ? byIso3.get(String(feature.id)) : undefined;
              const isSelected = feature?.id !== undefined && String(feature.id) === selectedIso3;
              return {
                fillColor: country ? CHOROPLETH_SHADES[bucketIndex(country.share_pct, thresholds)] : "rgb(var(--secondary))",
                fillOpacity: 0.85,
                color: isSelected ? "rgb(var(--destructive))" : "rgb(var(--border))",
                weight: isSelected ? 2.5 : 0.5,
              };
            }}
            onEachFeature={(feature, layer: Layer) => {
              const iso3 = feature.id ? String(feature.id) : "";
              const country = byIso3.get(iso3);
              const label =
                iso3 === "NPL"
                  ? nepalPopup
                  : country
                    ? `${country.name}: ${country.warming_c.toFixed(4)}°C · ${country.share_pct.toFixed(2)}%`
                    : `${(feature.properties?.name as string | undefined) ?? iso3} — ${noDataLabel}`;
              layer.bindTooltip(label, { sticky: true });
              if (country && iso3 === selectedIso3) {
                layer.bindPopup(label);
                layer.on("add", () => layer.openPopup());
              }
              layer.on("click", () => {
                if (country) onSelect(country.iso3);
              });
            }}
          />
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{legendTitle}:</span>
        {CHOROPLETH_SHADES.map((color, i) => (
          <span key={color} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
            {bucketLabel(i, thresholds)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-secondary" aria-hidden="true" />
          {noDataLabel}
        </span>
      </div>
    </div>
  );
}
