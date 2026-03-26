"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { useState } from "react";

interface Props {
  cycleId?: string;
  functionId?: string;
  department?: string;
}

export function AnalyticsExportButton({ cycleId, functionId, department }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCsvExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cycleId) params.set("cycleId", cycleId);
      if (functionId) params.set("functionId", functionId);
      if (department) params.set("department", department);

      const response = await fetch(`/api/analytics/export?${params}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={loading}>
          <Download className="h-4 w-4" />
          {loading ? "Exporting\u2026" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsvExport}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.print()}>
          Export as PDF (Print)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
