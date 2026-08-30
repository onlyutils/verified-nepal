import L from "leaflet";
import { MapPin } from "lucide-react";
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
import { locationMatchesRegion, RegionSelect } from "./region";
import type { Language, NamedLocation } from "./types";
import { formatNumber } from "./utils";
import { Panel, SourceCaption } from "./ui";

type LatLng = [number, number];

const overviewBounds = L.latLngBounds(riverPath).pad(0.18);

const pinGlyph = {
  rescue:
    '<path d="M12 2C7 8 4 11 4 14.5a8 8 0 0 0 16 0C20 11 17 8 12 2Z" fill="currentColor"/><path d="M7.6 15.4c1.4-1.2 2.5-1.2 3.9 0s2.5 1.2 3.9 0" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
  camp: '<path d="M12 2.5 2.5 21h19L12 2.5Z" fill="currentColor"/><path d="M12 10.5v6M9 13.5h6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>',
};

function makeIcon(kind: "rescue" | "camp", active: boolean) {
  const color = kind === "rescue" ? "#DC143C" : "#0B62E0";
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
    <Panel
      title={t.reliefMap}
      icon={MapPin}
      footer={<SourceCaption language={language} />}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RegionSelect language={language} value={region} onChange={onRegionChange} compact />
          {selected !== null ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="min-h-11 px-2 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-nepal-crimson hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
            >
              {t.clearSelection}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-nepal-slate">
        <LegendDot color="#DC143C">{t.rescuePoints}</LegendDot>
        <LegendDot color="#0B62E0">{t.reliefCamps}</LegendDot>
        <LegendDot color="#7DD3FC">{t.riverLabel}</LegendDot>
      </div>
      <div className="relative h-[20rem] overflow-hidden border border-nepal-line lg:h-[26rem]">
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
          {/* Place names and borders ride on top of the imagery. */}
          <TileLayer
            attribution=""
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          />
          <MapFocus selectedCenter={selectedPlace ? [selectedPlace.lat, selectedPlace.lng] : null} />
          <MapDragging enabled={mapUnlocked} />

          {/* Spotlight: a scrim dims every district, and the selected one clears it. */}
          {activeDistricts.map((district) => {
            const isActive = selectedPlace?.district === district;
            return districtShapes[district]?.map((ring, index) => (
              <Polygon
                key={`${district}-${index}`}
                positions={ring}
                pathOptions={{
                  color: isActive ? "#FF2D55" : "#E6ECF7",
                  weight: isActive ? 3 : 1,
                  opacity: isActive ? 1 : 0.5,
                  fillColor: "#0B1220",
                  fillOpacity: isActive ? 0 : selectedPlace ? 0.45 : 0.18,
                }}
              >
                <Tooltip sticky>{districtLabels[district][language]}</Tooltip>
              </Polygon>
            ));
          })}

          {/* Two passes: a soft halo under a bright core, so the river reads at every zoom. */}
          <Polyline positions={riverPath} pathOptions={{ color: "#38BDF8", weight: 11, opacity: 0.2 }} />
          <Polyline positions={riverPath} pathOptions={{ color: "#7DD3FC", weight: 3, opacity: 0.95 }}>
            <Tooltip sticky>{t.riverLabel}</Tooltip>
          </Polyline>

          {camps.map((camp) => {
            const [lng, lat] = camp.centroid.coordinates;
            return (
              <Marker key={`camp-${camp.id}`} position={[lat, lng]} icon={makeIcon("camp", false)}>
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
          <button
            type="button"
            onClick={() => setMapUnlocked(true)}
            className="absolute inset-x-4 top-4 z-[500] mx-auto flex min-h-12 max-w-xs items-center justify-center bg-white px-4 text-sm font-bold text-nepal-ink shadow-lift transition hover:bg-nepal-blueSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
          >
            {t.tapToExploreMap}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMapUnlocked(false)}
            className="absolute right-3 top-3 z-[500] min-h-11 bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] text-nepal-blue shadow-panel transition hover:text-nepal-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
          >
            {t.collapseMap}
          </button>
        )}
      </div>
      <p className="mt-3 text-[0.68rem] leading-5 text-nepal-slate">{t.mapCredit}</p>
    </Panel>
  );
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
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
    <section className="flex flex-col border border-nepal-line bg-white shadow-panel">
      <div className="border-b border-nepal-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="shrink-0 text-nepal-crimson" size={17} aria-hidden="true" />
          <h2 className="min-w-0 text-[0.8rem] font-bold uppercase leading-5 tracking-[0.08em] text-nepal-ink">
            {t.affectedDistricts}
          </h2>
        </div>
        <span className="mt-2 block text-[0.7rem] font-bold tabular-nums uppercase tracking-[0.08em] text-nepal-slate">
          {formatNumber(mappedCount, language)}/
          {formatNumber(filteredRescueLocations.length, language)} {t.locationsMapped}
        </span>
      </div>
      <div className="flex-1 p-4">
        <p className="text-sm leading-6 text-nepal-slate">{t.mapHint}</p>
        <div className="mt-4 max-h-[28rem] space-y-4 overflow-auto pr-1">
          {nearbyCamps.length ? (
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-crimson">
                {t.reliefCamps}
              </p>
              <ul className="mt-2 divide-y divide-nepal-line border-y border-nepal-line">
                {nearbyCamps.map((camp) => (
                  <li key={`nearby-camp-${camp.id}`}>
                    <div className="flex min-h-11 w-full items-center gap-3 bg-nepal-crimsonSoft px-2 py-2.5 text-left text-sm font-semibold text-nepal-ink">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-nepal-blue" aria-hidden="true" />
                      <span className="truncate">{textForLanguage(camp, language)}</span>
                      <span className="ml-auto shrink-0 bg-white px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-nepal-crimson">
                        {t.nearYou}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {groups.map(([district, locations]) => (
            <div key={district}>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-nepal-blue">
                {district === "other" ? t.unavailable : districtLabels[district][language]}
              </p>
              <ul className="mt-2 divide-y divide-nepal-line border-y border-nepal-line">
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
                        className={`flex min-h-11 w-full items-center gap-3 px-2 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nepal-crimson ${
                          active
                            ? "bg-nepal-crimsonSoft font-bold text-nepal-crimson"
                            : place
                              ? "font-medium text-nepal-ink hover:bg-nepal-blueSoft"
                              : "cursor-not-allowed text-nepal-slate"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            active ? "bg-nepal-crimson" : place ? "bg-nepal-blue" : "bg-nepal-line"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {textForLanguage(location, language)}
                          {approximate}
                        </span>
                        {!place ? (
                          <span className="ml-auto shrink-0 text-[0.65rem] uppercase tracking-wide">
                            {t.notMapped}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 pt-1">
        <SourceCaption language={language} />
      </div>
    </section>
  );
}
