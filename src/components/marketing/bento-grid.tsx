import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlowCard } from "./glow-card";

// Asymmetric feature grid (Aceternity "Bento Grid"). Callers control spans via
// className on each BentoCard (e.g. `lg:col-span-2`, `lg:row-span-2`).
export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[minmax(13rem,auto)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  icon: Icon,
  title,
  description,
  media,
  children,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title?: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <GlowCard className={cn("flex flex-col p-6 sm:p-7", className)}>
      {media && <div className="mb-5">{media}</div>}
      {Icon && (
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-inset ring-primary/10">
          <Icon className="h-5 w-5" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      )}
      {description && (
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {children}
    </GlowCard>
  );
}
