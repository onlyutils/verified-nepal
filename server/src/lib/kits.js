import data from "../data/kits.json" with { type: "json" };

export const KITS = data.kits;

const kitsById = new Map(KITS.map((kit) => [kit.id, kit]));

export function getKit(id) {
  return kitsById.get(id);
}

export function expandKit(id, households) {
  const kit = getKit(id);
  if (!kit) return undefined;
  const multiplier = households ?? 1;
  return {
    items: kit.items.map((item) => ({ ...item, qty: item.qty * multiplier })),
    weightKg: kit.weightKg * multiplier,
  };
}
