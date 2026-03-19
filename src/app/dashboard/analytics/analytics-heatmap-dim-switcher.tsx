"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type HeatmapDim = "role" | "department" | "level" | "tenure";

const DIMS: { id: HeatmapDim; label: string }[] = [
  { id: "role", label: "Role" },
  { id: "department", label: "Department" },
  { id: "level", label: "Level" },
  { id: "tenure", label: "Tenure" },
];

interface Props {
  activeDim: HeatmapDim;
}

export function AnalyticsHeatmapDimSwitcher({ activeDim }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchDim = useCallback(
    (dim: HeatmapDim) => {
      const params = new URLSearchParams(searchParams.toString());
      if (dim === "role") {
        params.delete("heatmap_dim");
      } else {
        params.set("heatmap_dim", dim);
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
      {DIMS.map((d) => (
        <button
          key={d.id}
          onClick={() => switchDim(d.id)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
            activeDim === d.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
