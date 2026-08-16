/**
 * Reporting-hierarchy helpers.
 *
 * These back the access scoping on /dashboard/reviews. The
 * `review_assignments` SELECT policy is workspace-wide — it only checks
 * `pc.workspace_id = auth_workspace_id()` despite being named "Users view own
 * assignments or managers view team" — so RLS returns every assignment in the
 * org and the scoping has to happen in application code. Bugs here are a data
 * leak, not a cosmetic problem, which is why this lives in its own tested unit.
 */

export interface ReportingNode {
  id: string;
  manager_id: string | null;
}

/**
 * Every user id strictly below `rootId` in the reporting tree.
 *
 * `rootId` itself is excluded — callers decide separately whether someone may
 * see their own row. Reporting cycles (creatable via the edit form, which has
 * no cycle guard) terminate instead of looping forever.
 */
export function reportingSubtree(users: ReportingNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const u of users) {
    if (!u.manager_id) continue;
    const siblings = childrenOf.get(u.manager_id);
    if (siblings) siblings.push(u.id);
    else childrenOf.set(u.manager_id, [u.id]);
  }

  const seen = new Set<string>();
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      // A cycle (A→B→A) would otherwise re-enqueue forever. Also stops the
      // root being re-added to its own subtree through a cycle.
      if (child === rootId || seen.has(child)) continue;
      seen.add(child);
      queue.push(child);
    }
  }
  return seen;
}

export interface ScopableAssignment {
  employee_id?: string | null;
  manager_id?: string | null;
  reviewer_id?: string | null;
}

/**
 * The assignments a non-HR viewer is entitled to see: anyone in their
 * reporting line, plus any review they personally own or are the subject of.
 */
export function scopeAssignmentsToViewer<T extends ScopableAssignment>(
  assignments: T[],
  subtree: Set<string>,
  viewerId: string
): T[] {
  return assignments.filter(
    (a) =>
      (a.employee_id != null && subtree.has(a.employee_id)) ||
      a.manager_id === viewerId ||
      a.reviewer_id === viewerId ||
      a.employee_id === viewerId
  );
}
