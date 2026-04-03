"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User2 } from "lucide-react";

interface MissingReviewsProps {
  selfMissing: { name: string; status: string }[];
  managerMissing: { name: string; managerName: string; status: string }[];
}

export function MissingReviewsPopover({ selfMissing, managerMissing }: MissingReviewsProps) {
  if (selfMissing.length === 0 && managerMissing.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {selfMissing.length > 0 && `${selfMissing.length} self-reviews missing`}
          {selfMissing.length > 0 && managerMissing.length > 0 && " · "}
          {managerMissing.length > 0 && `${managerMissing.length} manager reviews missing`}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
          {selfMissing.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Self-reviews missing ({selfMissing.length})
              </p>
              <div className="space-y-1.5">
                {selfMissing.map((person, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{person.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {person.status === "pending" ? "Not started" : "In progress"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {managerMissing.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Manager reviews missing ({managerMissing.length})
              </p>
              <div className="space-y-1.5">
                {managerMissing.map((person, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <User2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{person.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      mgr: {person.managerName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
