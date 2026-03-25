"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CycleCardProps {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  borderColor?: string;
}

export function CycleCard({
  header,
  children,
  defaultOpen = false,
  borderColor = "border-l-border",
}: CycleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={`border-border/60 border-l-4 ${borderColor}`}>
      <CardContent className="py-0 px-0">
        {/* Clickable header row */}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left group hover:bg-accent/30 transition-colors rounded-r-xl"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          )}
          <div className="flex-1 min-w-0">{header}</div>
        </button>

        {/* Animated expand/collapse via CSS grid trick */}
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-5 pt-1">{children}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
