"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getChartColor, tooltipStyle } from "./chart-utils";

export interface BarDatum {
  name: string;
  value: number;
  color?: string;
}

interface AppBarChartProps {
  data: BarDatum[];
  height?: number;
  layout?: "horizontal" | "vertical";
  showGrid?: boolean;
  barRadius?: number;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function AppBarChart({
  data,
  height = 250,
  layout = "vertical",
  showGrid = true,
  barRadius = 4,
  valueFormatter = (v) => String(v),
  className = "",
}: AppBarChartProps) {
  const [primaryColor, setPrimaryColor] = useState("#b45c3a");

  useEffect(() => {
    setPrimaryColor(getChartColor(0));
  }, []);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        No data available
      </div>
    );
  }

  const isHorizontal = layout === "horizontal";

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isHorizontal ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 8, left: isHorizontal ? 80 : 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.5}
              vertical={!isHorizontal}
              horizontal={isHorizontal}
            />
          )}
          {isHorizontal ? (
            <>
              <XAxis type="number" tickFormatter={valueFormatter} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={76}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={valueFormatter}
                tickLine={false}
                axisLine={false}
              />
            </>
          )}
          <Tooltip
            formatter={(value) => [valueFormatter(Number(value)), "Value"]}
            {...tooltipStyle}
          />
          <Bar
            dataKey="value"
            radius={[barRadius, barRadius, barRadius, barRadius]}
            maxBarSize={32}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || primaryColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
