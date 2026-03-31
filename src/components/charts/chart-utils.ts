// Chart color utilities — reads CSS variables at runtime for dark mode support

const CHART_COLORS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

// Semantic status colors for goals / reviews
export const STATUS_COLORS = {
  on_track: { fill: "#22c55e", label: "On Track" },
  at_risk: { fill: "#f59e0b", label: "At Risk" },
  delayed: { fill: "#ef4444", label: "Delayed" },
  achieved: { fill: "#6366f1", label: "Achieved" },
  // lifecycle statuses
  draft: { fill: "#a1a1aa", label: "Draft" },
  active: { fill: "#6366f1", label: "Active" },
  completed: { fill: "#22c55e", label: "Completed" },
  cancelled: { fill: "#ef4444", label: "Cancelled" },
} as const;

/**
 * Read a CSS chart color variable at runtime.
 * Falls back to a static palette when running on the server or if the var is missing.
 */
export function getChartColor(index: number): string {
  const FALLBACK = ["#b45c3a", "#4ade80", "#d4a24e", "#a855f7", "#38bdf8"];

  if (typeof window === "undefined") return FALLBACK[index % FALLBACK.length];

  const varName = CHART_COLORS[index % CHART_COLORS.length];
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  return raw || FALLBACK[index % FALLBACK.length];
}

/**
 * Build an array of N chart colors resolved from CSS variables.
 */
export function getChartColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => getChartColor(i));
}

/**
 * Common tooltip style that matches the app's theme.
 */
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
  itemStyle: {
    color: "var(--popover-foreground)",
    fontSize: "0.75rem",
  },
  labelStyle: {
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
    fontWeight: 500,
  },
};
