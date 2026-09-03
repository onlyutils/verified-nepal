export const CLIMATE_SERIES_COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export function climateSeriesColor(index: number) {
  return CLIMATE_SERIES_COLORS[index % CLIMATE_SERIES_COLORS.length];
}

export const CHOROPLETH_SHADES = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a", "#172554"];

export function quantileThresholds(values: number[], buckets: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: buckets - 1 }, (_, i) => sorted[Math.floor(((i + 1) / buckets) * (sorted.length - 1))]);
}

export function bucketIndex(value: number, thresholds: number[]) {
  let i = 0;
  while (i < thresholds.length && value > thresholds[i]) i += 1;
  return i;
}
