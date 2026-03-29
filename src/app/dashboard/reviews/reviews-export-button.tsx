"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function ReviewsExportButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const a = document.createElement("a");
        a.href = "/api/reviews/export";
        a.download = `reviews-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
      }}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      Export CSV
    </Button>
  );
}
