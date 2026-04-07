import { TrendingUp, Star, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { gradeColor } from "@/lib/status";

interface PerformanceSummaryHeroProps {
  completedCycles: number;
  avgRating: number | null;
  latestGrade: string | null;
  ratingMax: number;
}

export function PerformanceSummaryHero({
  completedCycles,
  avgRating,
  latestGrade,
  ratingMax,
}: PerformanceSummaryHeroProps) {
  if (completedCycles === 0) return null;

  const stats = [
    {
      icon: TrendingUp,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      label: "Cycles Completed",
      value: String(completedCycles),
      sublabel: completedCycles === 1 ? "cycle" : "cycles",
    },
    {
      icon: Star,
      iconClass: "text-amber-500",
      bgClass: "bg-amber-50 dark:bg-amber-400/10",
      label: "Avg Rating",
      value: avgRating != null ? avgRating.toFixed(1) : "--",
      sublabel: avgRating != null ? `out of ${ratingMax}` : "no ratings yet",
    },
    {
      icon: Award,
      iconClass: gradeColor(latestGrade) || "text-foreground",
      bgClass: "bg-muted",
      label: "Latest Grade",
      value: latestGrade || "--",
      sublabel: latestGrade ? "most recent" : "not yet graded",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/60">
          <CardContent className="py-4 px-5 flex items-start gap-3">
            <div
              className={`h-9 w-9 rounded-lg ${stat.bgClass} flex items-center justify-center shrink-0`}
            >
              <stat.icon className={`h-4.5 w-4.5 ${stat.iconClass}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground leading-tight mt-0.5">
                {stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {stat.sublabel}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
