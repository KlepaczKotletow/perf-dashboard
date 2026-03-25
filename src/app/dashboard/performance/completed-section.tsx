"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Star } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SubmittedResponse {
  competencyName: string;
  category: string | null;
  rating: number | null;
  comment: string | null;
}

interface CompletedItem {
  id: string;
  type: "self" | "manager-review" | "upward";
  label: string;
  assignmentId: string;
  completedAt: string | null;
}

interface CompletedSectionProps {
  items: CompletedItem[];
  responsesByAssignment: Record<string, SubmittedResponse[]>;
  ratingMax: number;
}

const typeLabelMap: Record<CompletedItem["type"], string> = {
  self: "Self",
  "manager-review": "Review",
  upward: "Upward",
};

function StarRating({ rating, max }: { rating: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/20"
          }`}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">
        {rating}/{max}
      </span>
    </div>
  );
}

export function CompletedSection({
  items,
  responsesByAssignment,
  ratingMax,
}: CompletedSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const responses = responsesByAssignment[item.assignmentId] || [];

          return (
            <div key={item.id}>
              <div className="py-3 px-5 flex items-center justify-between gap-4 opacity-70">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                    {typeLabelMap[item.type]}{" "}
                    <Check className="h-2.5 w-2.5 ml-0.5" />
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
                  onClick={() =>
                    setExpandedId(isExpanded ? null : item.id)
                  }
                >
                  {isExpanded ? "Hide" : "View"}
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 ml-0.5" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  )}
                </Button>
              </div>

              {/* Expandable detail area */}
              <div
                className={`grid transition-all duration-200 ease-in-out ${
                  isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-4 pt-1 space-y-3">
                    {responses.length > 0 ? (
                      responses.map((r, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-border/40 bg-card p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {r.competencyName}
                            </span>
                            {r.rating != null && (
                              <StarRating
                                rating={r.rating}
                                max={ratingMax}
                              />
                            )}
                          </div>
                          {r.comment && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {r.comment}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-2">
                        No details available for this submission.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
