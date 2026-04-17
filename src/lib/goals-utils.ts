// ─── Shared Goal Types & Utilities ─────────────────────
// Extracted from goals-client.tsx for reuse across goals page and team goals view.

export interface EmployeeRef { id: string; slack_name: string; department: string | null }
export interface CycleRef { id: string; name: string }
export interface SuggestedByRef { id: string; slack_name: string }

export interface GoalRow {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  weight: number;
  metric_start: number | null;
  metric_current: number | null;
  metric_target: number | null;
  metric_unit: string | null;
  tracking_status: string;
  scope: string;
  goal_direction?: string;
  due_date: string | null;
  suggested_by_user_id?: string | null;
  employee?: EmployeeRef | EmployeeRef[] | null;
  cycle?: CycleRef | CycleRef[] | null;
  suggested_by?: SuggestedByRef | SuggestedByRef[] | null;
}

export interface NormalizedGoalRow extends Omit<GoalRow, "employee" | "cycle" | "suggested_by"> {
  employee: EmployeeRef | null;
  cycle: CycleRef | null;
  suggested_by: SuggestedByRef | null;
}

export interface GoalNode extends NormalizedGoalRow {
  children: GoalNode[];
  depth: number;
}

/** Normalize a Supabase FK join that may be an array or a single object */
export function unwrap<T>(val: T | T[] | null | undefined): T | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

/** Calculate progress based on goal direction */
export function calculateProgress(
  direction: string | undefined,
  start: number | null,
  current: number | null,
  target: number | null
): number {
  if (current == null || target == null) return 0;
  const s = start ?? 0;

  switch (direction) {
    case "decrease":
      if (s === target) return current <= target ? 100 : 0;
      return Math.min(100, Math.max(0, Math.round(((s - current) / (s - target)) * 100)));
    case "above":
      return current >= target ? 100 : 0;
    case "below":
      return current <= target ? 100 : 0;
    case "increase":
    default:
      if (s === target) return current >= target ? 100 : 0;
      return Math.min(100, Math.max(0, Math.round(((current - s) / (target - s)) * 100)));
  }
}

export function directionIcon(d: string | undefined): string {
  switch (d) {
    case "decrease": return "↓";
    case "above": return "≥";
    case "below": return "≤";
    default: return "↑";
  }
}

export const trackingConfig: Record<string, { label: string; color: string; barColor: string }> = {
  on_track: {
    label: "On track",
    color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    barColor: "bg-emerald-500",
  },
  at_risk: {
    label: "At risk",
    color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10",
    barColor: "bg-amber-500",
  },
  delayed: {
    label: "Delayed",
    color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10",
    barColor: "bg-red-500",
  },
  achieved: {
    label: "Achieved",
    color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10",
    barColor: "bg-emerald-600",
  },
};

export function buildTree(goals: NormalizedGoalRow[]): GoalNode[] {
  const map = new Map<string, GoalNode>();
  const roots: GoalNode[] = [];

  goals.forEach((g) => map.set(g.id, { ...g, children: [], depth: 0 }));

  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function flattenTree(nodes: GoalNode[], expanded: Set<string>): GoalNode[] {
  const result: GoalNode[] = [];
  function walk(list: GoalNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children.length > 0 && expanded.has(node.id)) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}
