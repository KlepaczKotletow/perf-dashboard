import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CompletedItem {
  id: string;
  type: "self" | "manager-review" | "upward";
  label: string;
  href: string;
  completedAt: string | null;
}

interface CompletedSectionProps {
  items: CompletedItem[];
}

const typeLabelMap: Record<CompletedItem["type"], string> = {
  self: "Self",
  "manager-review": "Review",
  upward: "Upward",
};

export function CompletedSection({ items }: CompletedSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <span className="h-5 w-5 rounded bg-emerald-100 dark:bg-emerald-400/10 flex items-center justify-center">
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        </span>
        Completed
      </h3>

      <div className="divide-y divide-border rounded-lg border border-border/60 bg-muted/30">
        {items.map((item) => (
          <div
            key={item.id}
            className="py-3 px-5 flex items-center justify-between gap-4 opacity-70"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                {typeLabelMap[item.type]} <Check className="h-2.5 w-2.5 ml-0.5" />
              </Badge>
              <span className="text-sm text-foreground truncate">
                {item.label}
              </span>
              {item.completedAt && (
                <span className="text-[11px] text-muted-foreground/60 shrink-0">
                  {format(new Date(item.completedAt), "MMM d")}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 shrink-0"
              asChild
            >
              <Link href={item.href}>
                View <ChevronRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
