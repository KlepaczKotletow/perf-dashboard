import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Editorial mono eyebrow label (Legora "kicker"). A small uppercase, tracked-
// out, monospaced label that sits above section headings — the cheap, high-
// signal "this was designed" tell. Pass `onDark` inside #1a1a2e moments.
export function Kicker({
  children,
  onDark = false,
  className,
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em]",
        onDark ? "text-white/55" : "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1 w-1 rounded-full",
          onDark ? "bg-[hsl(var(--spotlight))]" : "bg-primary",
        )}
      />
      {children}
    </span>
  );
}
