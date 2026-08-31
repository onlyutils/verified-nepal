import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { data } from "./data";
import {
  districtLabels,
  districtShapes,
  locationDistrict,
  placeLocation,
  riverPath,
  type DistrictName,
} from "./geo";
import { labels, textForLanguage } from "./i18n";
import { DistrictFilter, locationMatchesRegion, RegionSelect } from "./region";
import type { Language, NamedLocation } from "./types";
import { formatNumber } from "./utils";
import { Byline, Rule, SectionLabel, SquareButton } from "./ui";

type LatLng = [number, number];

const overviewBounds = L.latLngBounds(riverPath).pad(0.18);

const pinGlyph = {
  rescue:
    '<path d="M12 2C7 8 4 11 4 14.5a8 8 0 0 0 16 0C20 11 17 8 12 2Z" fill="currentColor"/><path d="M7.6 15.4c1.4-1.2 2.5-1.2 3.9 0s2.5 1.2 3.9 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  camp: '<path d="M12 2.5 2.5 21h19L12 2.5Z" fill="currentColor"/><path d="M12 10.5v6M9 13.5h6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
};

function makeIcon(kind: "rescue" | "camp", active: boolean) {
  const color = kind === "rescue" ? "#DC143C" : "#003893";
  const size = active ? 42 : 28;
  return L.divIcon({
    className: `vn-pin${active ? " vn-pin--active" : ""}`,
    html: `<span style="color:${color};display:block;width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}">${pinGlyph[kind]}</svg></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return prefersReducedMotion;
}

/** Pans/zooms when the selection changes; renders nothing. */
function MapFocus({ selectedCenter }: { selectedCenter: LatLng | null }) {
  const map = useMap();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (selectedCenter) {
      if (prefersReducedMotion) {
        map.setView(selectedCenter, 13, { animate: false });
      } else {
        map.flyTo(selectedCenter, 13, { duration: 0.8 });
      }
      return;
    }

    if (prefersReducedMotion) {
      map.setView(overviewBounds.getCenter(), map.getBoundsZoom(overviewBounds, false, L.point(48, 48)), {
        animate: false,
      });
    } else {
      map.fitBounds(overviewBounds, {
        animate: true,
        padding: [48, 48],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedCenter?.[0], selectedCenter?.[1], prefersReducedMotion]);
  return null;
}

function MapDragging({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
    } else {
      map.dragging.disable();
    }
  }, [enabled, map]);
  return null;
}

function hasCoordinates(location: NamedLocation): location is NamedLocation & {
  centroid: { type: "Point"; coordinates: [number, number] };
} {
  return Array.isArray(location.centroid?.coordinates) && location.centroid.coordinates.length === 2;
}

export function ReliefMap({
  language,
  selected,
  onSelect,
  region,
  onRegionChange,
}: {
  language: Language;
  selected: number | null;
  onSelect: (id: number | null) => void;
  region: string;
  onRegionChange: (region: string) => void;
}) {
  const t = labels[language];
  const [mapUnlocked, setMapUnlocked] = useState(
    () => !(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window),
  );
  const camps = data.stationedLocations.results
    .filter(hasCoordinates)
    .filter((camp) => !region || locationMatchesRegion(camp, region));
  const placed = useMemo(
    () =>
      data.rescuedLocations.results
        .map(placeLocation)
        .filter((place): place is NonNullable<typeof place> => place !== null)
        .filter((place) => !region || locationMatchesRegion(place.location, region)),
    [region],
  );
  const activeDistricts = useMemo(
    () =>
      [
        ...new Set(
          data.rescuedLocations.results
            .map(locationDistrict)
            .filter((district): district is DistrictName => district !== null),
        ),
      ],
    [],
  );
  const selectedPlace = placed.find((place) => place.location.id === selected) ?? null;
  const center: LatLng = selectedPlace
    ? [selectedPlace.lat, selectedPlace.lng]
    : [28.05, 85.33];
  const zoom = selectedPlace ? 11 : 9;

  return (
    <figure aria-labelledby="map-heading" className="m-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionLabel id="map-heading" className="flex-1 border-b-0 pb-0">
          {t.reliefMap}
        </SectionLabel>
        <div className="hidden sm:block">
          <DistrictFilter language={language} value={region} onChange={onRegionChange} />
        </div>
        <div className="w-full sm:hidden">
          <RegionSelect language={language} value={region} onChange={onRegionChange} compact />
        </div>
        {selected !== null ? (
          <SquareButton onClick={() => onSelect(null)}>{t.clearSelection}</SquareButton>
        ) : null}
      </div>
      <Rule className="mt-2" />
      <div className="relative mt-4 h-[20rem] overflow-hidden border border-ink bg-paper lg:h-[30rem]">
        <MapContainer
          center={center}
          zoom={zoom}
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
          <MapFocus selectedCenter={selectedPlace ? [selectedPlace.lat, selectedPlace.lng] : null} />
          <MapDragging enabled={mapUnlocked} />

          {activeDistricts.map((district) => {
            const isActive = selectedPlace?.district === district;
            return districtShapes[district]?.map((ring, index) => (
              <Polygon
                key={`${district}-${index}`}
                positions={ring}
                pathOptions={{
                  color: isActive ? "#DC143C" : "#FFFFFF",
                  weight: isActive ? 3 : 1,
                  opacity: isActive ? 1 : 0.6,
                  fillColor: "#0A0A0A",
                  fillOpacity: isActive ? 0 : selectedPlace ? 0.45 : 0.18,
                }}
              >
                <Tooltip sticky>{districtLabels[district][language]}</Tooltip>
              </Polygon>
            ));
          })}

          <Polyline positions={riverPath} pathOptions={{ color: "#0A0A0A", weight: 9, opacity: 0.25 }} />
          <Polyline positions={riverPath} pathOptions={{ color: "#FFFFFF", weight: 3, opacity: 0.95 }}>
            <Tooltip sticky>{t.riverLabel}</Tooltip>
          </Polyline>

          {camps.map((camp) => {
            const [lng, lat] = camp.centroid.coordinates;
            return (
              <Marker
                key={`camp-${camp.id}`}
                position={[lat, lng]}
                icon={makeIcon("camp", false)}
                title={`${textForLanguage(camp, language)} — ${t.reliefCamps}`}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="font-semibold">{textForLanguage(camp, language)}</span>
                  <br />
                  <span className="text-[0.7rem] uppercase tracking-wide">{t.reliefCamps}</span>
                </Tooltip>
              </Marker>
            );
          })}

          {placed.map((place) => {
            const active = place.location.id === selected;
            const approximate = place.approximate ? ` (${t.approximate})` : "";
            return (
              <Marker
                key={`rescue-${place.location.id}`}
                position={[place.lat, place.lng]}
                icon={makeIcon("rescue", active)}
                title={`${textForLanguage(place.location, language)}${approximate}`}
                zIndexOffset={active ? 1000 : 0}
                eventHandlers={{ click: () => onSelect(active ? null : place.location.id) }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="font-semibold">
                    {textForLanguage(place.location, language)}
                    {approximate}
                  </span>
                  <br />
                  <span className="text-[0.7rem] uppercase tracking-wide">
                    {districtLabels[place.district][language]} {t.district}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>
        {!mapUnlocked ? (
          <SquareButton
            tone="primary"
            onClick={() => setMapUnlocked(true)}
            className="absolute inset-x-4 top-4 z-[500] mx-auto max-w-xs"
          >
            {t.tapToExploreMap}
          </SquareButton>
        ) : (
          <SquareButton onClick={() => setMapUnlocked(false)} className="absolute right-3 top-3 z-[500] bg-paper">
            {t.collapseMap}
          </SquareButton>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-sans text-[0.72rem] leading-5 text-muted">
        <span className="font-serif text-sm italic text-ink">{t.mapPlateCaption}</span>
        <LegendDot color="#DC143C">{t.rescuePoints}</LegendDot>
        <LegendDot color="#003893">{t.reliefCamps}</LegendDot>
        <LegendDot color="#FFFFFF" outlined>
          {t.riverLabel}
        </LegendDot>
        <span className="basis-full">{t.mapCredit}</span>
      </figcaption>
      <Byline language={language} className="mt-1" />
    </figure>
  );
}

function LegendDot({ color, outlined = false, children }: { color: string; outlined?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${outlined ? "border border-ink" : ""}`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export function AffectedLocations({
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
  const t = labels[language];
  const groups = useMemo(() => {
    const byDistrict = new Map<DistrictName | "other", NamedLocation[]>();
    const locations = data.rescuedLocations.results.filter(
      (location) => !region || locationMatchesRegion(location, region),
    );
    for (const location of locations) {
      const key = locationDistrict(location) ?? "other";
      byDistrict.set(key, [...(byDistrict.get(key) ?? []), location]);
    }
    return [...byDistrict.entries()];
  }, [region]);
  const nearbyCamps = useMemo(
    () =>
      region
        ? data.stationedLocations.results.filter((location) => locationMatchesRegion(location, region))
        : [],
    [region],
  );
  const filteredRescueLocations = data.rescuedLocations.results.filter(
    (location) => !region || locationMatchesRegion(location, region),
  );
  const mappedCount = filteredRescueLocations.filter((location) => placeLocation(location)).length;

  return (
    <section aria-labelledby="locations-heading" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel id="locations-heading" className="flex-1">
          {t.affectedDistricts}
        </SectionLabel>
        <span className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          {formatNumber(mappedCount, language)}/{formatNumber(filteredRescueLocations.length, language)}{" "}
          {t.locationsMapped}
        </span>
      </div>
      <p className="mt-3 font-serif text-sm italic text-muted">{t.mapHint}</p>
      <div className="mt-3 grid max-h-[24rem] gap-x-8 gap-y-4 overflow-auto pr-1 md:grid-cols-2 lg:max-h-none lg:grid-cols-3 lg:overflow-visible">
        {nearbyCamps.length ? (
          <div>
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-red">{t.reliefCamps}</p>
            <ul className="mt-1 divide-y divide-rule border-y border-rule">
              {nearbyCamps.map((camp) => (
                <li key={`nearby-camp-${camp.id}`} className="flex min-h-11 items-center justify-between gap-3 font-sans text-sm text-ink">
                  <span className="truncate">{textForLanguage(camp, language)}</span>
                  <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted">{t.nearYou}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {groups.map(([district, locations]) => (
          <div key={district}>
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink">
              {district === "other" ? t.unavailable : districtLabels[district][language]}
            </p>
            <ul className="mt-1 divide-y divide-rule border-y border-rule">
              {locations.map((location) => {
                const place = placeLocation(location);
                const active = location.id === selected;
                const approximate = place?.approximate ? ` (${t.approximate})` : "";
                return (
                  <li key={location.id}>
                    <button
                      type="button"
                      disabled={!place}
                      onClick={() => onSelect(active ? null : location.id)}
                      aria-pressed={active}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 text-left font-sans text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red ${
                        active ? "font-semibold text-red" : place ? "text-ink hover:text-red" : "cursor-not-allowed text-muted"
                      }`}
                    >
                      <span className="truncate">
                        {textForLanguage(location, language)}
                        {approximate}
                      </span>
                      {!place ? (
                        <span className="shrink-0 text-[0.65rem] uppercase tracking-wide">{t.notMapped}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
