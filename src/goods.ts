import type { GoodsUnit } from "./api";
import type { Language } from "./types";

export interface GoodsCategory {
  id: string;
  unit: GoodsUnit;
  en: string;
  ne: string;
}

// Mirror of server/src/goods/taxonomy.js — keep the two lists identical.
export const GOODS_CATEGORIES: GoodsCategory[] = [
  { id: "rice", unit: "kg", en: "Rice", ne: "चामल" },
  { id: "lentils", unit: "kg", en: "Lentils", ne: "दाल" },
  { id: "flour", unit: "kg", en: "Flour", ne: "पीठो" },
  { id: "cooking-oil", unit: "litre", en: "Cooking oil", ne: "खाने तेल" },
  { id: "salt-sugar", unit: "kg", en: "Salt / sugar", ne: "नुन / चिनी" },
  { id: "dry-food", unit: "packet", en: "Dry food", ne: "सुक्खा खाना" },
  { id: "drinking-water", unit: "litre", en: "Drinking water", ne: "पिउने पानी" },
  { id: "tarpaulin", unit: "piece", en: "Tarpaulin", ne: "त्रिपाल" },
  { id: "tent", unit: "piece", en: "Tent", ne: "पाल" },
  { id: "blanket", unit: "piece", en: "Blanket", ne: "कम्बल" },
  { id: "mattress", unit: "piece", en: "Mattress", ne: "गद्दा" },
  { id: "clothing", unit: "piece", en: "Clothing", ne: "लुगा" },
  { id: "hygiene-kit", unit: "kit", en: "Hygiene kit", ne: "सरसफाइ किट" },
  { id: "sanitary-pads", unit: "packet", en: "Sanitary pads", ne: "स्यानिटरी प्याड" },
  { id: "soap", unit: "piece", en: "Soap", ne: "साबुन" },
  { id: "medicine", unit: "kit", en: "Medicine", ne: "औषधि" },
  { id: "first-aid-kit", unit: "kit", en: "First-aid kit", ne: "प्राथमिक उपचार किट" },
  { id: "utensils", unit: "set", en: "Utensils", ne: "भाँडाकुँडा" },
  { id: "solar-light", unit: "piece", en: "Solar light", ne: "सोलार बत्ती" },
  { id: "other", unit: "piece", en: "Other", ne: "अन्य" },
];

const UNIT_LABELS: Record<GoodsUnit, { en: string; ne: string }> = {
  kg: { en: "kg", ne: "केजी" },
  litre: { en: "litres", ne: "लिटर" },
  piece: { en: "pieces", ne: "थान" },
  packet: { en: "packets", ne: "प्याकेट" },
  kit: { en: "kits", ne: "किट" },
  set: { en: "sets", ne: "सेट" },
};

export function goodsCategory(id: string): GoodsCategory | undefined {
  return GOODS_CATEGORIES.find((c) => c.id === id);
}

export function goodsLabel(id: string, language: Language): string {
  const c = goodsCategory(id);
  return c ? c[language] : id;
}

export function unitLabel(unit: GoodsUnit, language: Language): string {
  return UNIT_LABELS[unit]?.[language] ?? unit;
}
