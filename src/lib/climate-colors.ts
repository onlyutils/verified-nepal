export const CLIMATE_SERIES_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export function climateSeriesColor(index: number) {
  return CLIMATE_SERIES_COLORS[index % CLIMATE_SERIES_COLORS.length];
}
