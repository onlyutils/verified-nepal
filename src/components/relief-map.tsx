import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { data } from "@/lib/data";
import { districtLabels, districtShapes, locationDistrict, placeLocation, riverPath, type DistrictName } from "@/lib/geo";
import { labels, textForLanguage } from "@/i18n";
import { mapStrings } from "@/i18n/map";
import { locationMatchesRegion } from "@/lib/region";
import type { Language, NamedLocation } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Eyebrow } from "@/components/page-header";

type LatLng = [number, number];
const overviewBounds = L.latLngBounds(riverPath).pad(0.18);

const pinGlyph = {
  rescue:
    '<path d="M12 2C7 8 4 11 4 14.5a8 8 0 0 0 16 0C20 11 17 8 12 2Z" fill="currentColor"/><path d="M7.6 15.4c1.4-1.2 2.5-1.2 3.9 0s2.5 1.2 3.9 0" stroke="rgb(var(--background))" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  camp: '<path d="m12 2.5-9.5 18.5h19L12 2.5Z" fill="currentColor"/><path d="M12 10.5v6M9 13.5h6" stroke="rgb(var(--background))" stroke-width="1.7" stroke-linecap="round"/>',
};

function makeIcon(kind: "rescue" | "camp", active: boolean) {
  const color = kind === "rescue" ? "rgb(var(--destructive))" : "rgb(var(--primary))";
  const size = active ? 42 : 28;
  return L.divIcon({
    className: `vn-pin${active ? " vn-pin--active" : ""}`,
    html: `<span style="color:${color};display:block;width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}">${pinGlyph[kind]}</svg></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

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

function MapFocus({ selectedCenter }: { selectedCenter: LatLng | null }) {
  const map = useMap();
  const prefersReducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (selectedCenter) {
      if (prefersReducedMotion) map.setView(selectedCenter, 13, { animate: false });
      else map.flyTo(selectedCenter, 13, { duration: 0.8 });
      return;
    }
    if (prefersReducedMotion)
      map.setView(overviewBounds.getCenter(), map.getBoundsZoom(overviewBounds, false, L.point(48, 48)), { animate: false });
    else map.fitBounds(overviewBounds, { animate: true, padding: [48, 48] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedCenter?.[0], selectedCenter?.[1], prefersReducedMotion]);
  return null;
}

function MapDragging({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) map.dragging.enable();
    else map.dragging.disable();
  }, [enabled, map]);
  return null;
}

function hasCoordinates(
  location: NamedLocation,
): location is NamedLocation & { centroid: { type: "Point"; coordinates: [number, number] } } {
  return Array.isArray(location.centroid?.coordinates) && location.centroid.coordinates.length === 2;
}

export function ReliefMap({
  language,
  selected,
  onSelect,
  region,
}: {
  language: Language;
  selected: number | null;
  onSelect: (id: number | null) => void;
  region: string;
}) {
  const ts = mapStrings[language];
  const [mapExpanded, setMapExpanded] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const [mapUnlocked, setMapUnlocked] = useState(() => !(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  const camps = data.stationedLocations.results.filter(hasCoordinates).filter((camp) => !region || locationMatchesRegion(camp, region));
  const placed = useMemo(
    () =>
      data.rescuedLocations.results
        .map(placeLocation)
        .filter((place): place is NonNullable<typeof place> => place !== null)
        .filter((place) => !region || locationMatchesRegion(place.location, region)),
    [region],
  );
  const activeDistricts = useMemo(
    () => [
      ...new Set(data.rescuedLocations.results.map(locationDistrict).filter((district): district is DistrictName => district !== null)),
    ],
    [],
  );
  const selectedPlace = placed.find((place) => place.location.id === selected) ?? null;
  const selectedCamp = camps.find((camp) => camp.id === selected) ?? null;
  const selectedCenter = selectedPlace
    ? ([selectedPlace.lat, selectedPlace.lng] as LatLng)
    : selectedCamp
      ? ([selectedCamp.centroid.coordinates[1], selectedCamp.centroid.coordinates[0]] as LatLng)
      : null;

  return (
    <figure aria-label={ts.mapLabel} className="m-0">
      {mapExpanded ? (
        <>
          <div className="relative h-[20rem] overflow-hidden rounded-xl border bg-secondary lg:h-[30rem]">
            <MapContainer
              center={selectedCenter ?? [28.05, 85.33]}
              zoom={selectedCenter ? 11 : 9}
              dragging={mapUnlocked}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              <TileLayer
                attribution=""
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              />
              <MapFocus selectedCenter={selectedCenter} />
              <MapDragging enabled={mapUnlocked} />
              {activeDistricts.map((district) => {
                const isActive =
                  selectedPlace?.district === district || (selectedCamp ? locationMatchesRegion(selectedCamp, district) : false);
                return districtShapes[district]?.map((ring, index) => (
                  <Polygon
                    key={`${district}-${index}`}
                    positions={ring}
                    pathOptions={{
                      color: isActive ? "rgb(var(--destructive))" : "rgb(var(--background))",
                      weight: isActive ? 3 : 1,
                      opacity: isActive ? 1 : 0.6,
                      fillColor: "rgb(var(--foreground))",
                      fillOpacity: isActive ? 0 : selectedPlace ? 0.45 : 0.18,
                    }}
                  >
                    <Tooltip sticky>{districtLabels[district][language]}</Tooltip>
                  </Polygon>
                ));
              })}
              <Polyline positions={riverPath} pathOptions={{ color: "rgb(var(--foreground))", weight: 9, opacity: 0.25 }} />
              <Polyline positions={riverPath} pathOptions={{ color: "rgb(var(--background))", weight: 3, opacity: 0.95 }}>
                <Tooltip sticky>{ts.mapLabel}</Tooltip>
              </Polyline>
              {camps.map((camp) => {
                const [lng, lat] = camp.centroid.coordinates;
                const active = camp.id === selected;
                return (
                  <Marker
                    key={`camp-${camp.id}`}
                    position={[lat, lng]}
                    icon={makeIcon("camp", active)}
                    title={`${textForLanguage(camp, language)} — ${ts.reliefCamps}`}
                    eventHandlers={{ click: () => onSelect(active ? null : camp.id) }}
                  />
                );
              })}
              {placed.map((place) => {
                const active = place.location.id === selected;
                return (
                  <Marker
                    key={`rescue-${place.location.id}`}
                    position={[place.lat, place.lng]}
                    icon={makeIcon("rescue", active)}
                    title={textForLanguage(place.location, language)}
                    zIndexOffset={active ? 1000 : 0}
                    eventHandlers={{ click: () => onSelect(active ? null : place.location.id) }}
                  >
                    <Tooltip direction="top" offset={[0, -6]}>
                      <span className="font-semibold">
                        {textForLanguage(place.location, language)}
                        {place.approximate ? ` (${labels[language].approximate})` : ""}
                      </span>
                      <br />
                      <span className="text-xs">
                        {districtLabels[place.district][language]} · {labels[language].district}
                      </span>
                    </Tooltip>
                  </Marker>
                );
              })}
            </MapContainer>
            {!mapUnlocked ? (
              <Button
                type="button"
                variant="default"
                onClick={() => setMapUnlocked(true)}
                className="absolute inset-x-4 top-4 z-[500] mx-auto max-w-xs"
              >
                {ts.tapToExplore}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMapUnlocked(false)}
                className="absolute right-3 top-3 z-[500] bg-background"
              >
                {ts.collapseMap}
              </Button>
            )}
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-subtle">
            <span className="text-sm text-foreground">{ts.mapCaption}</span>
            <LegendDot className="bg-destructive" label={ts.rescuePoints} />
            <LegendDot className="bg-primary" label={ts.reliefCamps} />
            <span className="basis-full">{labels[language].mapCredit}</span>
          </figcaption>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => setMapExpanded(true)} aria-expanded={false}>
          {ts.showMap}
        </Button>
      )}
    </figure>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-2 rounded-full ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function AffectedLocations({
  language,
  selected,
  onSelect,
  region,
  query = "",
}: {
  language: Language;
  selected: number | null;
  onSelect: (id: number | null) => void;
  region: string;
  query?: string;
}) {
  const ts = mapStrings[language];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return data.stationedLocations.results.filter((location) => {
      if (region && !locationMatchesRegion(location, region)) return false;
      if (!normalized) return true;
      return `${location.title} ${location.title_ne}`.toLocaleLowerCase().includes(normalized);
    });
  }, [query, region]);
  const locations = filtered.slice(0, 5);
  const mappedCount = filtered.filter((location) => placeLocation(location)).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Eyebrow tone="muted">{ts.affectedLocations}</Eyebrow>
        <span className="text-xs text-subtle">
          {formatNumber(mappedCount, language)}/{formatNumber(filtered.length, language)} {ts.locationsMapped}
        </span>
      </div>
      {locations.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {locations.map((location) => {
              const place = placeLocation(location);
              const active = selected === location.id;
              const district = locationDistrict(location);
              return (
                <li
                  key={location.id}
                  className={`flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3 ${active ? "bg-primary-soft" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{textForLanguage(location, language)}</p>
                    <p className="text-xs text-subtle">
                      {ts.reliefLocationType} · {district ? districtLabels[district][language] : labels[language].unavailable}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto min-h-11 shrink-0 px-0"
                    disabled={!place}
                    aria-pressed={active}
                    onClick={() => onSelect(active ? null : location.id)}
                  >
                    {place ? (active ? ts.clearSelection : ts.viewDetails) : ts.notMapped}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState title={labels[language].unavailable} description={ts.mapHint} />
      )}
    </div>
  );
}
