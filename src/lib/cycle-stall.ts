/**
 * Is this cycle stuck?
 *
 * `progress_cycle_phases()` runs nightly (cron `progress-cycle-phases-daily`,
 * 06:05 UTC) and is NOT broken — it is doing exactly what migration
 * 20260807_01 designed it to do. Its rule: the target phase is the one whose
 * window contains now, and if the schedule has slipped entirely, hold at the
 * earliest unfinished phase that has started, never the latest. That rule is
 * right. Fast-forwarding past an unfinished phase marks work complete that
 * nobody did, and the previous implementation stranded whole cycles that way.
 *
 * The problem is what the hold looks like from outside. A cycle whose schedule
 * lapsed sits on its earliest unfinished phase forever:
 *
 *   - every reviewer is blocked, because the INSERT policy requires the phase
 *     matching their role to be active,
 *   - the nightly job reports success, because holding IS success,
 *   - and nothing anywhere says so.
 *
 * The workspace's "Q2 2026" cycle held on `goal_setting` for over three months
 * exactly this way. The exit already existed — an admin can move the dates with
 * the phase deadline editor — but nobody was ever told they needed to.
 *
 * So this module does not change the holding behaviour. It names it, so the
 * product can show it and offer the way out.
 */

export interface StallPhase {
  phaseType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface CycleStall {
  /** The cycle is active, work remains, and no phase window contains `now`. */
  stalled: boolean;
  /** The phase the cycle is holding on, if any. */
  heldPhase: string | null;
  /** Whole days since that phase's window closed. Null when it has no end date. */
  daysOverdue: number | null;
}

const NOT_STALLED: CycleStall = { stalled: false, heldPhase: null, daysOverdue: null };

const MS_PER_DAY = 86_400_000;

function time(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * @param cycleStatus performance_cycles.status
 * @param phases      every cycle_phases row for the cycle
 * @param now         injected so this is testable and deterministic
 */
export function cycleStallState(
  cycleStatus: string | null,
  phases: StallPhase[],
  now: Date
): CycleStall {
  // Only a running cycle can be stuck. A closed or completed one is history.
  if (cycleStatus !== "active") return NOT_STALLED;
  if (phases.length === 0) return NOT_STALLED;

  const unfinished = phases.filter((p) => p.status !== "completed");
  // Nothing left to do — the nightly job completes the cycle itself.
  if (unfinished.length === 0) return NOT_STALLED;

  const nowMs = now.getTime();

  // If any phase window contains now, the schedule is live and the nightly job
  // will move the cycle along on its own. Not stalled, however overdue the
  // cycle's own end date may be.
  const live = phases.some((p) => {
    const start = time(p.startDate);
    const end = time(p.endDate);
    return start !== null && end !== null && start <= nowMs && end >= nowMs;
  });
  if (live) return NOT_STALLED;

  // No live window and work outstanding: the cycle is holding. Report the phase
  // it is held on — the same one progress_cycle_phases would pick, so the
  // message matches reality rather than guessing.
  const started = unfinished
    .filter((p) => {
      const start = time(p.startDate);
      return start !== null && start <= nowMs;
    })
    .sort((a, b) => (time(a.startDate) ?? 0) - (time(b.startDate) ?? 0));

  // Every remaining phase is scheduled in the future: the cycle is waiting to
  // begin, not stuck. That is a normal state for a cycle launched early.
  if (started.length === 0) return NOT_STALLED;

  const held = started[0];
  const heldEnd = time(held.endDate);
  const daysOverdue =
    heldEnd !== null && heldEnd < nowMs ? Math.floor((nowMs - heldEnd) / MS_PER_DAY) : null;

  return { stalled: true, heldPhase: held.phaseType, daysOverdue };
}

/** "Manager review" from "manager_review", for message copy. */
export function phaseLabel(phaseType: string | null): string {
  if (!phaseType) return "This cycle";
  const spaced = phaseType.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
