"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { ProgressRing } from "@/components/charts/progress-ring";
import { DonutChart } from "@/components/charts/donut-chart";
import { AppBarChart } from "@/components/charts/bar-chart-component";
import { AppLineChart } from "@/components/charts/line-chart-component";
import { STATUS_COLORS } from "@/components/charts/chart-utils";

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
  const hasGoalData = data.goalDistribution.some((d) => d.value > 0);
  const hasReviewTrend = data.reviewTrend.some((d) => d.value > 0);
  const hasDeptData = data.departmentPerformance.some((d) => d.value > 0);
  const hasAnyData = hasGoalData || hasReviewTrend || hasDeptData || data.completionRate > 0;

  if (!hasAnyData) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Completion Rate */}
      <ChartCard
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

      {/* Goal Progress Distribution */}
      <ChartCard title="Goal Progress">
        {hasGoalData ? (
          <DonutChart
            data={data.goalDistribution}
            height={140}
            innerRadius={36}
            outerRadius={52}
          />
        ) : (
          <div className="flex items-center justify-center h-[140px] text-xs text-muted-foreground">
            No goals yet
          </div>
        )}
      </ChartCard>

      {/* Review Trend */}
      <ChartCard title="Review Trend" subtitle="Last 6 months">
        {hasReviewTrend ? (
          <AppLineChart data={data.reviewTrend} height={160} />
        ) : (
          <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">
            No review data
          </div>
        )}
      </ChartCard>

      {/* Department Performance */}
      <ChartCard title="By Department" subtitle="Avg rating">
        {hasDeptData ? (
          <AppBarChart
            data={data.departmentPerformance}
            height={160}
            layout="horizontal"
            valueFormatter={(v) => v.toFixed(1)}
          />
        ) : (
          <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">
            No department data
          </div>
        )}
      </ChartCard>
    </div>
  );
}
