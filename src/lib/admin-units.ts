import raw from "./admin-units.json" with { type: "json" };

export interface Municipality { id: number; district: string; name: string; nameNe: string; type: string; wards: number; lat: number; lng: number }
export const municipalities = raw as Municipality[];
const byId = new Map(municipalities.map((m) => [m.id, m]));
export function municipalitiesFor(district: string): Municipality[] { return municipalities.filter((m) => m.district === district); }
export function municipalityById(id: number | null | undefined): Municipality | undefined { return id == null ? undefined : byId.get(id); }
export function municipalityLabel(m: Municipality, language: "en" | "ne"): string { return language === "ne" ? m.nameNe : m.name; }
