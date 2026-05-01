// Resolves the "deadline" used by Nami reminders/escalations for a given cycle.
//
// Priority:
//   1. If workspace.phase_deadline_reminders_enabled = true AND there is an
//      active cycle phase, use that phase's end_date.
//   2. Otherwise fall back to performance_cycles.review_deadline.
//   3. If review_deadline is null, fall back to performance_cycles.end_date.
//   4. If nothing resolves, return null (caller decides what to do).
//
// Designed to take any Supabase client interface that exposes `.from().select()`
// — both the edge-function service-role client and a mocked client work.

export interface DeadlineResolverClient {
  from(table: string): any;
}

export async function getDeadlineForCycle(
  supabase: DeadlineResolverClient,
  cycleId: string,
  workspaceId: string,
): Promise<Date | null> {
  // 1. Check workspace flag
  const wsResp = await supabase
    .from("workspaces")
    .select("phase_deadline_reminders_enabled")
    .eq("id", workspaceId)
    .single();
  const flagOn = wsResp?.data?.phase_deadline_reminders_enabled === true;

  if (flagOn) {
    const phaseResp = await supabase
      .from("cycle_phases")
      .select("end_date")
      .eq("cycle_id", cycleId)
      .eq("status", "active")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const phaseEnd = phaseResp?.data?.end_date;
    if (phaseEnd) return new Date(phaseEnd);
  }

  // 2 + 3. Fall back to cycle-level deadlines
  const cycleResp = await supabase
    .from("performance_cycles")
    .select("review_deadline, end_date")
    .eq("id", cycleId)
    .single();
  const reviewDl = cycleResp?.data?.review_deadline;
  if (reviewDl) return new Date(reviewDl);
  const cycleEnd = cycleResp?.data?.end_date;
  if (cycleEnd) return new Date(cycleEnd);

  return null;
}
