import { data } from "@/lib/data";
import { districtLabels, districtNames, locationDistrict, type DistrictName } from "@/lib/geo";
import type { Language, NamedLocation } from "@/lib/types";

export const regionOptions = districtNames
  .filter((district) =>
    [data.rescuedLocations.results, data.stationedLocations.results]
      .flat()
      .some((location) => locationDistrict(location) === district || locationTextIncludesDistrict(location, district)),
  )
  .sort((a, b) => districtLabels[a].en.localeCompare(districtLabels[b].en));

export function locationTextIncludesDistrict(location: NamedLocation, district: DistrictName) {
  const labelsForDistrict = districtLabels[district];
  const text = `${location.title || ""} ${location.title_ne || ""}`.toLocaleLowerCase();
  return text.includes(labelsForDistrict.en.toLocaleLowerCase()) || text.includes(labelsForDistrict.ne.toLocaleLowerCase());
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

const districtPlaceHints: Partial<Record<DistrictName, string[]>> = {
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
  return districtPlaceHints[district]?.some((hint) => text.includes(hint.toLocaleLowerCase())) ?? false;
}
