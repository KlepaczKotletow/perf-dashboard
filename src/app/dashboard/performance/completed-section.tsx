"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Star } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

      <div className="rounded-lg border border-border/60 overflow-hidden bg-muted/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="pr-5 text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const responses = responsesByAssignment[item.assignmentId] || [];

              return (
                <TableRow key={item.id} className="group">
                  <TableCell className="pl-5">
                    <Badge className="text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10">
                      {typeLabelMap[item.type]} <Check className="h-2.5 w-2.5 ml-0.5" />
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.label}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.completedAt
                      ? format(new Date(item.completedAt), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {isExpanded ? "Hide" : "View"}
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 ml-0.5" />
                      ) : (
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Expanded detail panel — renders below the table */}
        {expandedId && (() => {
          const item = items.find((i) => i.id === expandedId);
          if (!item) return null;
          const responses = responsesByAssignment[item.assignmentId] || [];

          return (
            <div className="border-t border-border/60 px-5 py-4 bg-card space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {typeLabelMap[item.type]} details — {item.label}
              </p>
              {responses.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {responses.map((r, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-border/40 bg-muted/30 p-3 space-y-1.5"
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
                <p className="text-xs text-muted-foreground italic py-2">
                  No details available for this submission.
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
