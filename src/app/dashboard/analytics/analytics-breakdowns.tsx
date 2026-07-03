"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { tooltipStyle } from "@/components/charts/chart-utils";

interface BreakdownChart {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  unit: string; // "%" or "avg"
}

export function AnalyticsBreakdowns({ charts }: { charts: BreakdownChart[] }) {
  if (!charts.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {charts.map((chart) => (
        <ChartCard key={chart.title} title={chart.title} subtitle={chart.subtitle}>
          {chart.data.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-8 text-center">
              No data available
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(150, chart.data.length * 36)}
            >
              <BarChart
                data={chart.data}
                layout="vertical"
                margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={chart.unit === "%" ? [0, 100] : undefined}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(val) => {
                    const n = Number(val);
                    return chart.unit === "%" ? `${n}%` : n.toFixed(1);
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      ))}
    </div>
  );
}
