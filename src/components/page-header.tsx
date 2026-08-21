import * as React from "react";
import { cn } from "@/lib/utils";

export type Hat = "my-work" | "my-team" | "manage";

const HAT_LABEL: Record<Hat, string> = {
  "my-work": "My Work",
  "my-team": "My Team",
  "manage": "Manage",
};

// Hat chip colours, designed to escalate by role:
//  - My Work: quiet neutral (personal space)
//  - My Team: primary tint (manager context)
//  - Manage: amber tint (admin actions, louder)
const HAT_CLASS: Record<Hat, string> = {
  "my-work": "bg-muted text-muted-foreground",
  "my-team": "bg-primary/10 text-primary",
  "manage": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

interface PageHeaderProps {
  hat: Hat;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Set the title in Fraunces.
   *
   * Reserved for pages whose title is a **person**, never a section name. The
   * product already ships Fraunces (loaded in the root layout, tokenised as
   * --font-serif) and used it on no product surface at all; spending it on one
   * thing rather than everything is what keeps it meaningful — the serif tells
   * you at a glance that you are looking at a human being rather than a list.
   */
  serifTitle?: boolean;
}

/** The role-context chip on its own, for pages whose header is too custom for PageHeader. */
export function HatChip({ hat, className }: { hat: Hat; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded-full",
        HAT_CLASS[hat],
        className,
      )}
    >
      {HAT_LABEL[hat]}
    </span>
  );
}

/**
 * Every dashboard page renders this at the top. The hat chip + title
 * make the current role context unambiguous — a second safety net on
 * top of the sidebar section label.
 *
 * See docs/plans/2026-04-17-role-clarity-redesign-design.md §2.
 */
export function PageHeader({ hat, title, subtitle, actions, className, serifTitle }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 pb-4 mb-4 border-b border-border/60",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <HatChip hat={hat} className="mb-1.5" />
        <h1
          className={cn(
            "font-semibold tracking-tight text-foreground",
            serifTitle
              ? "font-serif text-[1.875rem] leading-[1.15]"
              : "text-2xl leading-tight",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p data-subtitle className="text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
