const COLOR_STOPS = [
  "bg-red-100 dark:bg-red-950/40",
  "bg-orange-100 dark:bg-orange-950/40",
  "bg-amber-100 dark:bg-amber-950/40",
  "bg-yellow-100 dark:bg-yellow-950/40",
  "bg-lime-100 dark:bg-lime-950/40",
  "bg-green-100 dark:bg-green-950/40",
  "bg-emerald-100 dark:bg-emerald-950/40",
];

export interface RatingScale {
  min: number;
  max: number;
  labels: Record<string, string>;
}

export function getHeatmapColor(avg: number | null, scale: RatingScale): string {
  if (avg === null) return "";
  const range = scale.max - scale.min;
  if (range <= 0) return "";
  const normalized = Math.max(0, Math.min(1, (avg - scale.min) / range));
  const idx = Math.round(normalized * (COLOR_STOPS.length - 1));
  return COLOR_STOPS[idx];
}

export function getHeatmapLegend(scale: RatingScale) {
  const points: { value: number; label: string; colorClass: string }[] = [];
  for (let v = scale.min; v <= scale.max; v++) {
    const normalized = (v - scale.min) / (scale.max - scale.min);
    const idx = Math.round(normalized * (COLOR_STOPS.length - 1));
    points.push({
      value: v,
      label: scale.labels[String(v)] || String(v),
      colorClass: COLOR_STOPS[idx],
    });
  }
  return points;
}
