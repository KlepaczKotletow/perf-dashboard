"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CollapsibleSectionProps {
  title: string;
  pendingCount?: number;   // amber badge when > 0
  allDone?: boolean;       // green "All done" badge — only shown when pendingCount is 0
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  pendingCount,
  allDone,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2 group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
            {title}
          </span>
          {typeof pendingCount === "number" && pendingCount > 0 && (
            <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400 font-medium">
              {pendingCount}
            </Badge>
          )}
          {allDone && (typeof pendingCount === "undefined" || pendingCount === 0) && (
            <Badge className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400 font-medium">
              All done
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {/* CSS grid trick: animates height from 0 to auto without JS measurement */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="h-px bg-border/50 mb-3" />
          <div className="space-y-1.5 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionEmptyNote({ message }: { message: string }) {
  return (
    <p className="text-xs text-muted-foreground/60 italic py-1 px-1">{message}</p>
  );
}
