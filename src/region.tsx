import { data } from "./data";
import { districtLabels, districtNames, locationDistrict, type DistrictName } from "./geo";
import { labels } from "./i18n";
import type { Language, NamedLocation } from "./types";

export const regionOptions = districtNames
  .filter((district) =>
    [data.rescuedLocations.results, data.stationedLocations.results]
      .flat()
      .some((location) => locationDistrict(location) === district || locationTextIncludesDistrict(location, district)),
  )
  .sort((a, b) => districtLabels[a].en.localeCompare(districtLabels[b].en));

export function RegionSelect({
  language,
  value,
  onChange,
  compact = false,
}: {
  language: Language;
  value: string;
  onChange: (region: string) => void;
  compact?: boolean;
}) {
  const t = labels[language];
  const id = compact ? "map-region" : "agent-region";

  return (
    <label className={`block ${compact ? "min-w-[11rem]" : ""}`} htmlFor={id}>
      <span className={compact ? "sr-only" : "block text-sm font-semibold text-nepal-onDark"}>
        {t.whichArea}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-full border bg-white text-sm font-semibold text-nepal-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson ${
          compact
            ? "border-nepal-line px-3"
            : "mt-2 border-white/20 px-3 focus-visible:ring-offset-2 focus-visible:ring-offset-nepal-ink"
        }`}
      >
        <option value="">{t.allAreas}</option>
        {regionOptions.map((district) => (
          <option key={district} value={district}>
            {districtLabels[district][language]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function locationTextIncludesDistrict(location: NamedLocation, district: DistrictName) {
  const labelsForDistrict = districtLabels[district];
  const text = `${location.title || ""} ${location.title_ne || ""}`.toLocaleLowerCase();
  return (
    text.includes(labelsForDistrict.en.toLocaleLowerCase()) ||
    text.includes(labelsForDistrict.ne.toLocaleLowerCase())
  );
}

export function locationMatchesRegion(location: NamedLocation, region: string) {
  if (!region) return true;
  const district = region as DistrictName;
  return (
    locationDistrict(location) === district ||
    locationTextIncludesDistrict(location, district) ||
    locationTextHasKnownPlace(location, district)
  );
}

const districtPlaceHints: Record<DistrictName, string[]> = {
  Rasuwa: [
    "dhunche",
    "syabru",
    "timure",
    "kalikasthan",
    "dhaibung",
    "rasuwa",
    "धुन्चे",
    "स्याफ्रु",
    "टिमुरे",
    "कालिकास्थान",
    "धैबुङ",
    "रसुवा",
  ],
  Nuwakot: ["bidur", "trishuli", "battar", "nuwakot", "विदुर", "त्रिशूली", "बट्टार", "नुवाकोट"],
  Sindhupalchok: ["sindhupalchok", "sindhupalchowk", "सिन्धुपाल्चोक"],
};

function locationTextHasKnownPlace(location: NamedLocation, district: DistrictName) {
  const text = `${location.title || ""} ${location.title_ne || ""}`.toLocaleLowerCase();
  return districtPlaceHints[district].some((hint) => text.includes(hint.toLocaleLowerCase()));
}
