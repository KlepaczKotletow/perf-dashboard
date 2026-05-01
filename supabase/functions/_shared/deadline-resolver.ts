// Resolves the "deadline" used by Nami reminders/escalations for a given cycle.
//
// Priority:
//   1. flagOn AND active phase exists -> phase end_date
//   2. flagOn AND no active phase, review_deadline set -> review_deadline
//   3. flagOn AND no active phase, no review_deadline -> cycle end_date
//      (NEW behavior, only when flag on)
//   4. flag off, review_deadline set -> review_deadline
//   5. flag off, review_deadline null -> null (preserves pre-Sprint-1 behavior;
//      we do NOT fall back to cycle.end_date when the flag is off)
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
  // Check workspace flag
  const wsResp = await supabase
    .from("workspaces")
    .select("phase_deadline_reminders_enabled")
    .eq("id", workspaceId)
    .single();
  const flagOn = wsResp?.data?.phase_deadline_reminders_enabled === true;

  if (flagOn) {
    // 1. Active phase end_date
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

    // 2 + 3. Fall back to cycle.review_deadline, then cycle.end_date
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

  // Flag off: ONLY use review_deadline. Never fall back to cycle.end_date —
  // pre-Sprint-1, cycles with null review_deadline never triggered reminders,
  // and we must preserve that for workspaces that haven't opted into
  // phase-aware reminders.
  const cycleResp = await supabase
    .from("performance_cycles")
    .select("review_deadline, end_date")
    .eq("id", cycleId)
    .single();
  const reviewDl = cycleResp?.data?.review_deadline;
  if (reviewDl) return new Date(reviewDl);

  return null;
}
