/**
 * Centralized status configuration.
 * Import from here — never define local statusConfig objects.
 *
 * Color semantics:
 *  - zinc   = draft / archived / inactive
 *  - amber  = pending / needs attention
 *  - sky    = in progress / waiting
 *  - emerald = active / completed / success
 *  - violet = submitted but awaiting next step
 */

export interface StatusConfig {
  label: string;
  badge: string;
  dot?: string;
}

// ── Review assignment status ───────────────────────────────────────────────────
export const ASSIGNMENT_STATUS: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    dot: "bg-amber-400",
  },
  in_progress: {
    label: "In Progress",
    badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
    dot: "bg-sky-500",
  },
  completed: {
    label: "Completed",
    badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    dot: "bg-emerald-500",
  },
};

// ── Performance cycle status ───────────────────────────────────────────────────
export const CYCLE_STATUS: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    badge: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
    dot: "bg-zinc-400",
  },
  active: {
    label: "Active",
    badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    dot: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
    dot: "bg-sky-500",
  },
  archived: {
    label: "Archived",
    badge: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
    dot: "bg-zinc-400",
  },
};

// ── Goal status ────────────────────────────────────────────────────────────────
export const GOAL_STATUS: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    badge: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
  },
  active: {
    label: "Active",
    badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
  },
  completed: {
    label: "Completed",
    badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
  },
  archived: {
    label: "Archived",
    badge: "text-zinc-600 bg-zinc-100 dark:text-zinc-400 dark:bg-zinc-400/10",
  },
};

// ── Goal tracking status ───────────────────────────────────────────────────────
export const GOAL_TRACKING_STATUS: Record<string, StatusConfig> = {
  on_track: {
    label: "On Track",
    badge: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    dot: "bg-emerald-500",
  },
  at_risk: {
    label: "At Risk",
    badge: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    dot: "bg-amber-400",
  },
  delayed: {
    label: "Delayed",
    badge: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10",
    dot: "bg-red-500",
  },
  achieved: {
    label: "Achieved",
    badge: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10",
    dot: "bg-sky-500",
  },
};

/** Safely retrieve a status config, falling back gracefully for unknown values. */
export function getAssignmentStatus(status: string): StatusConfig {
  return ASSIGNMENT_STATUS[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    badge: "text-muted-foreground bg-muted",
    dot: "bg-muted-foreground",
  };
}

export function getCycleStatus(status: string): StatusConfig {
  return CYCLE_STATUS[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    badge: "text-muted-foreground bg-muted",
    dot: "bg-muted-foreground",
  };
}
