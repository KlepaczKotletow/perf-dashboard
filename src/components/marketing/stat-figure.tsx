import { AnimatedCounter } from "@/components/landing/animated-counter";
import { cn } from "@/lib/utils";

// Oversized standalone stat figure (Legora "impact figures"). Count-up on
// scroll via the existing AnimatedCounter. Works on light sections and inside
// dark moments (`onDark`).
export function StatFigure({
  value,
  label,
  sub,
  source,
  onDark = false,
  animate = true,
  className,
}: {
  value: string;
  label: string;
  sub?: string;
  source?: string;
  onDark?: boolean;
  animate?: boolean;
  className?: string;
}) {
  const figure = cn(
    "block text-4xl font-bold tracking-tight tabular-nums md:text-5xl",
    onDark ? "text-white" : "text-primary",
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {animate ? (
        <AnimatedCounter value={value} className={figure} />
      ) : (
        <span className={figure}>{value}</span>
      )}
      <p className={cn("text-sm font-semibold", onDark ? "text-white" : "text-foreground")}>
        {label}
      </p>
      {sub && (
        <p className={cn("text-sm leading-relaxed", onDark ? "text-white/55" : "text-muted-foreground")}>
          {sub}
        </p>
      )}
      {source && (
        <p className={cn("text-[10px] italic", onDark ? "text-white/35" : "text-muted-foreground/60")}>
          {source}
        </p>
      )}
    </div>
  );
}
