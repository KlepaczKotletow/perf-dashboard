import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccordionItem = { q: string; a: ReactNode };

// Standardised FAQ/disclosure accordion built on native <details> (no JS, SSR-
// friendly, keyboard-accessible). Replaces the three slightly-different
// <details> treatments scattered across the marketing pages.
export function Accordion({
  items,
  className,
}: {
  items: AccordionItem[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <details
          key={i}
          className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors hover:border-border"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="text-[15px] font-semibold text-foreground">{item.q}</span>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground transition-transform duration-200 group-open:rotate-45">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </summary>
          <div className="px-5 pb-5 pt-1 text-[14px] leading-relaxed text-muted-foreground">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
