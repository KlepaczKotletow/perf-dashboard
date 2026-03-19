"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { AppLineChart } from "@/components/charts/line-chart-component";

export interface TrendsData {
  ratingTrend: { name: string; value: number }[];
  completionTrend: { name: string; value: number }[];
}

export function AnalyticsTrends({ data }: { data: TrendsData }) {
  const hasRatingTrend = data.ratingTrend.some((d) => d.value > 0);
  const hasCompletionTrend = data.completionTrend.some((d) => d.value > 0);

  if (!hasRatingTrend && !hasCompletionTrend) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Trends</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last 6 cycles — not affected by the cycle filter above
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard title="Rating Trend" subtitle="Avg overall rating per cycle">
          {hasRatingTrend
            ? <AppLineChart data={data.ratingTrend} height={180} valueFormatter={(v) => v.toFixed(1)} />
            : <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">Not enough cycles yet</div>}
        </ChartCard>
        <ChartCard title="Completion Trend" subtitle="Completion % per cycle">
          {hasCompletionTrend
            ? <AppLineChart data={data.completionTrend} height={180} valueFormatter={(v) => `${v}%`} />
            : <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">Not enough cycles yet</div>}
        </ChartCard>
      </div>
    </div>
  );
}
