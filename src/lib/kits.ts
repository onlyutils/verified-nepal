import raw from "./kits.json" with { type: "json" };

export interface KitItem {
  category: string;
  qty: number;
  unit: string;
}

export interface Kit {
  id: string;
  name: string;
  nameNe: string;
  persons: number;
  items: KitItem[];
  weightKg: number;
  source: string;
}

export const KITS = raw.kits as Kit[];

const kitsById = new Map(KITS.map((kit) => [kit.id, kit]));

export function getKit(id: string): Kit | undefined {
  return kitsById.get(id);
}

export function expandKit(id: string, households = 1): { items: KitItem[]; weightKg: number } | undefined {
  const kit = getKit(id);
  if (!kit) return undefined;
  return {
    items: kit.items.map((item) => ({ ...item, qty: item.qty * households })),
    weightKg: kit.weightKg * households,
  };
}
