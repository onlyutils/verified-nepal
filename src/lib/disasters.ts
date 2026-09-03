import type { DistrictName } from "./districts.ts";
import type { Language } from "@/lib/types";

export type DisasterKind = "flash-flood";

export interface Disaster {
  id: string;
  kind: DisasterKind;
  name: { en: string; ne: string };
  /** YYYY-MM-DD, Nepal time. */
  date: string;
  districts: DistrictName[];
}

/** One entry per disaster this edition of the site covers. Add a row to add a disaster. */
export const DISASTERS: Disaster[] = [
  {
    id: "bhote-koshi-2026",
    kind: "flash-flood",
    name: { en: "Bhote Koshi flash flood", ne: "भोटेकोशी बाढी" },
    date: "2026-08-26",
    districts: ["Rasuwa", "Nuwakot", "Sindhupalchok"],
  },
];

export const CURRENT_DISASTER = DISASTERS[0];

export function disasterStart(disaster: Disaster = CURRENT_DISASTER) {
  return Date.parse(`${disaster.date}T00:00:00+05:45`);
}

export function disasterDateLabel(disaster: Disaster, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(disasterStart(disaster)));
}
