import "leaflet/dist/leaflet.css";
import type { Layer, PathOptions } from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer } from "react-leaflet";
import { loadWorldGeoJson, type CountryClimate } from "@/lib/climate-data";

const CHOROPLETH_SHADES = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a", "#172554"];

function quantileThresholds(values: number[], buckets: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: buckets - 1 }, (_, i) => sorted[Math.floor(((i + 1) / buckets) * (sorted.length - 1))]);
}

function bucketIndex(value: number, thresholds: number[]) {
  let i = 0;
  while (i < thresholds.length && value > thresholds[i]) i += 1;
  return i;
}

export function WorldMap({
  countries,
  selectedIso3,
  onSelect,
  noDataLabel,
  loadingLabel,
}: {
  countries: CountryClimate[];
  selectedIso3: string;
  onSelect: (iso3: string) => void;
  noDataLabel: string;
  loadingLabel: string;
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
    <div className="h-80 overflow-hidden rounded-xl border">
      <MapContainer center={[20, 8]} zoom={1} minZoom={1} className="h-full w-full" scrollWheelZoom={false} worldCopyJump>
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
            const label = country
              ? `${country.name}: ${country.warming_c.toFixed(4)}°C · ${country.share_pct.toFixed(2)}%`
              : `${(feature.properties?.name as string | undefined) ?? iso3} — ${noDataLabel}`;
            layer.bindTooltip(label, { sticky: true });
            layer.on("click", () => {
              if (country) onSelect(country.iso3);
            });
          }}
        />
      </MapContainer>
    </div>
  );
}
