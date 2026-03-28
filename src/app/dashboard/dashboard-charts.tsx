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
        <div className="flex justify-center py-2">
          <ProgressRing value={data.completionRate} size={100} strokeWidth={8} />
        </div>
      </ChartCard>
    );
  }

  if (hasGoalData) {
    charts.push(
      <ChartCard key="goals" title="Goal Progress">
        <DonutChart
          data={data.goalDistribution}
          height={140}
          innerRadius={36}
          outerRadius={52}
        />
      </ChartCard>
    );
  }

  if (hasReviewTrend) {
    charts.push(
      <ChartCard key="trend" title="Review Trend" subtitle="Last 6 months">
        <AppLineChart data={data.reviewTrend} height={160} />
      </ChartCard>
    );
  }

  if (hasDeptData) {
    charts.push(
      <ChartCard key="dept" title="By Department" subtitle="Avg rating">
        <AppBarChart
          data={data.departmentPerformance}
          height={160}
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
      <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Analytics</h2>
      <div className={`grid gap-4 ${gridCols}`}>
        {charts}
      </div>
    </div>
  );
}
