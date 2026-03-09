"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getChartColor, tooltipStyle } from "./chart-utils";

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  showLegend?: boolean;
  centerLabel?: string;
  className?: string;
}

export function DonutChart({
  data,
  innerRadius = 50,
  outerRadius = 70,
  height = 200,
  showLegend = true,
  centerLabel,
  className = "",
}: DonutChartProps) {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    setColors(data.map((d, i) => d.color || getChartColor(i)));
  }, [data]);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={`${className}`}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index] || "#888"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${Number(value)} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
                String(name),
              ]}
              {...tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {centerLabel && (
        <p className="text-center text-xs text-muted-foreground -mt-2 mb-2">{centerLabel}</p>
      )}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: colors[i] || "#888" }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
