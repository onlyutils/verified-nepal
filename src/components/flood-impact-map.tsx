import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { riverPath } from "@/lib/geo";
import type { FloodFrame, FloodManifest } from "@/lib/flood-manifest";

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

function makeIcon(active: boolean) {
  const size = active ? 20 : 14;
  return L.divIcon({
    className: "vn-flood-pin",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:rgb(var(--${active ? "destructive" : "primary"}));border:2px solid rgb(var(--background))"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapFocus({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prefersReducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!target) return;
    if (prefersReducedMotion) map.setView(target, 16, { animate: false });
    else map.flyTo(target, 16, { duration: 0.8 });
  }, [target, map, prefersReducedMotion]);
  return null;
}

export function FloodImpactMap({
  frames,
  activeIndex,
  onSelect,
  aoi,
  className,
}: {
  frames: FloodFrame[];
  activeIndex: number;
  onSelect: (index: number) => void;
  aoi: FloodManifest["aoi"];
  className?: string;
}) {
  const active = frames[activeIndex];
  const aoiPositions: [number, number][] =
    aoi.type === "Polygon" && Array.isArray(aoi.coordinates)
      ? ((aoi.coordinates as number[][][])[0]?.map(([lng, lat]) => [lat, lng]) ?? [])
      : [];

  return (
    <MapContainer
      center={[active.location.lat, active.location.lng]}
      zoom={16}
      scrollWheelZoom={false}
      className={`vn-flood-map h-full min-h-80 w-full rounded-lg ${className ?? ""}`}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
      />
      {aoiPositions.length > 0 ? (
        <Polygon positions={aoiPositions} pathOptions={{ color: "rgb(var(--primary))", weight: 2, fillOpacity: 0.08 }} />
      ) : null}
      <Polyline positions={riverPath} pathOptions={{ color: "#38bdf8", weight: 3, opacity: 0.9 }} />
      {frames.map((frame, index) => (
        <Marker
          key={frame.location.label}
          position={[frame.location.lat, frame.location.lng]}
          icon={makeIcon(index === activeIndex)}
          eventHandlers={{ click: () => onSelect(index) }}
        >
          <Tooltip>{frame.location.label}</Tooltip>
        </Marker>
      ))}
      <MapFocus target={[active.location.lat, active.location.lng]} />
    </MapContainer>
  );
}
