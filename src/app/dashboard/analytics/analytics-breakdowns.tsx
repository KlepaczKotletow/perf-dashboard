"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BreakdownChart {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  unit: string; // "%" or "avg"
}

export function AnalyticsBreakdowns({ charts }: { charts: BreakdownChart[] }) {
  if (!charts.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      {charts.map((chart) => (
        <div key={chart.title} className="space-y-2">
          <h3 className="text-sm font-semibold">{chart.title}</h3>
          <p className="text-xs text-muted-foreground">{chart.subtitle}</p>
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
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(val) => {
                    const n = Number(val);
                    return chart.unit === "%" ? `${n}%` : n.toFixed(1);
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ))}
    </div>
  );
}
