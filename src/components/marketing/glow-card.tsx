"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePointerGlow } from "./use-pointer-glow";

// Bordered card with a cursor-following radial glow (Aceternity "Card
// Spotlight / Glowing Effect") + a subtle hover lift. The single most reused
// surface across the redesign. Optionally renders as a link (internal Link or
// external <a>).
export function GlowCard({
  children,
  className,
  href,
  external = false,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  external?: boolean;
  ariaLabel?: string;
}) {
  const { onPointerMove } = usePointerGlow<HTMLDivElement>();

  const card = (
    <div
      onPointerMove={onPointerMove}
      className={cn(
        "glow-surface group relative overflow-hidden rounded-2xl border border-border/70 bg-card",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30",
        "hover:shadow-[0_16px_50px_-18px_rgba(var(--primary-rgb),0.22)]",
        className,
      )}
    >
      {children}
    </div>
  );

  if (href) {
    const cls = "block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    return external ? (
      <a href={href} aria-label={ariaLabel} className={cls}>
        {card}
      </a>
    ) : (
      <Link href={href} aria-label={ariaLabel} className={cls}>
        {card}
      </Link>
    );
  }

  return card;
}
