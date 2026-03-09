"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getChartColor, tooltipStyle } from "./chart-utils";

export interface LineDatum {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface AppLineChartProps {
  data: LineDatum[];
  height?: number;
  dataKeys?: string[];
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function AppLineChart({
  data,
  height = 250,
  dataKeys = ["value"],
  valueFormatter = (v) => String(v),
  className = "",
}: AppLineChartProps) {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    setColors(dataKeys.map((_, i) => getChartColor(i)));
  }, [dataKeys]);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.5}
          />
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
          <Tooltip
            formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
            {...tooltipStyle}
          />
          {dataKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i] || "#888"}
              strokeWidth={2}
              dot={{ r: 3, fill: colors[i] || "#888" }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
