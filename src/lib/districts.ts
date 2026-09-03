/** District names and labels, kept free of JSON imports so pure modules (and node tests) can use them. */
export type DistrictName = "Rasuwa" | "Nuwakot" | "Sindhupalchok";

export const districtLabels: Record<DistrictName, { en: string; ne: string }> = {
  Rasuwa: { en: "Rasuwa", ne: "रसुवा" },
  Nuwakot: { en: "Nuwakot", ne: "नुवाकोट" },
  Sindhupalchok: { en: "Sindhupalchok", ne: "सिन्धुपाल्चोक" },
};

export const districtNames = Object.keys(districtLabels) as DistrictName[];
