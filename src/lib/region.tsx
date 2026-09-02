import { data } from "@/lib/data";
import { districtLabels, districtNames, locationDistrict, type DistrictName } from "@/lib/geo";
import { labels } from "@/i18n";
import type { Language, NamedLocation } from "@/lib/types";

export const regionOptions = districtNames
  .filter((district) =>
    [data.rescuedLocations.results, data.stationedLocations.results]
      .flat()
      .some((location) => locationDistrict(location) === district || locationTextIncludesDistrict(location, district)),
  )
  .sort((a, b) => districtLabels[a].en.localeCompare(districtLabels[b].en));

export function DistrictFilter({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: string;
  onChange: (region: string) => void;
}) {
  const t = labels[language];
  const options: Array<[string, string]> = [
    ["", t.allAreas],
    ...regionOptions.map((district) => [district, districtLabels[district][language]] as [string, string]),
  ];
  return (
    <div role="group" aria-label={t.whichArea} className="flex flex-wrap gap-x-5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em]">
      {options.map(([option, label]) => (
        <button
          key={option || "all"}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-11 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
            value === option ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
      <span className={compact ? "sr-only" : "block font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground"}>
        {t.whichArea}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-full border border-ink bg-white px-3 font-sans text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${compact ? "" : "mt-2"}`}
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
