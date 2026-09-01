export const GOODS_CATEGORIES = [
  { id: "rice", unit: "kg" },
  { id: "lentils", unit: "kg" },
  { id: "flour", unit: "kg" },
  { id: "cooking-oil", unit: "litre" },
  { id: "salt-sugar", unit: "kg" },
  { id: "dry-food", unit: "packet" },
  { id: "drinking-water", unit: "litre" },
  { id: "tarpaulin", unit: "piece" },
  { id: "tent", unit: "piece" },
  { id: "blanket", unit: "piece" },
  { id: "mattress", unit: "piece" },
  { id: "clothing", unit: "piece" },
  { id: "hygiene-kit", unit: "kit" },
  { id: "sanitary-pads", unit: "packet" },
  { id: "soap", unit: "piece" },
  { id: "medicine", unit: "kit" },
  { id: "first-aid-kit", unit: "kit" },
  { id: "utensils", unit: "set" },
  { id: "solar-light", unit: "piece" },
  { id: "other", unit: "piece" },
];

export const GOODS_UNITS = ["kg", "litre", "piece", "packet", "kit", "set"];

const unitMap = new Map(GOODS_CATEGORIES.map((c) => [c.id, c.unit]));

export function unitFor(category) {
  return unitMap.get(category) || null;
}

export function isGoodsCategory(id) {
  return unitMap.has(id);
}
