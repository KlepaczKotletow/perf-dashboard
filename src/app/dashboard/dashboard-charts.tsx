"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { ProgressRing } from "@/components/charts/progress-ring";
import { DonutChart } from "@/components/charts/donut-chart";
import { AppBarChart } from "@/components/charts/bar-chart-component";
import { AppLineChart } from "@/components/charts/line-chart-component";
import { BarChart3 } from "lucide-react";

export interface DashboardChartData {
  completionRate: number;
  completionDelta: number | null;
  previousCycleName: string | null;
  goalDistribution: { name: string; value: number; color: string }[];
  reviewTrend: { name: string; value: number }[];
  departmentPerformance: { name: string; value: number }[];
}

interface DashboardChartsProps {
  data: DashboardChartData;
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const hasCompletion = data.completionRate > 0;
  const hasGoalData = data.goalDistribution.some((d) => d.value > 0);
  const hasReviewTrend = data.reviewTrend.some((d) => d.value > 0);
  const hasDeptData = data.departmentPerformance.length > 0 && data.departmentPerformance.some((d) => d.value > 0);

  // Build list of charts that have data
  const charts: React.ReactNode[] = [];

  if (hasCompletion) {
    charts.push(
      <ChartCard
        key="completion"
        title="Completion Rate"
        delta={
          data.completionDelta !== null
            ? { value: data.completionDelta, label: data.previousCycleName || "prev" }
            : null
        }
      >
        <div className="flex flex-col items-center gap-3 py-3">
          <span className="text-4xl font-bold text-foreground tabular-nums">{data.completionRate}%</span>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                data.completionRate >= 70 ? "bg-emerald-500" : data.completionRate >= 40 ? "bg-amber-500" : "bg-red-500"
              }`}
              style={{ width: `${data.completionRate}%` }}
            />
          </div>
        </div>
      </ChartCard>
    );
  }

  if (hasGoalData) {
    const totalGoals = data.goalDistribution.reduce((sum, d) => sum + d.value, 0);
    charts.push(
      <ChartCard key="goals" title="Goal Health" subtitle={`${totalGoals} total goals`}>
        <div className="space-y-2 py-2">
          {/* Stacked horizontal bar */}
          <div className="flex h-4 rounded-full overflow-hidden">
            {data.goalDistribution.filter(d => d.value > 0).map((d) => (
              <div
                key={d.name}
                className="h-full transition-all"
                style={{ width: `${(d.value / totalGoals) * 100}%`, backgroundColor: d.color }}
                title={`${d.name}: ${d.value}`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {data.goalDistribution.filter(d => d.value > 0).map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                {d.name} <span className="font-medium text-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    );
  }

  if (hasReviewTrend) {
    charts.push(
      <ChartCard key="trend" title="Review Trend" subtitle="Last 6 months">
        <AppLineChart data={data.reviewTrend} height={220} />
      </ChartCard>
    );
  }

  if (hasDeptData) {
    charts.push(
      <ChartCard key="dept" title="By Department" subtitle="Avg rating">
        <AppBarChart
          data={data.departmentPerformance}
          height={220}
          layout="horizontal"
          valueFormatter={(v) => v.toFixed(1)}
        />
      </ChartCard>
    );
  }

  // No charts with data — show friendly empty state
  if (charts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 py-12 flex flex-col items-center text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/25 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Analytics will appear here</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
          Once reviews start coming in, you'll see completion rates, trends, and department breakdowns.
        </p>
      </div>
    );
  }

  // Responsive grid: 1 chart = full width, 2 = 2-col, 3 = 3-col, 4 = 4-col
  const gridCols =
    charts.length === 1
      ? "sm:grid-cols-1 max-w-md"
      : charts.length === 2
        ? "sm:grid-cols-2"
        : charts.length === 3
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground tracking-wide border-l-2 border-primary/40 pl-3">Analytics</h2>
      <div className={`grid gap-4 ${gridCols}`}>
        {charts}
      </div>
    </div>
  );
}
