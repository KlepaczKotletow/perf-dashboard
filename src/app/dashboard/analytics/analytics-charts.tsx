"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { AppBarChart } from "@/components/charts/bar-chart-component";
import { DonutChart } from "@/components/charts/donut-chart";

export interface AnalyticsChartsData {
  ratingDistribution: { name: string; value: number; color: string }[];
  functionPerformance: { name: string; value: number }[];
  departmentPerformance: { name: string; value: number }[];
  competencyRatings: { name: string; value: number }[];
  goalStatusDistribution: { name: string; value: number; color: string }[];
}

interface AnalyticsChartsProps {
  data: AnalyticsChartsData;
}

const EMPTY = (label: string) => (
  <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
    {label}
  </div>
);

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const hasRatingData = data.ratingDistribution.some((d) => d.value > 0);
  const hasFunctionData = data.functionPerformance.length > 0;
  const hasDeptData = data.departmentPerformance.length > 0;
  const hasCompetencyData = data.competencyRatings.length > 0;
  const hasGoalData = data.goalStatusDistribution.some((d) => d.value > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Rating Distribution */}
      <ChartCard title="Rating Distribution" subtitle="Across all responses">
        {hasRatingData
          ? <AppBarChart data={data.ratingDistribution} height={180} layout="vertical" />
          : EMPTY("No ratings yet")}
      </ChartCard>

      {/* By Function */}
      <ChartCard title="By Function" subtitle="Avg rating per job family">
        {hasFunctionData
          ? <AppBarChart data={data.functionPerformance} height={180} layout="horizontal" valueFormatter={(v) => v.toFixed(1)} />
          : EMPTY("No function data")}
      </ChartCard>

      {/* By Department */}
      <ChartCard title="By Department" subtitle="Avg rating per department">
        {hasDeptData
          ? <AppBarChart data={data.departmentPerformance} height={180} layout="horizontal" valueFormatter={(v) => v.toFixed(1)} />
          : EMPTY("No department data")}
      </ChartCard>

      {/* Competency Breakdown */}
      <ChartCard title="Competency Breakdown" subtitle="Average by competency (top 8)">
        {hasCompetencyData
          ? <AppBarChart data={data.competencyRatings.slice(0, 8)} height={180} layout="horizontal" valueFormatter={(v) => v.toFixed(1)} />
          : EMPTY("No competency data")}
      </ChartCard>

      {/* Goal Progress */}
      {hasGoalData && (
        <ChartCard title="Goal Progress" subtitle="By tracking status">
          <DonutChart data={data.goalStatusDistribution} height={180} innerRadius={45} outerRadius={65} />
        </ChartCard>
      )}
    </div>
  );
}
