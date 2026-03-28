"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  delta?: { value: number; label: string } | null;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, delta, children, className = "" }: ChartCardProps) {
  const deltaIcon = delta
    ? delta.value > 0
      ? TrendingUp
      : delta.value < 0
        ? TrendingDown
        : Minus
    : null;

  const deltaColor = delta
    ? delta.value > 0
      ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10"
      : delta.value < 0
        ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10"
        : "text-muted-foreground bg-muted"
    : "";

  return (
    <Card className={`border-border/60 hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {subtitle && (
              <CardDescription className="text-xs mt-0.5">
                {subtitle}
              </CardDescription>
            )}
          </div>
          {delta && deltaIcon && (
            <Badge className={`text-[10px] font-medium gap-1 ${deltaColor}`}>
              {(() => {
                const Icon = deltaIcon;
                return <Icon className="h-3 w-3" />;
              })()}
              {delta.value > 0 ? "+" : ""}
              {delta.value}% {delta.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
