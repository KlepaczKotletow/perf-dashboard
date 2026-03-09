"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { AppBarChart } from "@/components/charts/bar-chart-component";
import { AppLineChart } from "@/components/charts/line-chart-component";
import { DonutChart } from "@/components/charts/donut-chart";

export interface AnalyticsChartsData {
  ratingDistribution: { name: string; value: number; color: string }[];
  competencyRatings: { name: string; value: number }[];
  responseTrend: { name: string; value: number }[];
  departmentPerformance: { name: string; value: number }[];
  goalStatusDistribution: { name: string; value: number; color: string }[];
}

interface AnalyticsChartsProps {
  data: AnalyticsChartsData;
}

const ratingColors: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#22c55e",
  5: "#10b981",
};

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const hasRatingData = data.ratingDistribution.some((d) => d.value > 0);
  const hasCompetencyData = data.competencyRatings.length > 0;
  const hasTrendData = data.responseTrend.some((d) => d.value > 0);
  const hasDeptData = data.departmentPerformance.length > 0;
  const hasGoalData = data.goalStatusDistribution.some((d) => d.value > 0);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Rating Distribution */}
      <ChartCard title="Rating Distribution" subtitle="Across all responses">
        {hasRatingData ? (
          <AppBarChart
            data={data.ratingDistribution}
            height={180}
            layout="vertical"
          />
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
            No ratings yet
          </div>
        )}
      </ChartCard>

      {/* Competency Ratings */}
      <ChartCard title="Competency Ratings" subtitle="Average by competency">
        {hasCompetencyData ? (
          <AppBarChart
            data={data.competencyRatings.slice(0, 8)}
            height={180}
            layout="horizontal"
            valueFormatter={(v) => v.toFixed(1)}
          />
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
            No competency data
          </div>
        )}
      </ChartCard>

      {/* Response Trend */}
      <ChartCard title="Response Trend" subtitle="Last 6 months">
        {hasTrendData ? (
          <AppLineChart data={data.responseTrend} height={180} />
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
            No trend data
          </div>
        )}
      </ChartCard>

      {/* Department Performance */}
      <ChartCard title="Department Performance" subtitle="Avg rating">
        {hasDeptData ? (
          <AppBarChart
            data={data.departmentPerformance}
            height={180}
            layout="horizontal"
            valueFormatter={(v) => v.toFixed(1)}
          />
        ) : (
          <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
            No department data
          </div>
        )}
      </ChartCard>

      {/* Goal Progress Distribution */}
      {hasGoalData && (
        <ChartCard title="Goal Progress" subtitle="By tracking status">
          <DonutChart
            data={data.goalStatusDistribution}
            height={180}
            innerRadius={45}
            outerRadius={65}
          />
        </ChartCard>
      )}
    </div>
  );
}
