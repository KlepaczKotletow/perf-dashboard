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

const typeBadgeClass: Record<CompletedItem["type"], string> = {
  self: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-400/10",
  "manager-review": "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  upward: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
};

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
              ? "fill-amber-400 text-amber-400"
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

/**
 * Flat row list — no Table chrome.
 * Click a row's "View" to expand details inline below that row.
 */
export function CompletedSection({
  items,
  responsesByAssignment,
  ratingMax,
}: CompletedSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
        Completed · {items.length}
      </p>

      <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/60 overflow-hidden">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const responses = responsesByAssignment[item.assignmentId] || [];
          const completedAt = item.completedAt ? new Date(item.completedAt) : null;

          return (
            <div key={item.id}>
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Badge
                  className={`text-[10px] font-medium shrink-0 inline-flex items-center gap-1 ${typeBadgeClass[item.type]}`}
                >
                  {typeLabelMap[item.type]}
                  <Check className="h-2.5 w-2.5" />
                </Badge>

                <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                  {item.label}
                </span>

                {completedAt && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(completedAt, "MMM d, yyyy")}
                  </span>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 shrink-0"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "Hide" : "View"}
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 ml-0.5" />
                  ) : (
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  )}
                </Button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 bg-muted/30 space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {typeLabelMap[item.type]} details — {item.label}
                  </p>
                  {responses.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {responses.map((r, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-border/40 bg-card p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {r.competencyName}
                            </span>
                            {r.rating != null && (
                              <StarRating rating={r.rating} max={ratingMax} />
                            )}
                          </div>
                          {r.comment && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {r.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-1">
                      No details available for this submission.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
