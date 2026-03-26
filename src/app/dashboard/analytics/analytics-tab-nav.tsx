"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "heatmap" | "cycles";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "heatmap", label: "Heatmap" },
  { id: "cycles", label: "Cycles" },
];

interface AnalyticsTabNavProps {
  activeTab: Tab;
}

export function AnalyticsTabNav({ activeTab }: AnalyticsTabNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const switchTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
        params.delete("heatmap_dim");
      } else {
        params.set("tab", tab);
      }
      router.push(`/dashboard/analytics?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => switchTab(t.id)}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            activeTab === t.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
